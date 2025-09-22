import { access, readFile } from "fs/promises";
import { dirname, isAbsolute, resolve } from "path";
import type {
  Condition,
  CouplingMode,
  GameResult,
  SymmetryLevel,
} from "../cooperation/types";

export interface AnalysisWarning {
  code: "LOW_TRIALS" | "LOW_COVERAGE" | "SMALL_EFFECT";
  message: string;
  threshold: number;
  actual: number;
  scope:
    | { type: "overall" }
    | { type: "model"; model: string }
    | { type: "factor"; factor: "symmetry" | "coupling" }
    | { type: "interaction" };
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
}

export interface ConditionMetrics {
  label: string;
  totalTrials: number;
  matchedTrials: number;
  unmatchedTrials: number;
  coordinateCount: number;
  preemptCount: number;
  cooperationRate: number;
  standardError: number;
  confidenceInterval: ConfidenceInterval;
  coverage: number;
}

export interface ModelMetrics {
  model: string;
  totalTrials: number;
  matchedTrials: number;
  unmatchedTrials: number;
  coverage: number;
  cooperationRate: number;
  conditions: Record<string, ConditionMetrics>;
}

export interface FactorEffectMetrics {
  factor: "symmetry" | "coupling";
  baselineLevel: SymmetryLevel | CouplingMode;
  comparisonLevel: SymmetryLevel | CouplingMode;
  baseline: {
    matchedTrials: number;
    coordinateCount: number;
    cooperationRate: number;
  };
  comparison: {
    matchedTrials: number;
    coordinateCount: number;
    cooperationRate: number;
  };
  effectSize: number;
  standardError: number;
  confidenceInterval: ConfidenceInterval;
}

export interface InteractionMetrics {
  highPresent: ConditionMetrics | null;
  highAbsent: ConditionMetrics | null;
  lowPresent: ConditionMetrics | null;
  lowAbsent: ConditionMetrics | null;
  differenceInDifferences: number | null;
  standardError: number | null;
  confidenceInterval: ConfidenceInterval | null;
}

export interface CooperationAnalysisSummary {
  analyzerVersion: string;
  generatedAt: string;
  manifestPath: string;
  manifestDirectory: string;
  pilotId: string;
  pilotOutputDirectory: string;
  configuration: {
    models: string[];
    runsPerCondition: number;
    seed: number;
    startedAt: string;
    completedAt: string;
  };
  totals: {
    totalTrials: number;
    matchedTrials: number;
    unmatchedTrials: number;
    coverage: number;
    cooperationRate: number;
    standardError: number;
    confidenceInterval: ConfidenceInterval;
  };
  models: ModelMetrics[];
  factorEffects: FactorEffectMetrics[];
  interaction: InteractionMetrics;
  warnings: AnalysisWarning[];
}

interface PilotManifest {
  pilot: {
    id: string;
    seed: number;
    runsPerCondition: number;
    models: string[];
    totalTrials?: number;
    startedAt: number;
    completedAt: number;
    outputDirectory: string;
  };
  batches: Array<{
    batch: {
      id: string;
      model: string;
      results?: GameResult[];
    };
    trialFiles?: string[];
  }>;
}

interface ConditionAccumulator {
  total: number;
  matched: number;
  coordinate: number;
  preempt: number;
}

const ANALYZER_VERSION = "1.0.0";
const SYMMETRY_LEVELS: readonly SymmetryLevel[] = ["high", "low"];
const COUPLING_LEVELS: readonly CouplingMode[] = ["present", "absent"];

export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisError";
  }
}

function toConditionKey(condition: Condition): string {
  return `symmetry-${condition.symmetry}_coupling-${condition.coupling}`;
}

function parseManifest(manifestPath: string, raw: string): PilotManifest {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new AnalysisError(
      `Failed to parse manifest JSON (${manifestPath}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!data || typeof data !== "object") {
    throw new AnalysisError(`Manifest at ${manifestPath} is not an object.`);
  }

  const manifest = data as PilotManifest;

  if (!manifest.pilot) {
    throw new AnalysisError(`Manifest at ${manifestPath} is missing pilot metadata.`);
  }

  if (!Array.isArray(manifest.batches) || manifest.batches.length === 0) {
    throw new AnalysisError(
      `Manifest at ${manifestPath} does not list any batches.`,
    );
  }

  return manifest;
}

function validateCondition(condition: any, source: string): Condition {
  if (!condition || typeof condition !== "object") {
    throw new AnalysisError(
      `Result ${source} is missing the condition payload required for analysis.`,
    );
  }

  const symmetry = (condition as Condition).symmetry;
  const coupling = (condition as Condition).coupling;

  if (!SYMMETRY_LEVELS.includes(symmetry as SymmetryLevel)) {
    throw new AnalysisError(
      `Result ${source} contains unsupported symmetry level: ${symmetry}.`,
    );
  }

  if (!COUPLING_LEVELS.includes(coupling as CouplingMode)) {
    throw new AnalysisError(
      `Result ${source} contains unsupported coupling mode: ${coupling}.`,
    );
  }

  return { symmetry: symmetry as SymmetryLevel, coupling: coupling as CouplingMode };
}

function validateDecision(decision: unknown, source: string): "COORDINATE" | "PREEMPT" | null {
  if (decision === null) {
    return null;
  }
  if (decision === "COORDINATE" || decision === "PREEMPT") {
    return decision;
  }
  if (decision === undefined) {
    throw new AnalysisError(`Result ${source} is missing the decision field.`);
  }
  throw new AnalysisError(
    `Result ${source} contains unsupported decision value: ${String(decision)}`,
  );
}

async function resolveTrialFilePath(
  manifestDir: string,
  filePath: string,
): Promise<string> {
  if (!filePath) {
    throw new AnalysisError("Encountered empty trial file path in manifest.");
  }

  const candidates: string[] = [];

  if (isAbsolute(filePath)) {
    candidates.push(filePath);
  } else {
    candidates.push(resolve(manifestDir, filePath));
    candidates.push(resolve(process.cwd(), filePath));
  }

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code && (error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new AnalysisError(
          `Unable to read trial file ${candidate}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  throw new AnalysisError(
    `Trial file ${filePath} referenced by manifest could not be resolved from ${manifestDir}.`,
  );
}

function updateAccumulator(acc: ConditionAccumulator): ConditionMetrics {
  const matchedTrials = acc.matched;
  const cooperationRate = matchedTrials > 0 ? acc.coordinate / matchedTrials : 0;
  const standardError = matchedTrials > 0
    ? Math.sqrt((cooperationRate * (1 - cooperationRate)) / matchedTrials)
    : 0;
  const margin = 1.96 * standardError;
  const lower = Math.max(0, cooperationRate - margin);
  const upper = Math.min(1, cooperationRate + margin);
  const coverage = acc.total > 0 ? acc.matched / acc.total : 0;

  return {
    label: "",
    totalTrials: acc.total,
    matchedTrials,
    unmatchedTrials: acc.total - acc.matched,
    coordinateCount: acc.coordinate,
    preemptCount: acc.preempt,
    cooperationRate,
    standardError,
    confidenceInterval: { lower, upper },
    coverage,
  };
}

function formatTimestamp(value: number): string {
  return new Date(value).toISOString();
}

function accumulateCondition(
  container: Map<string, ConditionAccumulator>,
  key: string,
): ConditionAccumulator {
  const existing = container.get(key);
  if (existing) {
    return existing;
  }
  const created: ConditionAccumulator = {
    total: 0,
    matched: 0,
    coordinate: 0,
    preempt: 0,
  };
  container.set(key, created);
  return created;
}

function combineAccumulators(first: ConditionAccumulator, second: ConditionAccumulator) {
  first.total += second.total;
  first.matched += second.matched;
  first.coordinate += second.coordinate;
  first.preempt += second.preempt;
}

function buildConditionMetrics(
  label: string,
  acc: ConditionAccumulator,
): ConditionMetrics {
  const metrics = updateAccumulator(acc);
  metrics.label = label;
  return metrics;
}

function computeOverallMetrics(acc: ConditionAccumulator): {
  cooperationRate: number;
  standardError: number;
  confidenceInterval: ConfidenceInterval;
} {
  const metrics = updateAccumulator(acc);
  return {
    cooperationRate: metrics.cooperationRate,
    standardError: metrics.standardError,
    confidenceInterval: metrics.confidenceInterval,
  };
}

function computeEffectMetrics(
  baseline: ConditionAccumulator,
  comparison: ConditionAccumulator,
  factor: "symmetry" | "coupling",
  baselineLevel: SymmetryLevel | CouplingMode,
  comparisonLevel: SymmetryLevel | CouplingMode,
): FactorEffectMetrics {
  const baselineMetrics = updateAccumulator(baseline);
  const comparisonMetrics = updateAccumulator(comparison);
  const effectSize = comparisonMetrics.cooperationRate - baselineMetrics.cooperationRate;
  const variance =
    Math.pow(baselineMetrics.standardError, 2) +
    Math.pow(comparisonMetrics.standardError, 2);
  const standardError = Math.sqrt(variance);
  const margin = 1.96 * standardError;
  const lower = effectSize - margin;
  const upper = effectSize + margin;

  return {
    factor,
    baselineLevel,
    comparisonLevel,
    baseline: {
      matchedTrials: baselineMetrics.matchedTrials,
      coordinateCount: baselineMetrics.coordinateCount,
      cooperationRate: baselineMetrics.cooperationRate,
    },
    comparison: {
      matchedTrials: comparisonMetrics.matchedTrials,
      coordinateCount: comparisonMetrics.coordinateCount,
      cooperationRate: comparisonMetrics.cooperationRate,
    },
    effectSize,
    standardError,
    confidenceInterval: { lower, upper },
  };
}

function computeInteraction(
  lookup: Map<string, ConditionAccumulator>,
): InteractionMetrics {
  const combos: Record<
    string,
    ConditionMetrics | null
  > = Object.create(null);

  const keys: Array<[string, SymmetryLevel, CouplingMode]> = [
    ["high_present", "high", "present"],
    ["high_absent", "high", "absent"],
    ["low_present", "low", "present"],
    ["low_absent", "low", "absent"],
  ];

  for (const [slot, symmetry, coupling] of keys) {
    const key = toConditionKey({ symmetry, coupling });
    const acc = lookup.get(key);
    combos[slot] = acc ? buildConditionMetrics(key, acc) : null;
  }

  const hp = combos.high_present;
  const ha = combos.high_absent;
  const lp = combos.low_present;
  const la = combos.low_absent;

  if (!hp || !ha || !lp || !la) {
    return {
      highPresent: hp,
      highAbsent: ha,
      lowPresent: lp,
      lowAbsent: la,
      differenceInDifferences: null,
      standardError: null,
      confidenceInterval: null,
    };
  }

  const effect =
    (hp.cooperationRate - ha.cooperationRate) -
    (lp.cooperationRate - la.cooperationRate);
  const variance =
    Math.pow(hp.standardError, 2) +
    Math.pow(ha.standardError, 2) +
    Math.pow(lp.standardError, 2) +
    Math.pow(la.standardError, 2);
  const standardError = Math.sqrt(variance);
  const margin = 1.96 * standardError;

  return {
    highPresent: hp,
    highAbsent: ha,
    lowPresent: lp,
    lowAbsent: la,
    differenceInDifferences: effect,
    standardError,
    confidenceInterval: {
      lower: effect - margin,
      upper: effect + margin,
    },
  };
}

export async function analyzePilotManifest(
  manifestPath: string,
): Promise<CooperationAnalysisSummary> {
  const resolvedManifestPath = resolve(process.cwd(), manifestPath);
  const manifestDir = dirname(resolvedManifestPath);
  const rawManifest = await readFile(resolvedManifestPath, "utf8");
  const manifest = parseManifest(resolvedManifestPath, rawManifest);

  const trialFileSet = new Set<string>();
  for (const entry of manifest.batches) {
    if (!Array.isArray(entry.trialFiles) || entry.trialFiles.length === 0) {
      throw new AnalysisError(
        `Manifest batch ${entry.batch?.id ?? "<unknown>"} does not list trial files.`,
      );
    }
    for (const filePath of entry.trialFiles) {
      trialFileSet.add(filePath);
    }
  }

  if (trialFileSet.size === 0) {
    throw new AnalysisError(
      `Manifest ${resolvedManifestPath} did not resolve any trial files for analysis.`,
    );
  }

  const perModel = new Map<string, Map<string, ConditionAccumulator>>();
  const perModelTotals = new Map<
    string,
    ConditionAccumulator
  >();
  const perConditionOverall = new Map<string, ConditionAccumulator>();
  const overallAccumulator: ConditionAccumulator = {
    total: 0,
    matched: 0,
    coordinate: 0,
    preempt: 0,
  };

  for (const originalPath of trialFileSet) {
    const resolvedPath = await resolveTrialFilePath(manifestDir, originalPath);
    const raw = await readFile(resolvedPath, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new AnalysisError(
        `Failed to parse trial JSON (${resolvedPath}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const result = parsed as Partial<GameResult>;
    if (!result || typeof result !== "object") {
      throw new AnalysisError(`Trial file ${resolvedPath} did not contain an object.`);
    }

    if (typeof result.model !== "string" || result.model.length === 0) {
      throw new AnalysisError(
        `Trial file ${resolvedPath} is missing the model identifier.`,
      );
    }

    const condition = validateCondition(result.condition, resolvedPath);
    const decision = validateDecision(result.decision, resolvedPath);

    const modelKey = result.model;
    const conditionKey = toConditionKey(condition);

    const modelConditions = perModel.get(modelKey) ?? new Map<string, ConditionAccumulator>();
    if (!perModel.has(modelKey)) {
      perModel.set(modelKey, modelConditions);
    }
    const modelTotals = perModelTotals.get(modelKey) ?? {
      total: 0,
      matched: 0,
      coordinate: 0,
      preempt: 0,
    };
    if (!perModelTotals.has(modelKey)) {
      perModelTotals.set(modelKey, modelTotals);
    }

    const conditionAcc = accumulateCondition(modelConditions, conditionKey);
    const overallCondition = accumulateCondition(perConditionOverall, conditionKey);

    conditionAcc.total += 1;
    overallCondition.total += 1;
    modelTotals.total += 1;
    overallAccumulator.total += 1;

    if (decision !== null) {
      conditionAcc.matched += 1;
      overallCondition.matched += 1;
      modelTotals.matched += 1;
      overallAccumulator.matched += 1;

      if (decision === "COORDINATE") {
        conditionAcc.coordinate += 1;
        overallCondition.coordinate += 1;
        modelTotals.coordinate += 1;
        overallAccumulator.coordinate += 1;
      } else {
        conditionAcc.preempt += 1;
        overallCondition.preempt += 1;
        modelTotals.preempt += 1;
        overallAccumulator.preempt += 1;
      }
    }
  }

  const models: ModelMetrics[] = [];
  const warnings: AnalysisWarning[] = [];

  const trialThreshold = 120;
  const coverageThreshold = 0.95;
  const effectThreshold = 0.5;

  for (const [model, conditions] of perModel.entries()) {
    const totals = perModelTotals.get(model)!;
    const conditionMetrics: Record<string, ConditionMetrics> = {};

    for (const [label, acc] of conditions.entries()) {
      conditionMetrics[label] = buildConditionMetrics(label, acc);
    }

    const metrics = updateAccumulator(totals);

    if (totals.total < trialThreshold) {
      warnings.push({
        code: "LOW_TRIALS",
        message: `${model} analyzed ${totals.total} trials (< ${trialThreshold}).`,
        threshold: trialThreshold,
        actual: totals.total,
        scope: { type: "model", model },
      });
    }

    if (metrics.coverage < coverageThreshold) {
      warnings.push({
        code: "LOW_COVERAGE",
        message: `${model} decision coverage ${(metrics.coverage * 100).toFixed(1)}% below 95% threshold.`,
        threshold: coverageThreshold,
        actual: metrics.coverage,
        scope: { type: "model", model },
      });
    }

    models.push({
      model,
      totalTrials: totals.total,
      matchedTrials: totals.matched,
      unmatchedTrials: totals.total - totals.matched,
      coverage: metrics.coverage,
      cooperationRate: metrics.cooperationRate,
      conditions: conditionMetrics,
    });
  }

  const overallMetrics = updateAccumulator(overallAccumulator);

  if (overallAccumulator.total < trialThreshold) {
    warnings.push({
      code: "LOW_TRIALS",
      message: `Total analyzed trials ${overallAccumulator.total} (< ${trialThreshold}).`,
      threshold: trialThreshold,
      actual: overallAccumulator.total,
      scope: { type: "overall" },
    });
  }

  if (overallMetrics.coverage < coverageThreshold) {
    warnings.push({
      code: "LOW_COVERAGE",
      message: `Overall decision coverage ${(overallMetrics.coverage * 100).toFixed(1)}% below 95% threshold.`,
      threshold: coverageThreshold,
      actual: overallMetrics.coverage,
      scope: { type: "overall" },
    });
  }

  // Factor effects (pooled across models)
  const pooledSymmetry: Record<SymmetryLevel, ConditionAccumulator> = {
    high: { total: 0, matched: 0, coordinate: 0, preempt: 0 },
    low: { total: 0, matched: 0, coordinate: 0, preempt: 0 },
  };
  const pooledCoupling: Record<CouplingMode, ConditionAccumulator> = {
    present: { total: 0, matched: 0, coordinate: 0, preempt: 0 },
    absent: { total: 0, matched: 0, coordinate: 0, preempt: 0 },
  };

  for (const [key, acc] of perConditionOverall.entries()) {
    const [symmetryPart, couplingPart] = key.split("_");
    const symmetry = symmetryPart?.split("-")[1] as SymmetryLevel | undefined;
    const coupling = couplingPart?.split("-")[1] as CouplingMode | undefined;
    if (symmetry && pooledSymmetry[symmetry]) {
      combineAccumulators(pooledSymmetry[symmetry], acc);
    }
    if (coupling && pooledCoupling[coupling]) {
      combineAccumulators(pooledCoupling[coupling], acc);
    }
  }

  const factorEffects: FactorEffectMetrics[] = [];

  const symmetryEffect = computeEffectMetrics(
    pooledSymmetry.high,
    pooledSymmetry.low,
    "symmetry",
    "high",
    "low",
  );
  factorEffects.push(symmetryEffect);

  const couplingEffect = computeEffectMetrics(
    pooledCoupling.present,
    pooledCoupling.absent,
    "coupling",
    "present",
    "absent",
  );
  factorEffects.push(couplingEffect);

  for (const effect of factorEffects) {
    if (Math.abs(effect.effectSize) < effectThreshold) {
      warnings.push({
        code: "SMALL_EFFECT",
        message: `${effect.factor} effect size ${effect.effectSize.toFixed(3)} below ±${effectThreshold}.`,
        threshold: effectThreshold,
        actual: effect.effectSize,
        scope: { type: "factor", factor: effect.factor },
      });
    }
  }

  const interaction = computeInteraction(perConditionOverall);
  if (
    interaction.differenceInDifferences !== null &&
    Math.abs(interaction.differenceInDifferences) < effectThreshold
  ) {
    warnings.push({
      code: "SMALL_EFFECT",
      message: `Interaction effect ${interaction.differenceInDifferences.toFixed(3)} below ±${effectThreshold}.`,
      threshold: effectThreshold,
      actual: interaction.differenceInDifferences,
      scope: { type: "interaction" },
    });
  }

  return {
    analyzerVersion: ANALYZER_VERSION,
    generatedAt: new Date().toISOString(),
    manifestPath: resolvedManifestPath,
    manifestDirectory: manifestDir,
    pilotId: manifest.pilot.id,
    pilotOutputDirectory: manifest.pilot.outputDirectory,
    configuration: {
      models: manifest.pilot.models,
      runsPerCondition: manifest.pilot.runsPerCondition,
      seed: manifest.pilot.seed,
      startedAt: formatTimestamp(manifest.pilot.startedAt),
      completedAt: formatTimestamp(manifest.pilot.completedAt),
    },
    totals: {
      totalTrials: overallAccumulator.total,
      matchedTrials: overallAccumulator.matched,
      unmatchedTrials: overallAccumulator.total - overallAccumulator.matched,
      coverage: overallMetrics.coverage,
      cooperationRate: overallMetrics.cooperationRate,
      standardError: overallMetrics.standardError,
      confidenceInterval: overallMetrics.confidenceInterval,
    },
    models: models.sort((a, b) => a.model.localeCompare(b.model)),
    factorEffects,
    interaction,
    warnings,
  };
}
