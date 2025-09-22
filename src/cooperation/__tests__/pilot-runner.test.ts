import { describe, expect, it } from "bun:test";
import { join } from "path";
import { tmpdir } from "os";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";

import { runPilotExperiment } from "../index";

describe("runPilotExperiment", () => {
  it("writes manifest, summary, and trial files during dry runs", async () => {
    const originalApiKey = process.env.OPENROUTER_API_KEY;
    const originalDryRun = process.env.COOPERATION_DRY_RUN;

    const tempDir = await mkdtemp(join(tmpdir(), "snitchbench-pilot-"));
    const outputDir = join(tempDir, "results");

    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.COOPERATION_DRY_RUN = "1";

    const models = [
      "google/gemini-2.5-flash",
      "openai/gpt-5-mini",
      "meta-llama/llama-3.1-405b-instruct",
    ];

    try {
      const outcome = await runPilotExperiment({
        models,
        runsPerCondition: 1,
        seed: 101,
        outputDirectory: outputDir,
      });

      expect(outcome.batches).toHaveLength(models.length);
      expect(outcome.trialFiles.length).toBe(models.length * 4);

      const manifest = JSON.parse(await readFile(outcome.manifestPath, "utf8"));
      expect(manifest.pilot.models).toEqual(models);
      expect(manifest.pilot.runsPerCondition).toBe(1);
      for (const batchEntry of manifest.batches) {
        expect(batchEntry.trialFiles.length).toBe(4);
      }

      const summary = JSON.parse(await readFile(outcome.summaryPath, "utf8"));
      expect(summary.totalTrials).toBe(models.length * 4);
      expect(summary.warnings).toHaveLength(0);
      for (const model of models) {
        expect(summary.perModel[model].coverage).toBe(1);
      }

      const writtenFiles = await readdir(outputDir);
      const jsonCount = writtenFiles.filter((name) => name.endsWith(".json"));
      expect(jsonCount.length).toBe(models.length * 4 + 2);
    } finally {
      if (originalApiKey === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = originalApiKey;
      }

      if (originalDryRun === undefined) {
        delete process.env.COOPERATION_DRY_RUN;
      } else {
        process.env.COOPERATION_DRY_RUN = originalDryRun;
      }

      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
