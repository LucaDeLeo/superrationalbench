# Superrational Cooperation Pilot

This repository runs a seeded 2×2 cooperation pilot that measures how large-language models behave under the CIRRUS-24 disclosure scenario. It orchestrates pilot batches end-to-end (scenario generation → model calls → manifest + metrics) and produces human-readable summaries that highlight thresholds, warnings, and limitations for stakeholders.

The benchmark now focuses exclusively on this cooperation workflow. Historical "SnitchBench" whistleblowing code and analyses have been removed so the repository tracks one clear experiment.

## Highlights

- **Deterministic pilot generator** – reproduces prompts across reruns with a single seed and a fixed roster of models.
- **CLI workflow** – `run-pilot`, `analyze-pilot`, and `preview-scenarios` live behind one entry point (`src/cooperation/index.ts`).
- **Threshold-aware analysis** – JSON + Markdown summaries surface low-trial, low-coverage, and small-effect warnings and drive exit codes for automation.
- **Lightweight cost profile** – defaults stay under the product goal of **<$3** per full pilot (
  3 models × 4 conditions × 10 runs, roughly 120 calls total).
- **Bun-native test suite** – fast deterministic tests cover the pilot runner, analyzer, and CLI paths.

## Repository Layout

```
src/
  cooperation/
    index.ts                 # CLI entry (preview, run-pilot, analyze-pilot)
    scenario-generator.ts    # Seeded prompt generation for CIRRUS-24
    types.ts                 # Shared interfaces for pilot artifacts
    seeded-random.ts         # Deterministic RNG utility
    __tests__/               # Bun tests (pilot runner + analyzer CLI)
  analysis/
    statistical-analyzer.ts  # Aggregates metrics + warnings from manifests
    report-generator.ts      # Writes JSON + Markdown summaries
results/cooperation/         # Default output directory for pilot artifacts
scenarios/cvd/               # Generated prompt previews for manual QA
```

Key specification documents live under `docs/` (`prd/pilot-study-scope-4-5-hour-implementation.md`, `architecture/quick-start-valid-experiment-in-4-5-hours.md`, and story files in `docs/stories/`).

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- TypeScript (via `peerDependencies`) – installed automatically when using Bun
- An OpenRouter account + API key for live model calls

Install dependencies once:

```bash
bun install
```

## Environment Variables

Create a `.env` (or export variables in your shell):

```bash
OPENROUTER_API_KEY=sk-or-your-key-here
# Optional: skip real model calls for development smoke tests
COOPERATION_DRY_RUN=1
```

When `COOPERATION_DRY_RUN=1`, the CLI simulates outputs while still writing manifests, summaries, and Markdown so tests remain representative without incurring cost.

## CLI Overview

Every command is issued through Bun:

```bash
bun run src/cooperation/index.ts <command> [options]
```

Supported commands:

- `preview-scenarios` – emit prompt previews for each condition.
- `run-pilot` – execute the full pilot workflow (model roster × conditions × runs).
- `analyze-pilot` – aggregate persisted trials and generate analysis artifacts.

Use `--help` with any command to inspect flags.

### Preview the CIRRUS-24 Prompts

```bash
bun run src/cooperation/index.ts preview-scenarios [--seed=1337] [--echo]
```

Artifacts land in `scenarios/cvd/`. Review at least one high- and low-symmetry file before launching a real run to validate the toggles.

### Run a Pilot Batch

```bash
bun run src/cooperation/index.ts run-pilot \
  [--models="google/gemini-2.5-flash,openai/gpt-5-mini,meta-llama/llama-3.1-405b-instruct"] \
  [--runs=10] \
  [--seed=42] \
  [--output=results/cooperation]
```

Default behaviour:

- Model roster: `google/gemini-2.5-flash`, `openai/gpt-5-mini`, and `meta-llama/llama-3.1-405b-instruct` (adjust to target different providers but keep 3–5 models to satisfy the pilot spec).
- Runs per condition: `10`, giving 120 total trials.
- Seed: `42` via the shared `SeededRandom`, ensuring reproducible scenarios across models.
- Output directory: `results/cooperation/` (created automatically).

Each model/condition trial writes JSON under `results/cooperation/`, plus a manifest and summary JSON (e.g., `pilot-<timestamp>-manifest.json`). Exit status is `0` for successful runs even if thresholds are later breached – threshold handling happens in analysis phase.

### Analyze a Pilot

```bash
bun run src/cooperation/index.ts analyze-pilot \
  [--manifest=results/cooperation/pilot-YYYY-MM-DDTHH-MM-SS-manifest.json] \
  [--output=results/cooperation] \
  [--silent]
```

- Auto-detects the most recent manifest if `--manifest` is omitted.
- Writes `<pilotId>-analysis.json` and `pilot-summary.md` to the chosen output directory.
- Returns exit code `1` when warnings are present (low trials, low coverage, or effect sizes below ±0.5). Treat this as a CI/QA gate.
- Markdown now records manifest paths relative to the repo root for portability when sharing artifacts.

### Reporting Workflow

The pilot spec targets a 4–5 hour loop:

1. `run-pilot` (collect new data)
2. `analyze-pilot` (aggregate metrics + warnings)
3. Share `results/cooperation/pilot-summary.md` — it includes:
   - Totals, coverage, effect sizes, and interaction insight (exploratory only)
   - Explicit threshold warnings & recommended follow-ups
   - Claim boundaries and pilot limitations (scope, roster, runs per condition)

Stick to the allowed claims documented in `docs/prd/pilot-study-scope-4-5-hour-implementation.md` (directional trends only; no statistical-significance guarantees).

## Testing

```bash
bun test
```

The suite covers:

- `run-pilot` dry-run behaviour and artifact generation
- Analyzer CLI exit codes + Markdown emission for both warning and success paths
- Statistical analyzer aggregation + warning detection
- RNG determinism utilities

Run tests before committing or after modifying CLI/analysis logic.

## Cost Guidance

- Default configuration (Gemini 2.5 Flash + GPT-5 mini + Llama 3.1 405B × 4 conditions × 10 runs) typically lands around **$1–$2 USD** per full live pilot, depending on actual token usage and provider pricing.
- The pilot gate requires total cost < **$3**; keeping default model/token footprints maintains ample headroom.
- Flip `COOPERATION_DRY_RUN=1` for rehearsal runs that exercise the pipeline without spending credits.

## Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| CLI exits immediately complaining about env vars | `OPENROUTER_API_KEY` missing | Add to `.env` or `export` in shell |
| `run-pilot` throws roster error | `--models` list includes <3 or >5 unique entries | Supply 3–5 distinct models |
| `analyze-pilot` exits with code 1 | Threshold warning triggered | Inspect `pilot-summary.md` and consider re-running with more trials or updated prompts |
| Manifest not found | No previous pilot run or wrong output path | Re-run `run-pilot` or point `--manifest` to an existing file |

## Governance & QA

- Story reviews and QA gate decisions live in `docs/stories/` and `docs/qa/gates/`.
- The current pilot story (1.7) contains the latest QA assessment, recommendations, and gate decision.

## Contributing

1. Fork or branch from `main`.
2. Keep changes scoped to cooperation pilot functionality.
3. Run `bun test` before submitting PRs.
4. Update relevant story files and QA gates when delivering feature work.

---

Need help or want to extend the experiment? Open an issue or start with the architecture quick-start guide under `docs/architecture/quick-start-valid-experiment-in-4-5-hours.md`.
