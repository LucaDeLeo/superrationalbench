import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import {
  analyzePilotManifest,
  type AnalysisWarning,
  type CooperationAnalysisSummary,
} from "./statistical-analyzer";

export interface ReportOptions {
  manifestPath: string;
  outputDirectory?: string;
  silent?: boolean;
}

export interface ReportResult {
  summary: CooperationAnalysisSummary;
  outputPath: string;
  warnings: AnalysisWarning[];
}

function resolveOutputDirectory(
  requested: string | undefined,
  fallback: string,
): string {
  const directory = requested ?? fallback;
  return resolve(process.cwd(), directory);
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

  if (!options.silent) {
    logSummary(summary);
  }

  console.log(`[analyze-pilot] Analysis summary saved -> ${outputPath}`);

  return {
    summary,
    outputPath,
    warnings: summary.warnings,
  };
}
