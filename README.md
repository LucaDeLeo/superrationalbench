# SnitchBench

This is a repo I made to test how aggressively different AI models will "snitch" on you, as in hit up the FBI/FDA/media given bad behaviors and various tools.

Learn more in my YouTube video all about SnitchBench and the reasons why I made it:
[![SnitchBench: Testing AI Model Snitching Behavior](https://img.youtube.com/vi/RzPSs6bLrms/0.jpg)](https://www.youtube.com/watch?v=RzPSs6bLrms)

## Results

Full YouTube video breakdown coming soon. I included a [JSON breakdown here if you want to see](./snitching-analysis.json).

Also threw together a crappy visualization with V0 here: [https://snitchbench.t3.gg](https://snitchbench.t3.gg)

## Run it yourself

If you want to see the results, not too hard to run! Be warned, this will cost at least $40 to run. I AM NOT RESPONSIBLE FOR ANY BILLS YOU INCUR OR BANS YOU GET FROM DIFFERENT PROVIDERS FOR RUNNING THIS CODE.

### Preview the CIRRUS-24 cooperation scenarios

- Generate deterministic CIRRUS-24 bulletins for all four pilot conditions with `bun run src/cooperation/index.ts preview-scenarios`
- Open one high-symmetry and one low-symmetry file under `scenarios/cvd/` and confirm the symmetry line and coupling cue match expectations
- Re-run with `--seed=<number>` (defaults to `42`) to rotate incident flavor text without breaking reproducibility, e.g. `bun run src/cooperation/index.ts preview-scenarios --seed=1337`
- Keep the same SeededRandom seed when you move from preview to full runs so the prompts and downstream decisions line up across reruns
- Manual review is required for this generator; no automated tests assert the toggle phrasing, so inspect the previews before launching experiments

### Run the cooperation pilot

- Ensure `OPENROUTER_API_KEY` is set in your environment (dry runs still need a placeholder)
- Kick off the pilot batch with defaults (Gemini Flash lineup, 10 runs per condition, seed 42):
  - `bun run src/cooperation/index.ts run-pilot`
- Override the model roster, runs, or seed as needed:
  - `bun run src/cooperation/index.ts run-pilot --models="anthropic/claude-3.5-sonnet,google/gemini-2.0-flash-001,anthropic/claude-3.7-sonnet" --runs=5 --seed=1337`
- Results land under `results/cooperation/` including per-trial JSON files, a manifest, and summary coverage report for quick QA

### Analyze pilot cooperation results

- After a pilot batch finishes, run `bun run src/cooperation/index.ts analyze-pilot` to generate pooled cooperation rates, confidence intervals, and effect sizes from the persisted trial files
- The analyzer auto-selects the most recent pilot manifest under `results/cooperation/`; pass `--manifest=<path>` if you want to target a specific run or a nested directory
- Use `--output=<directory>` to redirect where the analysis summary is written (defaults to the pilot output directory); add `--silent` to skip the metric breakdown while still emitting threshold warnings and the saved-summary path for scripting
- The command exits with a non-zero status when success criteria thresholds fail (trial count < 120, coverage < 95%, or effect size < 0.5) so CI/QA flows can halt on regressions

### Run the main test

1. Install packages with `bun install`
2. Create a `.env` file with your OpenRouter API key

```bash
OPENROUTER_API_KEY=your-api-key
```

3. Make sure you have the directory in [constants.ts](./constants.ts) already created (default is `./results/final-run`)

4. Run the script with `bun run index.ts` (takes about 45 minutes)

### Run the analysis

After running the tests and generating results, you can run the analysis (powered by Gemini 2.0 Flash) with `bun run analyze-snitching.ts`.
