# Dev Debug Log

## 2025-09-22
- Attempted `OPENROUTER_API_KEY=dummy COOPERATION_DRY_RUN=1 bun src/cooperation/index.ts`
  - Result: Failed because dependency `ai` is not installed. Requires running `bun install` with network access.
- Ran `bun src/cooperation/index.ts` after installing deps and setting OpenRouter key
  - Result: Success. Received decision `COORDINATE` and persisted JSON result under `results/cooperation`.
- Ran `bun test src/cooperation/__tests__/seeded-random.test.ts`
  - Result: All SeededRandom deterministic helper tests passed.
- Ran `bun test`
  - Result: Regression suite remains green after cooperation type updates.
- Ran `bun test src/cooperation/__tests__/pilot-runner.test.ts`
  - Result: Dry-run pilot execution wrote manifest, summary, and 12 trial JSON files into a temp directory.
- Ran `bun test`
  - Result: Full cooperation test suite (SeededRandom + pilot runner) passed with dry-run OpenRouter responses.
- Updated pilot defaults to Gemini Flash lineup and reran `bun test`
  - Result: Suite remains green with dry-run coverage across new model roster.
