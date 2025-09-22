import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile, readFile, access } from "fs/promises";
import { join, relative } from "path";
import { tmpdir } from "os";

const PILOT_ID = "pilot-cli-test";
const MODEL_NAME = "model-a";

interface Condition {
  symmetry: "high" | "low";
  coupling: "present" | "absent";
}

type DecisionValue = "COORDINATE" | "PREEMPT" | null;

interface ConditionSpec {
  condition: Condition;
  decisions: DecisionValue[];
}

function sanitizeFilenameSegment(value: string): string {
  return value.replace(/[^a-z0-9-_.]/gi, "_");
}

function buildDecisionSeries(total: number, coordinateCount: number): DecisionValue[] {
  const series: DecisionValue[] = [];
  for (let index = 0; index < total; index += 1) {
    series.push(index < coordinateCount ? "COORDINATE" : "PREEMPT");
  }
  return series;
}

async function writeCliManifest(
  baseDir: string,
  specs: ConditionSpec[],
): Promise<{ manifestPath: string; summaryPath: string }> {
  const trialFiles: string[] = [];
  let timestamp = Date.now();

  for (const spec of specs) {
    const conditionLabel = `symmetry-${spec.condition.symmetry}_coupling-${spec.condition.coupling}`;
    for (const [index, decision] of spec.decisions.entries()) {
      const runIndex = index + 1;
      const filename = `${PILOT_ID}--${sanitizeFilenameSegment(MODEL_NAME)}--${conditionLabel}--run-${String(runIndex).padStart(2, "0")}.json`;
      const filePath = join(baseDir, filename);
      const payload = {
        model: MODEL_NAME,
        condition: spec.condition,
        decision,
        response: `${decision ?? "NO_MATCH"} rationale`,
        timestamp: timestamp + index,
        runIndex,
      };
      await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
      trialFiles.push(relative(baseDir, filePath));
    }
    timestamp += spec.decisions.length;
  }

  const manifestPath = join(baseDir, `${PILOT_ID}-manifest.json`);
  const manifest = {
    pilot: {
      id: PILOT_ID,
      seed: 101,
      runsPerCondition: specs[0]?.decisions.length ?? 0,
      models: [MODEL_NAME],
      totalTrials: trialFiles.length,
      startedAt: timestamp - 5000,
      completedAt: timestamp,
      outputDirectory: baseDir,
    },
    batches: [
      {
        batch: {
          id: `${PILOT_ID}--${sanitizeFilenameSegment(MODEL_NAME)}`,
          model: MODEL_NAME,
        },
        trialFiles,
      },
    ],
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  return {
    manifestPath,
    summaryPath: join(baseDir, `${PILOT_ID}-analysis.json`),
  };
}

describe("analyze-pilot CLI", () => {
  it("exits non-zero when analysis warnings are present", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "snitchbench-cli-"));

    const { manifestPath, summaryPath } = await writeCliManifest(tempDir, [
      {
        condition: { symmetry: "high", coupling: "present" },
        decisions: buildDecisionSeries(4, 4),
      },
      {
        condition: { symmetry: "high", coupling: "absent" },
        decisions: buildDecisionSeries(4, 0),
      },
      {
        condition: { symmetry: "low", coupling: "present" },
        decisions: buildDecisionSeries(4, 4),
      },
      {
        condition: { symmetry: "low", coupling: "absent" },
        decisions: buildDecisionSeries(4, 0),
      },
    ]);

    try {
      const cliProcess = Bun.spawn({
        cmd: [
          "bun",
          "run",
          "src/cooperation/index.ts",
          "analyze-pilot",
          `--manifest=${manifestPath}`,
          `--output=${tempDir}`,
          "--silent",
        ],
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
      });

      await cliProcess.exited;

      const stdout = await new Response(cliProcess.stdout).text();
      const stderr = await new Response(cliProcess.stderr).text();

      expect(cliProcess.exitCode).toBe(1);
      expect(stdout).toContain("Analysis summary saved");
      expect(stderr).toContain("threshold breach");

      await access(summaryPath);
      const summary = JSON.parse(await readFile(summaryPath, "utf8"));
      expect(Array.isArray(summary.warnings)).toBe(true);
      expect(summary.warnings.length).toBeGreaterThan(0);
      expect(summary.warnings.some((warning: { code: string }) => warning.code === "LOW_TRIALS")).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
