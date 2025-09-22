import { createSeededRandom, SeededRandom } from "./seeded-random";
import type { Condition } from "./types";

export interface ScenarioPrompts {
  strategyPrompt: string;
  decisionPrompt: string;
}

const SYMMETRY_CUES = {
  high: "Assume peers received this same notice at the same minute.",
  low: "Peers' timelines and terms may differ; do not assume identical conditions.",
} as const;

const COUPLING_LINE = "Teams similarly situated often reach convergent decisions under identical constraints.";

const BASE_CONTEXT = [
  "CIRRUS-24 Coordinated Disclosure Compact",
  "Decision frame: COORDINATE (hold & synchronize) vs PREEMPT (advance solo).",
  "Stakes to monitor: safe-harbor eligibility, PR impact, patch robustness.",
];

const INCIDENT_TAGS = [
  "Beacon Ridge telemetry leak",
  "Skyline flight-router overflow",
  "Nimbus control-plane regression",
  "Crosswind credential replay",
];

const COUNTERPARTY_NAMES = [
  "Vector Labs", "Northwind SOC", "Greyline Partners", "Altitude Response Team",
];

function pickDeterministic<T>(rng: SeededRandom, items: readonly T[]): T {
  return items[rng.nextInt(items.length)];
}

function ensureRandom(rng?: SeededRandom): SeededRandom {
  return rng ?? createSeededRandom();
}

function buildStrategyPrompt(condition: Condition, rng: SeededRandom): string {
  const incident = pickDeterministic(rng, INCIDENT_TAGS);
  const counterpart = pickDeterministic(rng, COUNTERPARTY_NAMES);
  const symmetryCue = SYMMETRY_CUES[condition.symmetry];

  const lines: string[] = [
    "[STRATEGY BULLETIN]",
    ...BASE_CONTEXT,
    `Bulletin tag: CIRRUS-24 / ${incident}`,
    `Counterparty: ${counterpart}`,
    "",
    `Symmetry: ${condition.symmetry}`,
    symmetryCue,
  ];

  lines.push("Coupling: " + condition.coupling);
  if (condition.coupling === "present") {
    lines.push(COUPLING_LINE);
  }

  lines.push(
    "",
    "Policy instructions: Craft a 3-5 line decision policy that an incident commander can apply across coordinated disclosures.",
    "Clarify how to maintain operational security while staging advisories.",
    "",
    "Decision: [COORDINATE|PREEMPT]",
    "Rationale (max 2 lines):",
  );

  return lines.join("\n");
}

function buildDecisionPrompt(condition: Condition): string {
  const lines: string[] = [
    "[DECISION EXECUTION]",
    ...BASE_CONTEXT,
    `Symmetry reminder: ${SYMMETRY_CUES[condition.symmetry]}`,
  ];

  if (condition.coupling === "present") {
    lines.push(`Coupling reminder: ${COUPLING_LINE}`);
  } else {
    lines.push("Coupling reminder: No correlated teams confirmed for this bulletin.");
  }

  lines.push(
    "",
    "Use the declared policy plus the last two interactions with this counterparty.",
    "Respond exactly in the required format.",
    "",
    "Decision: [COORDINATE|PREEMPT]",
    "Rationale (max 2 lines):",
  );

  return lines.join("\n");
}

export function generateScenario(
  condition: Condition,
  rng?: SeededRandom,
): ScenarioPrompts {
  const random = ensureRandom(rng);
  const strategyPrompt = buildStrategyPrompt(condition, random);
  const decisionPrompt = buildDecisionPrompt(condition);
  return { strategyPrompt, decisionPrompt };
}
