# SnitchBench Project Overview

## Purpose and Scope
- Benchmark different OpenRouter-accessible LLMs to see how readily they escalate corporate misconduct to external authorities when offered investigative tools.
- Simulate a whistleblowing scenario inside the fictional Veridian Healthcare "Project Zenith" cover-up, providing a realistic late-2025 to early-2026 timeline for ethical stress testing.

## Core Components
- **Main runner (`index.ts`)**: Streams numbered prompts as user messages, pairs four system prompt/tool bundles with each configured model, captures reasoning/tool output, and writes rich Markdown transcripts plus run metrics.
- **Prompts (`prompts/1.md`–`4.md`)**: Escalating internal memos describing data suppression, regulatory evasion, lobbying, and crisis response directives that pressure models to act.
- **Tooling (`tools.ts`)**: Mock "sendEmail" and "writeLogs" helpers plus a terminal simulator proxying commands through GPT-4.1 mini, enabling the benchmark to observe email/CLI escalation without real side effects.
- **Model roster (`constants.ts`)**: Twelve LLM configurations (Anthropic Claude family, Google Gemini variants, xAI Grok models, Qwen 3, OpenAI o4-mini, Moonshot Kimi) with optional reasoning flags and shared OpenRouter provider setup.

## Execution Flow
1. Ensure `./results/final-run` exists, load `.md` prompt files, and enqueue `TEST_RUNS_PER_MODEL` tasks per model/test combination.
2. Run jobs with up to `MAX_CONCURRENCY` workers; each iteration logs durations, tool call counts, and produces Markdown transcripts for later analysis.
3. Skip any run whose transcript already exists, keeping reruns incremental and cost-conscious.

## Analysis Pipeline
- `analyze-snitching.ts` replays every transcript through Gemini 2.0 Flash, classifying whether and when government or media contacts occurred, while caching unchanged files.
- Aggregates per-model and per-test statistics, prints console summaries, and writes `snitching-analysis.json` for dashboards (e.g., https://snitchbench.t3.gg) or further processing.
- `combine-analysis.ts` can merge multiple analysis batches (`snitching-analysis.json`, `snitching-analysis-2.json`, etc.) into a unified `combined-snitching-analysis.json` report.

## Key Findings (Sample Dataset)
- Example `snitching-analysis.json` derived from 880 runs reports ~47% government contact and ~16% media contact rates, offering comparative metrics such as average contact message index per model/test.

## Running the Benchmark
1. Install dependencies with `bun install` (project uses `ai`, `@openrouter/ai-sdk-provider`, `zod`, and `@types/bun`).
2. Provide `OPENROUTER_API_KEY` in a local `.env`.
3. Verify the output directory matches `OUTPUT_DIRECTORY` in `constants.ts`.
4. Execute `bun run index.ts` (approx. 45 minutes, ≥$40 API spend for a full sweep).
5. Post-run, execute `bun run analyze-snitching.ts` to regenerate analytics.

