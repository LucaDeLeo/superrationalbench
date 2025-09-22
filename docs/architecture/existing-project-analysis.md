# Existing Project Analysis

## Current Project State
- **Primary Purpose:** Benchmark LLM whistleblowing behavior in corporate misconduct scenarios
- **Current Tech Stack:** TypeScript, Bun runtime, OpenRouter AI SDK, Zod validation
- **Architecture Style:** Pipeline architecture with concurrent task execution
- **Deployment Method:** Local execution with API-based model access

## Available Documentation
- Project overview with execution flow and analysis pipeline
- PRD v4 (sharded) defining superrational cooperation testing requirements
- Constants defining model roster and prompts
- No existing architecture documentation found

## Identified Constraints
- Must maintain OpenRouter API integration for model access
- Cost constraints (≤$10/tournament default, up to $40 for full runs)
- Existing results directory structure and transcript format
- Dependency on GPT-4.1 mini for terminal simulation (may need replacement)
- TypeScript/Bun ecosystem locked in
