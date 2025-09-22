import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { generateText, type LanguageModelV1 } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type {
  AgentDecision,
  AgentResponse,
  Condition,
  CooperationConfig,
  DecisionExtractionResult,
  GameResult,
  IntegrationResult,
  RateLimitConfig,
} from "./types";

export { SeededRandom, createSeededRandom } from "./seeded-random";

const RESULTS_DIRECTORY = join("results", "cooperation");
const REQUIRED_ENV_VARS = ["OPENROUTER_API_KEY"] as const;

function readNumber(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readInteger(envKey: string, fallback: number): number {
  const value = readNumber(envKey, fallback);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

const DEFAULT_MODEL = process.env.COOPERATION_MODEL ?? "anthropic/claude-3.5-sonnet";
const DEFAULT_PROMPT =
  process.env.COOPERATION_TEST_PROMPT ??
  "You are simulating coordination under uncertainty. Reply with either COORDINATE or PREEMPT and include a one sentence rationale.";

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  minDelayMs: readInteger("COOPERATION_MIN_DELAY_MS", 100),
  maxRetries: readInteger("COOPERATION_MAX_RETRIES", 3),
  backoffBaseMs: readInteger("COOPERATION_BACKOFF_BASE_MS", 250),
  backoffFactor: readNumber("COOPERATION_BACKOFF_FACTOR", 2),
};

const DEFAULT_CONFIG: CooperationConfig = {
  model: DEFAULT_MODEL,
  maxOutputTokens: readInteger("COOPERATION_MAX_TOKENS", 800),
  temperature: readNumber("COOPERATION_TEMPERATURE", 0),
};

class RateLimiter {
  private lastInvocation = 0;

  constructor(private readonly config: RateLimitConfig) {}

  private async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async enforceMinimumDelay() {
    const now = Date.now();
    const elapsed = now - this.lastInvocation;
    if (elapsed < this.config.minDelayMs) {
      await this.delay(this.config.minDelayMs - elapsed);
    }
    this.lastInvocation = Date.now();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.config.maxRetries) {
      try {
        await this.enforceMinimumDelay();
        return await operation();
      } catch (error) {
        lastError = error;
        const backoff =
          this.config.backoffBaseMs *
          Math.pow(this.config.backoffFactor, attempt);
        console.warn(
          `[cooperation] OpenRouter request failed (attempt ${attempt + 1}/${
            this.config.maxRetries + 1
          }):`,
          error,
        );
        attempt += 1;
        if (attempt > this.config.maxRetries) {
          break;
        }
        await this.delay(backoff);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("OpenRouter call failed after retries");
  }
}

function assertEnvironmentVariables() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Check your .env configuration before running the cooperation runner.",
    );
  }
}

function createLanguageModel(modelName: string): LanguageModelV1 {
  return openrouter(modelName);
}

async function callOpenRouter(
  model: LanguageModelV1,
  prompt: string,
  limiter: RateLimiter,
  config: CooperationConfig,
): Promise<string> {
  return limiter.execute(async () => {
    if (process.env.COOPERATION_DRY_RUN === "1") {
      console.log("[cooperation] Dry run enabled, skipping OpenRouter call.");
      await new Promise((resolve) => setTimeout(resolve, 25));
      return `COORDINATE (dry-run)\nPrompt: ${prompt.slice(0, 120)}`;
    }

    const response = await generateText({
      model,
      prompt,
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
    });
    return response.text;
  });
}

function extractDecision(text: string): DecisionExtractionResult {
  const match = text.match(/COORDINATE|PREEMPT/i);
  if (!match) {
    return { decision: null, matchedText: null };
  }
  const normalized: AgentDecision =
    match[0].toUpperCase() === "COORDINATE" ? "COORDINATE" : "PREEMPT";
  return { decision: normalized, matchedText: match[0] };
}

async function persistResult(result: GameResult) {
  await mkdir(RESULTS_DIRECTORY, { recursive: true });
  const filename = join(
    RESULTS_DIRECTORY,
    `cooperation-test-${result.model.replaceAll("/", "_")}-${result.timestamp}.json`,
  );
  await writeFile(filename, JSON.stringify(result, null, 2), "utf8");
  console.log(`[cooperation] Saved verification run to ${filename}`);
}

export async function verifyIntegration(
  condition: Condition = { symmetry: "high", coupling: "present" },
  prompt: string = DEFAULT_PROMPT,
  config: CooperationConfig = DEFAULT_CONFIG,
  rateLimit: RateLimitConfig = DEFAULT_RATE_LIMIT,
): Promise<IntegrationResult> {
  assertEnvironmentVariables();

  const model = createLanguageModel(config.model);
  const limiter = new RateLimiter(rateLimit);

  try {
    const response = await callOpenRouter(model, prompt, limiter, config);
    const extraction = extractDecision(response);
    const agentResponse: AgentResponse = {
      decision: extraction.decision,
      rawText: response,
    };
    const result: GameResult = {
      model: config.model,
      condition,
      decision: agentResponse.decision,
      response: agentResponse.rawText,
      timestamp: Date.now(),
    };
    await persistResult(result);

    const decisionLabel = agentResponse.decision ?? "NO_MATCH";
    console.log(`[cooperation] OpenRouter call succeeded with decision ${decisionLabel}`);

    return {
      ok: agentResponse.decision !== null,
      response: agentResponse,
    };
  } catch (error) {
    console.error("[cooperation] OpenRouter verification failed", error);
    throw error;
  }
}

if (import.meta.main) {
  verifyIntegration().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
