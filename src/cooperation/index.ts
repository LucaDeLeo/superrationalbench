import type { Dirent } from "fs";
import { mkdir, readdir, stat, writeFile } from "fs/promises";
import { join } from "path";
import { generateText, type LanguageModelV1 } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type {
  AgentDecision,
  AgentResponse,
  Condition,
  CooperationConfig,
  DecisionExtractionResult,
  ExperimentBatch,
  GameResult,
  IntegrationResult,
  RateLimitConfig,
} from "./types";
import { generateScenario } from "./scenario-generator";
import { SeededRandom, createSeededRandom } from "./seeded-random";
import { generateAnalysisReport } from "../analysis/report-generator";

export { SeededRandom, createSeededRandom };

const RESULTS_DIRECTORY = join("results", "cooperation");
const SCENARIO_PREVIEW_DIRECTORY = join("scenarios", "cvd");
const REQUIRED_ENV_VARS = ["OPENROUTER_API_KEY"] as const;

function readNumber(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readInteger(envKey: string, fallback: number): number {
  const value = readNumber(envKey, fallback);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

const DEFAULT_MODEL = process.env.COOPERATION_MODEL ?? "google/gemini-2.5-flash";
const DEFAULT_PROMPT =
  process.env.COOPERATION_TEST_PROMPT ??
  "You are simulating coordination under uncertainty. Reply with either COORDINATE or PREEMPT and include a one sentence rationale.";

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  minDelayMs: readInteger("COOPERATION_MIN_DELAY_MS", 100),
  maxRetries: readInteger("COOPERATION_MAX_RETRIES", 3),
  backoffBaseMs: readInteger("COOPERATION_BACKOFF_BASE_MS", 250),
  backoffFactor: readNumber("COOPERATION_BACKOFF_FACTOR", 2),
};

const DEFAULT_CONFIG: CooperationConfig = {
  model: DEFAULT_MODEL,
  maxOutputTokens: readInteger("COOPERATION_MAX_TOKENS", 800),
  temperature: readNumber("COOPERATION_TEMPERATURE", 0),
};

const FALLBACK_PILOT_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-001",
  "google/gemini-1.5-flash",
] as const;

function resolveDefaultPilotModels(): string[] {
  const raw = process.env.COOPERATION_PILOT_MODELS;
  if (!raw) {
    return [...FALLBACK_PILOT_MODELS];
  }

  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return parsed.length > 0 ? parsed : [...FALLBACK_PILOT_MODELS];
}

const DEFAULT_PILOT_MODELS = resolveDefaultPilotModels();

interface PilotRunOptions {
  models?: string[];
  runsPerCondition?: number;
  seed?: number;
  rateLimit?: Partial<RateLimitConfig>;
  configOverrides?: Partial<Omit<CooperationConfig, "model">>;
  /** Directory where trial JSON files, manifest, and summary are written. */
  outputDirectory?: string;
}

interface ConditionDecisionSummary {
  label: string;
  total: number;
  coordinate: number;
  preempt: number;
  unmatched: number;
  coverage: number;
}

interface ModelDecisionSummary {
  model: string;
  totalTrials: number;
  unmatched: number;
  coverage: number;
  conditions: Record<string, ConditionDecisionSummary>;
}

export interface PilotDecisionSummary {
  totalTrials: number;
  perModel: Record<string, ModelDecisionSummary>;
  warnings: string[];
}

interface PilotManifest {
  pilot: {
    id: string;
    seed: number;
    runsPerCondition: number;
    models: string[];
    totalTrials: number;
    startedAt: number;
    completedAt: number;
    outputDirectory: string;
  };
  batches: Array<{
    batch: ExperimentBatch;
    trialFiles: string[];
  }>;
  summaryFile: string;
  warnings: string[];
}

export interface PilotRunOutcome {
  manifestPath: string;
  summaryPath: string;
  manifest: PilotManifest;
  summary: PilotDecisionSummary;
  batches: ExperimentBatch[];
  warnings: string[];
  trialFiles: string[];
}

const PILOT_CONDITIONS: readonly Condition[] = [
  { symmetry: "high", coupling: "present" },
  { symmetry: "high", coupling: "absent" },
  { symmetry: "low", coupling: "present" },
  { symmetry: "low", coupling: "absent" },
];

class RateLimiter {
  private lastInvocation = 0;

  constructor(private readonly config: RateLimitConfig) {}

  private async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async enforceMinimumDelay() {
    const now = Date.now();
    const elapsed = now - this.lastInvocation;
    if (elapsed < this.config.minDelayMs) {
      await this.delay(this.config.minDelayMs - elapsed);
    }
    this.lastInvocation = Date.now();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.config.maxRetries) {
      try {
        await this.enforceMinimumDelay();
        return await operation();
      } catch (error) {
        lastError = error;
        const backoff =
          this.config.backoffBaseMs *
          Math.pow(this.config.backoffFactor, attempt);
        console.warn(
          `[cooperation] OpenRouter request failed (attempt ${attempt + 1}/${
            this.config.maxRetries + 1
          }):`,
          error,
        );
        attempt += 1;
        if (attempt > this.config.maxRetries) {
          break;
        }
        await this.delay(backoff);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("OpenRouter call failed after retries");
  }
}

function assertEnvironmentVariables() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Check your .env configuration before running the cooperation runner.",
    );
  }
}

function createLanguageModel(modelName: string): LanguageModelV1 {
  return openrouter(modelName);
}

async function callOpenRouter(
  model: LanguageModelV1,
  prompt: string,
  limiter: RateLimiter,
  config: CooperationConfig,
): Promise<string> {
  return limiter.execute(async () => {
    if (process.env.COOPERATION_DRY_RUN === "1") {
      console.log("[cooperation] Dry run enabled, skipping OpenRouter call.");
      await new Promise((resolve) => setTimeout(resolve, 25));
      return `COORDINATE (dry-run)\nPrompt: ${prompt.slice(0, 120)}`;
    }

    const response = await generateText({
      model,
      prompt,
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
    });
    return response.text;
  });
}

function extractDecision(text: string): DecisionExtractionResult {
  const match = text.match(/COORDINATE|PREEMPT/i);
  if (!match) {
    return { decision: null, matchedText: null };
  }
  const normalized: AgentDecision =
    match[0].toUpperCase() === "COORDINATE" ? "COORDINATE" : "PREEMPT";
  return { decision: normalized, matchedText: match[0] };
}

async function persistResult(result: GameResult) {
  await mkdir(RESULTS_DIRECTORY, { recursive: true });
  const filename = join(
    RESULTS_DIRECTORY,
    `cooperation-test-${result.model.replaceAll("/", "_")}-${result.timestamp}.json`,
  );
  await writeFile(filename, JSON.stringify(result, null, 2), "utf8");
  console.log(`[cooperation] Saved verification run to ${filename}`);
}

function formatConditionLabel(condition: Condition): string {
  return `symmetry-${condition.symmetry}_coupling-${condition.coupling}`;
}

function sanitizeFilenameSegment(value: string): string {
  return value.replace(/[^a-z0-9-_.]/gi, "_");
}

function formatIsoForId(timestamp: number): string {
  return new Date(timestamp).toISOString().replace(/[:.]/g, "-");
}

async function collectManifestFiles(
  directory: string,
  depth: number,
): Promise<string[]> {
  if (depth < 0) {
    return [];
  }

  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const manifests: string[] = [];
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isFile() && entry.name.endsWith("-manifest.json")) {
      manifests.push(entryPath);
    }
    if (entry.isDirectory() && depth > 0) {
      manifests.push(...(await collectManifestFiles(entryPath, depth - 1)));
    }
  }
  return manifests;
}

async function findLatestManifest(baseDirectory: string): Promise<string | null> {
  const manifests = await collectManifestFiles(baseDirectory, 2);
  if (manifests.length === 0) {
    return null;
  }

  let latestPath: string | null = null;
  let latestTimestamp = -Infinity;

  for (const manifestPath of manifests) {
    try {
      const fileStat = await stat(manifestPath);
      if (fileStat.mtimeMs > latestTimestamp) {
        latestTimestamp = fileStat.mtimeMs;
        latestPath = manifestPath;
      }
    } catch (error) {
      console.warn(
        `[analyze-pilot] Skipping manifest ${manifestPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return latestPath;
}

interface PilotPromptContext {
  pilotId: string;
  modelName: string;
  condition: Condition;
  runIndex: number;
  prompts: ReturnType<typeof generateScenario>;
}

function buildPilotPrompt(context: PilotPromptContext): string {
  const { pilotId, modelName, condition, runIndex, prompts } = context;
  const header = [
    `[PILOT RUN ${pilotId}]`,
    `Model: ${modelName}`,
    `Trial: ${runIndex}`,
    `Condition: symmetry=${condition.symmetry}, coupling=${condition.coupling}`,
    "",
    "== Strategy Phase ==",
    prompts.strategyPrompt,
    "",
    "== Decision Phase ==",
    prompts.decisionPrompt,
    "",
    "Respond with either COORDINATE or PREEMPT followed by a single-sentence rationale.",
  ];

  return header.join("\n");
}

async function persistPilotTrial(
  baseDirectory: string,
  pilotId: string,
  modelName: string,
  condition: Condition,
  runIndex: number,
  result: GameResult,
): Promise<string> {
  await mkdir(baseDirectory, { recursive: true });
  const conditionLabel = formatConditionLabel(condition);
  const runLabel = String(runIndex).padStart(2, "0");
  const filename = `${pilotId}--${sanitizeFilenameSegment(modelName)}--${conditionLabel}--run-${runLabel}.json`;
  const filePath = join(baseDirectory, filename);
  await writeFile(filePath, JSON.stringify(result, null, 2), "utf8");
  return filePath;
}

function createDecisionSummary(
  batches: ExperimentBatch[],
  runsPerCondition: number,
): PilotDecisionSummary {
  const perModel: Record<string, ModelDecisionSummary> = {};
  const warnings: string[] = [];
  let totalTrials = 0;

  for (const batch of batches) {
    const modelEntry: ModelDecisionSummary =
      perModel[batch.model] ?? {
        model: batch.model,
        totalTrials: 0,
        unmatched: 0,
        coverage: 0,
        conditions: {},
      };

    for (const result of batch.results) {
      totalTrials += 1;
      modelEntry.totalTrials += 1;

      const label = formatConditionLabel(result.condition);
      const conditionEntry: ConditionDecisionSummary =
        modelEntry.conditions[label] ?? {
          label,
          total: 0,
          coordinate: 0,
          preempt: 0,
          unmatched: 0,
          coverage: 0,
        };

      conditionEntry.total += 1;

      if (result.decision === "COORDINATE") {
        conditionEntry.coordinate += 1;
      } else if (result.decision === "PREEMPT") {
        conditionEntry.preempt += 1;
      } else {
        conditionEntry.unmatched += 1;
      }

      modelEntry.conditions[label] = conditionEntry;
    }

    for (const condition of PILOT_CONDITIONS) {
      const label = formatConditionLabel(condition);
      if (!modelEntry.conditions[label]) {
        modelEntry.conditions[label] = {
          label,
          total: 0,
          coordinate: 0,
          preempt: 0,
          unmatched: 0,
          coverage: 0,
        };
      }
    }

    perModel[batch.model] = modelEntry;
  }

  for (const modelEntry of Object.values(perModel)) {
    let matchedTrials = 0;
    let unmatchedTrials = 0;

    for (const conditionEntry of Object.values(modelEntry.conditions)) {
      const matched = conditionEntry.total - conditionEntry.unmatched;
      matchedTrials += matched;
      unmatchedTrials += conditionEntry.unmatched;

      conditionEntry.coverage = conditionEntry.total
        ? matched / conditionEntry.total
        : 0;

      if (conditionEntry.total < runsPerCondition) {
        warnings.push(
          `${modelEntry.model} :: ${conditionEntry.label} recorded ${conditionEntry.total}/${runsPerCondition} runs`,
        );
      }

      if (conditionEntry.coverage < 0.95) {
        const coveragePct = (conditionEntry.coverage * 100).toFixed(1);
        warnings.push(
          `${modelEntry.model} :: ${conditionEntry.label} coverage ${coveragePct}% below 95% threshold`,
        );
      }
    }

    modelEntry.unmatched = unmatchedTrials;
    modelEntry.coverage = modelEntry.totalTrials
      ? matchedTrials / modelEntry.totalTrials
      : 0;

    if (modelEntry.totalTrials < runsPerCondition * PILOT_CONDITIONS.length) {
      warnings.push(
        `${modelEntry.model} total trials ${modelEntry.totalTrials} below expected ${
          runsPerCondition * PILOT_CONDITIONS.length
        }`,
      );
    }
  }

  return {
    totalTrials,
    perModel,
    warnings,
  };
}

export interface ScenarioPreviewOptions {
  seed?: number;
  /** When true, also echo each preview to stdout for quick inspection. */
  echo?: boolean;
}

export async function renderScenarioPreviews(
  options: ScenarioPreviewOptions = {},
): Promise<void> {
  const seed = Number.isFinite(options.seed) ? Number(options.seed) : 42;
  const rng = createSeededRandom(seed);

  await mkdir(SCENARIO_PREVIEW_DIRECTORY, { recursive: true });

  for (const condition of PILOT_CONDITIONS) {
    const prompts = generateScenario(condition, rng);
    const filename = join(
      SCENARIO_PREVIEW_DIRECTORY,
      `cirrus-24-${formatConditionLabel(condition)}.prompt.txt`,
    );
    const previewContent = [
      "# CIRRUS-24 Scenario Preview",
      `Seed: ${seed}`,
      `Condition: symmetry=${condition.symmetry}, coupling=${condition.coupling}`,
      "",
      "## Strategy Phase",
      prompts.strategyPrompt,
      "",
      "## Decision Phase",
      prompts.decisionPrompt,
      "",
    ].join("\n");

    await writeFile(filename, previewContent, "utf8");
    console.log(`[cooperation] Wrote preview -> ${filename}`);

    if (options.echo) {
      console.log(previewContent);
    }
  }

  console.log("[cooperation] Manual verification checklist:");
  console.log(
    "  1. Open one high-symmetry and one low-symmetry file under scenarios/cvd/.",
  );
  console.log(
    "  2. Confirm the symmetry line matches the required wording and the coupling cue toggles correctly.",
  );
  console.log(
    "  3. Keep the SeededRandom seed fixed (default 42) or pass --seed=<value> for reproducible variants.",
  );
}

export async function runPilotExperiment(
  options: PilotRunOptions = {},
): Promise<PilotRunOutcome> {
  assertEnvironmentVariables();

  const runsPerConditionInput = options.runsPerCondition;
  const runsPerCondition = Number.isFinite(runsPerConditionInput)
    ? Math.max(1, Math.floor(runsPerConditionInput as number))
    : 10;

  const modelsInput = options.models ?? DEFAULT_PILOT_MODELS;
  const normalizedModels = modelsInput
    .map((model) => model.trim())
    .filter((model) => model.length > 0);

  const uniqueModels = Array.from(new Set(normalizedModels));
  if (uniqueModels.length < 3 || uniqueModels.length > 5) {
    throw new Error(
      `[run-pilot] Model roster must include between 3 and 5 unique models; received ${uniqueModels.length}.`,
    );
  }

  const seed = Number.isFinite(options.seed)
    ? Math.floor(options.seed as number)
    : 42;

  const outputDirectory = options.outputDirectory ?? RESULTS_DIRECTORY;
  await mkdir(outputDirectory, { recursive: true });

  const startedAt = Date.now();
  const pilotId = `pilot-${formatIsoForId(startedAt)}`;

  console.log(`[run-pilot] Starting pilot batch ${pilotId}`);
  console.log(
    `[run-pilot] Configuration -> models=${uniqueModels.join(", ")}, runsPerCondition=${runsPerCondition}, seed=${seed}`,
  );
  console.log(`[run-pilot] Output directory -> ${outputDirectory}`);

  const resolvedRateLimit: RateLimitConfig = {
    ...DEFAULT_RATE_LIMIT,
    ...(options.rateLimit ?? {}),
  };

  const limiter = new RateLimiter(resolvedRateLimit);
  const rng = createSeededRandom(seed);

  const batches: ExperimentBatch[] = [];
  const trialFiles: string[] = [];
  const trialFilesByBatchId = new Map<string, string[]>();

  for (const modelName of uniqueModels) {
    const batchStartedAt = Date.now();
    const batchId = `${pilotId}--${sanitizeFilenameSegment(modelName)}`;
    trialFilesByBatchId.set(batchId, []);

    console.log(`[run-pilot] Running model ${modelName}`);

    const languageModel = createLanguageModel(modelName);
    const config: CooperationConfig = {
      ...DEFAULT_CONFIG,
      ...options.configOverrides,
      model: modelName,
    };

    const results: GameResult[] = [];

    for (const condition of PILOT_CONDITIONS) {
      for (let runIndex = 1; runIndex <= runsPerCondition; runIndex += 1) {
        const prompts = generateScenario(condition, rng);
        const prompt = buildPilotPrompt({
          pilotId,
          modelName,
          condition,
          runIndex,
          prompts,
        });

        const responseText = await callOpenRouter(
          languageModel,
          prompt,
          limiter,
          config,
        );

        const extraction = extractDecision(responseText);
        const timestamp = Date.now();
        const gameResult: GameResult = {
          model: modelName,
          condition,
          decision: extraction.decision,
          response: responseText,
          timestamp,
          runIndex,
          batchId,
        };
        results.push(gameResult);

        const filePath = await persistPilotTrial(
          outputDirectory,
          pilotId,
          modelName,
          condition,
          runIndex,
          gameResult,
        );

        trialFiles.push(filePath);
        trialFilesByBatchId.get(batchId)?.push(filePath);

        const decisionLabel = extraction.decision ?? "NO_MATCH";
        console.log(
          `[run-pilot] ${modelName} :: ${formatConditionLabel(condition)} :: run ${runIndex} -> ${decisionLabel}`,
        );
      }
    }

    const completedAt = Date.now();
    const unmatchedCount = results.reduce(
      (total, result) => total + (result.decision === null ? 1 : 0),
      0,
    );

    const batch: ExperimentBatch = {
      id: batchId,
      model: modelName,
      results,
      startedAt: batchStartedAt,
      completedAt,
      seed,
      runsPerCondition,
      totalTrials: results.length,
      trialFilePaths: trialFilesByBatchId.get(batchId),
    };
    batches.push(batch);

    console.log(
      `[run-pilot] Completed ${modelName} -> trials=${results.length}, unmatched=${unmatchedCount}`,
    );
  }

  const completedAt = Date.now();
  const summary = createDecisionSummary(batches, runsPerCondition);

  const manifest: PilotManifest = {
    pilot: {
      id: pilotId,
      seed,
      runsPerCondition,
      models: uniqueModels,
      totalTrials: summary.totalTrials,
      startedAt,
      completedAt,
      outputDirectory,
    },
    batches: batches.map((batch) => ({
      batch,
      trialFiles: trialFilesByBatchId.get(batch.id) ?? [],
    })),
    summaryFile: `${pilotId}-summary.json`,
    warnings: summary.warnings,
  };

  const manifestPath = join(outputDirectory, `${pilotId}-manifest.json`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  const summaryPath = join(outputDirectory, manifest.summaryFile);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  for (const warning of summary.warnings) {
    console.warn(`[run-pilot] WARNING: ${warning}`);
  }

  console.log(
    `[run-pilot] Completed pilot batch ${pilotId} -> trials=${summary.totalTrials}. Manifest=${manifestPath}. Summary=${summaryPath}.`,
  );

  return {
    manifestPath,
    summaryPath,
    manifest,
    summary,
    batches,
    warnings: summary.warnings,
    trialFiles,
  };
}

export async function verifyIntegration(
  condition: Condition = { symmetry: "high", coupling: "present" },
  prompt: string = DEFAULT_PROMPT,
  config: CooperationConfig = DEFAULT_CONFIG,
  rateLimit: RateLimitConfig = DEFAULT_RATE_LIMIT,
): Promise<IntegrationResult> {
  assertEnvironmentVariables();

  const model = createLanguageModel(config.model);
  const limiter = new RateLimiter(rateLimit);

  try {
    const response = await callOpenRouter(model, prompt, limiter, config);
    const extraction = extractDecision(response);
    const agentResponse: AgentResponse = {
      decision: extraction.decision,
      rawText: response,
    };
    const result: GameResult = {
      model: config.model,
      condition,
      decision: agentResponse.decision,
      response: agentResponse.rawText,
      timestamp: Date.now(),
    };
    await persistResult(result);

    const decisionLabel = agentResponse.decision ?? "NO_MATCH";
    console.log(`[cooperation] OpenRouter call succeeded with decision ${decisionLabel}`);

    return {
      ok: agentResponse.decision !== null,
      response: agentResponse,
    };
  } catch (error) {
    console.error("[cooperation] OpenRouter verification failed", error);
    throw error;
  }
}

if (import.meta.main) {
  const [, , command = "verify", ...rest] = process.argv;

  if (command === "run-pilot") {
    const options: PilotRunOptions = {};

    for (const arg of rest) {
      if (arg.startsWith("--models=")) {
        const value = arg.slice("--models=".length);
        options.models = value
          .split(",")
          .map((model) => model.trim())
          .filter((model) => model.length > 0);
      } else if (arg.startsWith("--runs=")) {
        const value = Number(arg.slice("--runs=".length));
        if (Number.isFinite(value)) {
          options.runsPerCondition = value;
        }
      } else if (arg.startsWith("--seed=")) {
        const value = Number(arg.slice("--seed=".length));
        if (Number.isFinite(value)) {
          options.seed = value;
        }
      } else if (arg.startsWith("--output=")) {
        const value = arg.slice("--output=".length).trim();
        if (value.length > 0) {
          options.outputDirectory = value;
        }
      }
    }

    runPilotExperiment(options)
      .then(({ manifestPath, summaryPath }) => {
        console.log(`[run-pilot] Manifest saved -> ${manifestPath}`);
        console.log(`[run-pilot] Summary saved -> ${summaryPath}`);
      })
      .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      });
  } else if (command === "analyze-pilot") {
    let manifestPath: string | undefined;
    let outputDirectory: string | undefined;
    let silent = false;

    for (const arg of rest) {
      if (arg.startsWith("--manifest=")) {
        const value = arg.slice("--manifest=".length).trim();
        if (value.length > 0) {
          manifestPath = value;
        }
      } else if (arg.startsWith("--output=")) {
        const value = arg.slice("--output=".length).trim();
        if (value.length > 0) {
          outputDirectory = value;
        }
      } else if (arg === "--silent") {
        silent = true;
      }
    }

    (async () => {
      let resolvedManifest = manifestPath;
      if (!resolvedManifest) {
        const detected = await findLatestManifest(RESULTS_DIRECTORY);
        if (!detected) {
          console.error(
            `[analyze-pilot] Unable to locate a pilot manifest under ${RESULTS_DIRECTORY}. Pass --manifest=<path>.`,
          );
          process.exitCode = 1;
          return;
        }
        resolvedManifest = detected;
        if (!silent) {
          console.log(`[analyze-pilot] Auto-selected manifest -> ${detected}`);
        }
      }

      try {
        const report = await generateAnalysisReport({
          manifestPath: resolvedManifest,
          outputDirectory,
          silent,
        });

        if (report.warnings.length > 0) {
          console.warn(
            `[analyze-pilot] ${report.warnings.length} threshold breach(s) detected.`,
          );
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    })().catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  } else if (command === "preview-scenarios") {
    let seed: number | undefined;
    let echo = false;

    for (const arg of rest) {
      if (arg.startsWith("--seed=")) {
        const value = Number(arg.slice("--seed=".length));
        if (Number.isFinite(value)) {
          seed = value;
        }
      }
      if (arg === "--echo") {
        echo = true;
      }
    }

    renderScenarioPreviews({ seed, echo }).catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  } else {
    verifyIntegration().catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}
