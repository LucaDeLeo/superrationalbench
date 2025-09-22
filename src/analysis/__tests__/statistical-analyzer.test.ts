import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join, relative } from "path";
import { tmpdir } from "os";

import { analyzePilotManifest } from "../statistical-analyzer";

const NOW = Date.now();

type DecisionValue = "COORDINATE" | "PREEMPT" | null;

interface ConditionSpec {
  condition: {
    symmetry: "high" | "low";
    coupling: "present" | "absent";
  };
  decisions: DecisionValue[];
}

function sanitizeFilenameSegment(value: string): string {
  return value.replace(/[^a-z0-9-_.]/gi, "_");
}

function buildDecisionSeries(
  total: number,
  coordinateCount: number,
  unmatchedCount = 0,
): DecisionValue[] {
  const matched = total - unmatchedCount;
  if (coordinateCount > matched) {
    throw new Error("coordinateCount cannot exceed matched trials");
  }
  const series: DecisionValue[] = [];
  for (let index = 0; index < coordinateCount; index += 1) {
    series.push("COORDINATE");
  }
  for (let index = 0; index < matched - coordinateCount; index += 1) {
    series.push("PREEMPT");
  }
  for (let index = 0; index < unmatchedCount; index += 1) {
    series.push(null);
  }
  return series;
}

async function writePilotManifest(
  tempDir: string,
  conditionSpecs: ConditionSpec[],
  options: { model?: string; pilotId?: string; runsPerCondition?: number } = {},
): Promise<string> {
  const pilotId = options.pilotId ?? "pilot-test";
  const modelName = options.model ?? "model-a";
  const runsPerCondition =
    options.runsPerCondition ??
    Math.max(...conditionSpecs.map((spec) => spec.decisions.length));

  const trialFiles: string[] = [];
  let timestampOffset = 0;

  for (const spec of conditionSpecs) {
    const conditionLabel = `symmetry-${spec.condition.symmetry}_coupling-${spec.condition.coupling}`;
    for (const [index, decision] of spec.decisions.entries()) {
      const runIndex = index + 1;
      const filename = `${pilotId}--${sanitizeFilenameSegment(modelName)}--${conditionLabel}--run-${String(runIndex).padStart(2, "0")}.json`;
      const filePath = join(tempDir, filename);
      const payload = {
        model: modelName,
        condition: spec.condition,
        decision,
        response:
          decision === null ? "NO_MATCH" : `${decision} rationale`,
        timestamp: NOW + timestampOffset,
        runIndex,
      };
      timestampOffset += 1;

      trialFiles.push(relative(tempDir, filePath));
      await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
    }
  }

  const manifestPath = join(tempDir, `${pilotId}-manifest.json`);
  const manifest = {
    pilot: {
      id: pilotId,
      seed: 42,
      runsPerCondition,
      models: [modelName],
      totalTrials: trialFiles.length,
      startedAt: NOW - 5000,
      completedAt: NOW,
      outputDirectory: tempDir,
    },
    batches: [
      {
        batch: {
          id: `${pilotId}--${sanitizeFilenameSegment(modelName)}`,
          model: modelName,
        },
        trialFiles,
      },
    ],
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  return manifestPath;
}

describe("analyzePilotManifest", () => {
  it("aggregates cooperation metrics from persisted trial files", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pilot-analysis-"));

    const manifestPath = await writePilotManifest(tempDir, [
      {
        condition: { symmetry: "high", coupling: "present" },
        decisions: buildDecisionSeries(10, 9),
      },
      {
        condition: { symmetry: "high", coupling: "absent" },
        decisions: buildDecisionSeries(10, 8),
      },
      {
        condition: { symmetry: "low", coupling: "present" },
        decisions: buildDecisionSeries(10, 3),
      },
      {
        condition: { symmetry: "low", coupling: "absent" },
        decisions: buildDecisionSeries(10, 2),
      },
    ]);

    try {
      const summary = await analyzePilotManifest(manifestPath);

      expect(summary.totals.totalTrials).toBe(40);
      expect(summary.totals.matchedTrials).toBe(40);
      expect(summary.totals.coverage).toBeCloseTo(1, 5);
      expect(summary.models).toHaveLength(1);
      expect(
        summary.models[0].conditions["symmetry-high_coupling-present"].cooperationRate,
      ).toBeCloseTo(0.9, 5);
      expect(summary.factorEffects).toHaveLength(2);
      expect(summary.factorEffects[0].factor).toBe("symmetry");
      expect(summary.factorEffects[0].effectSize).toBeLessThan(0);
      expect(summary.warnings.some((warning) => warning.code === "LOW_TRIALS")).toBe(
        true,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("emits LOW_TRIALS warnings when total analyzed volume is below threshold", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pilot-analysis-"));

    const manifestPath = await writePilotManifest(tempDir, [
      {
        condition: { symmetry: "high", coupling: "present" },
        decisions: buildDecisionSeries(5, 5),
      },
      {
        condition: { symmetry: "high", coupling: "absent" },
        decisions: buildDecisionSeries(5, 0),
      },
      {
        condition: { symmetry: "low", coupling: "present" },
        decisions: buildDecisionSeries(5, 5),
      },
      {
        condition: { symmetry: "low", coupling: "absent" },
        decisions: buildDecisionSeries(5, 0),
      },
    ]);

    try {
      const summary = await analyzePilotManifest(manifestPath);
      const lowTrialWarnings = summary.warnings.filter(
        (warning) => warning.code === "LOW_TRIALS",
      );

      expect(summary.totals.totalTrials).toBe(20);
      expect(lowTrialWarnings.length).toBeGreaterThanOrEqual(2);
      expect(
        lowTrialWarnings.some((warning) => warning.scope.type === "overall"),
      ).toBe(true);
      expect(
        lowTrialWarnings.some((warning) => warning.scope.type === "model"),
      ).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("flags LOW_COVERAGE warnings when unmatched decisions exceed 5%", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pilot-analysis-"));

    const manifestPath = await writePilotManifest(tempDir, [
      {
        condition: { symmetry: "high", coupling: "present" },
        decisions: buildDecisionSeries(10, 7, 1),
      },
      {
        condition: { symmetry: "high", coupling: "absent" },
        decisions: buildDecisionSeries(10, 6, 1),
      },
      {
        condition: { symmetry: "low", coupling: "present" },
        decisions: buildDecisionSeries(10, 7, 1),
      },
      {
        condition: { symmetry: "low", coupling: "absent" },
        decisions: buildDecisionSeries(10, 6, 1),
      },
    ]);

    try {
      const summary = await analyzePilotManifest(manifestPath);
      const coverageWarnings = summary.warnings.filter(
        (warning) => warning.code === "LOW_COVERAGE",
      );

      expect(coverageWarnings.length).toBeGreaterThanOrEqual(2);
      expect(
        coverageWarnings.some((warning) => warning.scope.type === "overall"),
      ).toBe(true);
      expect(
        coverageWarnings.some((warning) => warning.scope.type === "model"),
      ).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("signals SMALL_EFFECT warnings when factor and interaction deltas stay under threshold", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pilot-analysis-"));

    const balancedDecisions = buildDecisionSeries(30, 15);
    const manifestPath = await writePilotManifest(
      tempDir,
      [
        {
          condition: { symmetry: "high", coupling: "present" },
          decisions: balancedDecisions,
        },
        {
          condition: { symmetry: "high", coupling: "absent" },
          decisions: balancedDecisions,
        },
        {
          condition: { symmetry: "low", coupling: "present" },
          decisions: balancedDecisions,
        },
        {
          condition: { symmetry: "low", coupling: "absent" },
          decisions: balancedDecisions,
        },
      ],
      { runsPerCondition: 30 },
    );

    try {
      const summary = await analyzePilotManifest(manifestPath);
      const factorWarnings = summary.warnings.filter(
        (warning) => warning.code === "SMALL_EFFECT" && warning.scope.type === "factor",
      );
      const interactionWarnings = summary.warnings.filter(
        (warning) => warning.code === "SMALL_EFFECT" && warning.scope.type === "interaction",
      );

      expect(summary.totals.totalTrials).toBe(120);
      expect(factorWarnings.length).toBeGreaterThanOrEqual(2);
      expect(interactionWarnings.length).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
