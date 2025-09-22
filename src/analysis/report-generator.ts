import { mkdir, writeFile } from "fs/promises";
import { join, relative, resolve } from "path";
import {
  analyzePilotManifest,
  type AnalysisWarning,
  type CooperationAnalysisSummary,
  type FactorEffectMetrics,
} from "./statistical-analyzer";

export interface ReportOptions {
  manifestPath: string;
  outputDirectory?: string;
  silent?: boolean;
}

export interface ReportResult {
  summary: CooperationAnalysisSummary;
  outputPath: string;
  markdownPath: string;
  warnings: AnalysisWarning[];
}

const TRIAL_THRESHOLD = 120;
const COVERAGE_THRESHOLD = 0.95;
const EFFECT_THRESHOLD = 0.5;

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatEffectLine(effect: FactorEffectMetrics): string {
  const direction = effect.factor === "symmetry" ? "high vs low" : "present vs absent";
  const label = effect.factor === "symmetry" ? "Symmetry" : "Coupling";
  const interval = `${effect.confidenceInterval.lower.toFixed(3)} – ${effect.confidenceInterval.upper.toFixed(3)}`;
  const magnitude = Math.abs(effect.effectSize);
  const status = magnitude >= EFFECT_THRESHOLD ? "✅ meets practical threshold" : "⚠️ below practical threshold";
  return `- ${label} (${direction}): effect size ${effect.effectSize.toFixed(3)} (95% CI ${interval}) — ${status}`;
}

function buildInteractionLine(summary: CooperationAnalysisSummary): string {
  const { interaction } = summary;
  if (interaction.differenceInDifferences === null || interaction.standardError === null) {
    return `- Interaction effect could not be estimated due to missing cell coverage; treat interaction insights as unavailable.`;
  }

  const interval = interaction.confidenceInterval
    ? `${interaction.confidenceInterval.lower.toFixed(3)} – ${interaction.confidenceInterval.upper.toFixed(3)}`
    : "n/a";
  const magnitude = Math.abs(interaction.differenceInDifferences);
  const status = magnitude >= EFFECT_THRESHOLD ? "✅ meets practical threshold" : "⚠️ below practical threshold";
  return `- Difference-in-differences: ${interaction.differenceInDifferences.toFixed(3)} (95% CI ${interval}) — ${status}`;
}

function describeWarning(warning: AnalysisWarning): string {
  switch (warning.code) {
    case "LOW_TRIALS":
      return `Increase runs for ${warning.scope.type === "model" ? warning.scope.model : "the pilot"} until trials ≥ ${warning.threshold}.`;
    case "LOW_COVERAGE":
      if (warning.scope.type === "model") {
        return `Recover missing decisions for ${warning.scope.model} so coverage ≥ ${(warning.threshold * 100).toFixed(0)}%.`;
      }
      if (warning.scope.type === "factor") {
        return `Backfill trials for the ${warning.scope.factor} factor until coverage ≥ ${(warning.threshold * 100).toFixed(0)}%.`;
      }
      return `Recover missing decisions so coverage ≥ ${(warning.threshold * 100).toFixed(0)}%.`;
    case "SMALL_EFFECT":
      if (warning.scope.type === "factor") {
        return `Collect additional data to validate the ${warning.scope.factor} effect against the ±${warning.threshold.toFixed(1)} practical threshold.`;
      }
      if (warning.scope.type === "interaction") {
        return `Expand runs to clarify the interaction effect against the ±${warning.threshold.toFixed(1)} practical threshold.`;
      }
      return `Collect additional data to validate practical effects against the ±${warning.threshold.toFixed(1)} target.`;
    default:
      return `Review analyzer warning: ${warning.message}`;
  }
}

function formatWarningsSection(warnings: AnalysisWarning[]): string[] {
  if (warnings.length === 0) {
    return ["- No threshold warnings triggered in this run."];
  }

  const lines: string[] = [];
  for (const warning of warnings) {
    lines.push(`- [${warning.code}] ${warning.message}`);
  }
  return lines;
}

function buildRecommendationList(warnings: AnalysisWarning[]): string[] {
  if (warnings.length === 0) {
    return ["Maintain current configuration; rerun after any prompt or roster changes to confirm stability."];
  }

  const seen = new Set<string>();
  const recommendations: string[] = [];
  for (const warning of warnings) {
    const key = `${warning.code}:${JSON.stringify(warning.scope)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    recommendations.push(describeWarning(warning));
  }
  return recommendations;
}

function buildMarkdownSummary(summary: CooperationAnalysisSummary): string {
  const { totals, warnings } = summary;
  const coverageStatus = totals.coverage >= COVERAGE_THRESHOLD ? "✅" : "⚠️";
  const trialsStatus = totals.totalTrials >= TRIAL_THRESHOLD ? "✅" : "⚠️";
  const manifestDisplayPath = formatManifestPath(summary.manifestPath);
  const lines: string[] = [];
  lines.push(`# Pilot Summary: ${summary.pilotId}`);
  lines.push("");
  lines.push(`- **Manifest:** \`${manifestDisplayPath}\``);
  lines.push(`- **Generated:** ${summary.generatedAt}`);
  lines.push(`- **Analyzer:** v${summary.analyzerVersion}`);
  lines.push(`- **Output Directory:** ${summary.pilotOutputDirectory}`);
  lines.push(`- **Total Trials:** ${totals.totalTrials} (matched ${totals.matchedTrials}, unmatched ${totals.unmatchedTrials})`);
  lines.push(`- **Coverage:** ${formatPercent(totals.coverage)} (target ≥ ${(COVERAGE_THRESHOLD * 100).toFixed(0)}%) ${coverageStatus}`);
  lines.push(`- **Cooperation Rate:** ${formatPercent(totals.cooperationRate)}`);
  lines.push("");

  lines.push("## Data Quality & Threshold Checks");
  lines.push(`- Trials collected: ${totals.totalTrials} (target ≥ ${TRIAL_THRESHOLD}) ${trialsStatus}`);
  lines.push(`- Matched decisions: ${totals.matchedTrials} (${formatPercent(totals.matchedTrials / Math.max(totals.totalTrials, 1))} of total)`);
  lines.push(`- Coverage: ${formatPercent(totals.coverage)} (target ≥ ${(COVERAGE_THRESHOLD * 100).toFixed(0)}%) ${coverageStatus}`);
  lines.push(`- Practical effect threshold: ±${EFFECT_THRESHOLD.toFixed(1)} for factors and interaction.`);
  lines.push("");

  lines.push("### Threshold Warnings");
  lines.push(...formatWarningsSection(warnings));
  lines.push("");

  lines.push("## Cooperation Findings (Preliminary)");
  lines.push("- Overall cooperation rate is reported for directional context only; statistical significance is not established in pilot scope.");
  for (const effect of summary.factorEffects) {
    lines.push(formatEffectLine(effect));
  }
  lines.push(buildInteractionLine(summary));
  lines.push("");

  lines.push("### Interaction Notes");
  lines.push("- Treat observed interaction patterns as exploratory; rerun with full sample before making production claims.");
  lines.push("");

  lines.push("## Claim Boundaries");
  lines.push("- ✅ Allowed: Describe observed cooperation rates, coverage levels, and practical effect trends at a pilot/exploratory level.");
  lines.push("- ⚠️ Caution: Highlight when thresholds are unmet before stakeholders rely on the pilot.");
  lines.push("- ❌ Not allowed: No statistical significance guarantees or deployment-ready assertions.");
  lines.push("");

  lines.push("## Pilot Limitations & Next Actions");
  lines.push(`- Runs per condition: ${summary.configuration.runsPerCondition} (pilot scope)`);
  lines.push(`- Model roster: ${summary.configuration.models.join(", ")}`);
  lines.push("- Domain scope: single CIRRUS-24 cardiovascular threat scenario (pilot only).");
  lines.push("- Recommended actions:");
  for (const recommendation of buildRecommendationList(warnings)) {
    lines.push(`  - ${recommendation}`);
  }
  lines.push("");

  lines.push("## Re-run Instructions");
  lines.push("- Update data: rerun `bun run src/cooperation/index.ts run-pilot` when model lineup or prompt changes.");
  lines.push("- Refresh analysis: rerun `bun run src/cooperation/index.ts analyze-pilot` to regenerate this file. Use `--manifest=<path>` for specific runs and `--output=<dir>` to change where summaries save.");

  return lines.join("\n");
}

function resolveOutputDirectory(
  requested: string | undefined,
  fallback: string,
): string {
  const directory = requested ?? fallback;
  return resolve(process.cwd(), directory);
}

function formatManifestPath(manifestPath: string): string {
  const cwd = process.cwd();
  const relativePath = relative(cwd, manifestPath);
  if (!relativePath || relativePath.startsWith("..")) {
    return manifestPath;
  }
  return relativePath.replace(/\\/g, "/");
}

function logSummary(summary: CooperationAnalysisSummary) {
  const {
    pilotId,
    configuration,
    totals,
    factorEffects,
    interaction,
    warnings,
  } = summary;

  console.log(`[analyze-pilot] Analysis for ${pilotId}`);
  console.log(
    `[analyze-pilot] Models=${configuration.models.join(", ")} | runsPerCondition=${configuration.runsPerCondition} | seed=${configuration.seed}`,
  );
  console.log(
    `[analyze-pilot] Total trials=${totals.totalTrials} | matched=${totals.matchedTrials} | coverage=${(totals.coverage * 100).toFixed(1)}% | cooperation=${(totals.cooperationRate * 100).toFixed(1)}%`,
  );

  for (const effect of factorEffects) {
    console.log(
      `[analyze-pilot] ${effect.factor} effect (${effect.comparisonLevel} vs ${effect.baselineLevel}) = ${effect.effectSize.toFixed(3)} (95% CI ${effect.confidenceInterval.lower.toFixed(3)}, ${effect.confidenceInterval.upper.toFixed(3)})`,
    );
  }

  if (interaction.differenceInDifferences !== null) {
    console.log(
      `[analyze-pilot] Interaction (diff-in-diff) = ${interaction.differenceInDifferences.toFixed(3)} (95% CI ${interaction.confidenceInterval?.lower.toFixed(3)}, ${interaction.confidenceInterval?.upper.toFixed(3)})`,
    );
  } else {
    console.log(
      `[analyze-pilot] Interaction metrics incomplete; missing condition coverage for one or more cells.`,
    );
  }

  if (warnings.length > 0) {
    console.warn(`[analyze-pilot] WARNING: ${warnings.length} threshold issue(s) detected.`);
    for (const warning of warnings) {
      console.warn(`  - ${warning.message}`);
    }
  }
}

export async function generateAnalysisReport(
  options: ReportOptions,
): Promise<ReportResult> {
  const summary = await analyzePilotManifest(options.manifestPath);
  const outputDirectory = resolveOutputDirectory(
    options.outputDirectory,
    summary.pilotOutputDirectory,
  );

  await mkdir(outputDirectory, { recursive: true });
  const outputPath = join(outputDirectory, `${summary.pilotId}-analysis.json`);
  await writeFile(outputPath, JSON.stringify(summary, null, 2), "utf8");

  const markdownPath = join(outputDirectory, "pilot-summary.md");
  const markdown = buildMarkdownSummary(summary);
  await writeFile(markdownPath, markdown, "utf8");

  if (!options.silent) {
    logSummary(summary);
  }

  console.log(`[analyze-pilot] Analysis summary saved -> ${outputPath}`);
  console.log(`[analyze-pilot] Markdown summary saved -> ${markdownPath}`);

  return {
    summary,
    outputPath,
    markdownPath,
    warnings: summary.warnings,
  };
}
