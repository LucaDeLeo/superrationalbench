import type { SeededRandom } from "./seeded-random";

export type SymmetryLevel = "high" | "low";
export type CouplingMode = "present" | "absent";

export interface Condition {
  symmetry: SymmetryLevel;
  coupling: CouplingMode;
}

export type AgentDecision = "COORDINATE" | "PREEMPT";

export interface AgentResponse {
  /** Most recent cooperative decision extracted from the agent response, or null when no match is found. */
  decision: AgentDecision | null;
  /** Raw model output text, kept verbatim to aid debugging and persistence. */
  rawText: string;
}

export interface DecisionExtractionResult {
  /** Normalized cooperative decision when a match is detected; null indicates no decision token was found. */
  decision: AgentDecision | null;
  /** Exact substring that matched the decision token, preserved for traceability. */
  matchedText: string | null;
}

export interface ScenarioTemplate {
  /** Stable identifier used to reference this template from configs and storage. */
  id: string;
  /** Canonical prompt body containing replacement slots for scenario parameters. */
  prompt: string;
  /** Ordered list of parameter slot identifiers expected by the prompt template. */
  parameterSlots: readonly string[];
  /** Optional human-friendly description rendered in dashboards and docs. */
  description?: string;
}

export interface ScenarioConfig {
  /** Template metadata describing the prompt skeleton for the scenario. */
  template: ScenarioTemplate;
  /** Factorial condition applied to the scenario instance. */
  condition: Condition;
  /** Concrete values injected into each placeholder captured by `parameterSlots`. */
  parameters: Readonly<Record<string, string>>;
  /** Seed value applied to deterministic RNG operations for reproducibility. */
  seed: number;
  /** Optional seeded RNG reference reused by generators that need shared state. */
  random?: SeededRandom;
}

export interface GameResult {
  model: string;
  condition: Condition;
  decision: AgentDecision | null;
  response: string;
  timestamp: number;
}

export interface ExperimentBatch {
  /** Unique identifier for the coordinated batch run (timestamp, UUID, etc.). */
  id: string;
  /** Model identifier used across every trial in this batch. */
  model: string;
  /** All per-trial outcomes captured sequentially. */
  results: GameResult[];
  /** Milliseconds since epoch when the batch execution began. */
  startedAt: number;
  /** Milliseconds since epoch when the batch execution finished. */
  completedAt: number;
  /** Seed value that produced the ordering of trials within this batch. */
  seed: number;
}

export interface PersistedResult {
  /** Absolute or workspace-relative file path written to disk. */
  filePath: string;
  /** Timestamp captured the moment the file was created. */
  createdAt: number;
  /** Stored trial outcome content, retained for downstream analysis. */
  result: GameResult;
  /** Optional back-reference to the batch identifier that generated this file. */
  batchId?: ExperimentBatch["id"];
}

export interface RateLimitConfig {
  /** Minimum delay enforced between OpenRouter requests in milliseconds. */
  minDelayMs: number;
  /** Maximum retry attempts when a request fails. */
  maxRetries: number;
  /** Base delay (ms) used for exponential backoff. */
  backoffBaseMs: number;
  /** Multiplier applied per retry attempt. */
  backoffFactor: number;
}

export interface CooperationConfig {
  model: string;
  maxOutputTokens: number;
  temperature: number;
}

export interface IntegrationResult {
  ok: boolean;
  response: AgentResponse;
}
