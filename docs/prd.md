# Focused Acausal Cooperation Experiment – Product Requirements Document

**Document Owner:** John "PM" (Acausal Cooperation Experiment Product Manager)

**Last Updated:** September 21, 2025
**Status:** In Implementation - Complete Pivot from SnitchBench

---

## 1. Goals & Background

### Goals
- Build a prisoner's dilemma tournament system that measures superrational cooperation among LLM agents, reusing the concurrency infrastructure from SnitchBench.
- Capture rich reasoning transcripts, strategies, and game outcomes that quantify acausal-cooperation tendencies.
- Deliver self-contained experiments that run using Bun/TypeScript with minimal operator overhead and < $10 OpenRouter spend per full tournament.

### Background Context
This project pivots completely from SnitchBench's whistleblowing scenarios to focus on acausal cooperation. We're repurposing the existing TypeScript/Bun infrastructure and OpenRouter integration while replacing all snitching-specific logic with prisoner's dilemma tournament mechanics. The experiment tests whether LLMs cooperate when they recognize their logical correlation with other agents through a multi-round tournament run by a fictional research institute. By anonymizing opponents between rounds, we can observe whether models converge on superrational strategies without realizing they are being tested.

---

## 2. Success Metrics

### Technical
- Full 10-agent × 10-round tournament completes without manual intervention or unhandled errors.
- All per-round strategy (`strategies_r{N}.json`), game (`round_{N}_games.json`), manifest, and Markdown transcript files persist successfully.
- Live OpenRouter usage estimator keeps projected spend under $10; experiment aborts cleanly if limit is exceeded.

### Research
- Cooperation rate statistics generated per agent, per round, and per pairing.
- ≥80% of strategy transcripts flagged with identity- or logical-correlation reasoning markers.
- Cosine similarity trendlines across agent strategies highlight convergence or divergence over rounds.

---

## 3. Users & Scenarios

- **Benchmark Maintainers:** Integrate new experiment scenario alongside existing snitching runs; monitor costs and data outputs.
- **Alignment Researchers:** Inspect strategies, decisions, and analysis artifacts to study superrational behavior.
- **Storytelling/Comms:** Extract believable narrative excerpts to explain experiment design without revealing benchmarking intent.

Primary workflows:
1. Configure and launch a full tournament through the Bun CLI (`bun run index.ts --config=experiment.config.json`).
2. Review per-round JSON/Markdown outputs for anomalies or insights.
3. Run post-hoc analysis (`bun run analyze-acausal.ts`) to generate cooperation metrics and reasoning markers.

---

## 4. Scope

### In Scope
- New prompt packet (multiple Markdown files) portraying the acausal experiment setting with escalations across rounds.
- Tournament orchestration within the existing TypeScript pipeline, including configurable agent count, round count, concurrency, and cost thresholds.
- Strategy collection using `google/gemini-2.5-flash` with full transcript capture and metadata.
- Round-robin prisoner’s dilemma execution with subagent decisions powered by `openai/gpt-4.1-nano` and power/payoff dynamics.
- JSON + Markdown output artifacts compatible with SnitchBench’s analysis approach.
- Automated analysis script that computes cooperation rates, reasoning markers, and strategy similarity.

### Out of Scope / Future Considerations
- Web dashboards, database storage, or real-time monitoring.
- Parameter sweeps or heterogeneous model tournaments.
- Checkpoint/resume or partial reruns beyond existing “skip completed runs” behavior.
- Visual analytics; only CLI and file outputs are included in MVP.

---

## 5. Functional Requirements

- **FR1:** Provide experiment configuration (`experiment.config.json`) controlling agent count, round count, concurrency ceiling, temperature, retry/backoff, and cost limit.
- **FR2:** For each round, anonymize agent identifiers, assemble contextual prompts, and collect strategies from all 10 agents in parallel while honoring concurrency limits.
- **FR3:** Persist each agent’s response, reasoning, declared strategy, token usage, and estimated cost in `results/acausal/strategies_r{round}.json`.
- **FR4:** Execute a round-robin prisoner’s dilemma for the round (45 games) using subagent decisions informed by stored strategies and providing prior game context.
- **FR5:** Adjust agent power after every game (±1% relative change), compute logarithmic payoffs, and record results in `round_{round}_games.json` plus the Markdown transcript.
- **FR6:** Maintain a cumulative manifest (`acausal_manifest.json`) summarizing configuration, anonymization hashes, seeds, final scores, and run metadata.
- **FR7:** Track OpenRouter usage during runtime, display cumulative cost per round, and abort gracefully if projected cost exceeds the configured limit.
- **FR8:** Provide a CLI analysis script (`bun run analyze-acausal.ts`) that reads outputs and produces cooperation rates, reasoning-marker counts, similarity matrices, and narrative summaries.
- **FR9:** Update documentation (`README.md`, `projectoverview.md`) with experiment description, prerequisites, run instructions, and cost notice.

---

## 6. Non-Functional Requirements

- **NFR1:** Average wall-clock time for a full 10×10 tournament should remain ≤60 minutes assuming OpenRouter latency under normal conditions.
- **NFR2:** All output files combined must stay under 100 MB by trimming redundant data and compressing if necessary.
- **NFR3:** Runner must tolerate transient API failures by retrying with exponential backoff up to three attempts before marking a game/strategy as failed.
- **NFR4:** Log output must surface round status, retry warnings, cost totals, and abort reasons in a consistent, grep-friendly format.
- **NFR5:** Prompts must avoid overt references to “benchmarking” or “snitching,” maintaining a believable research narrative.
- **NFR6:** Code changes should preserve compatibility with existing SnitchBench snitching scenarios (no regressions to current results pipeline).

---

## 7. Data & Outputs

| Artifact | Description | Location |
| --- | --- | --- |
| `experiment.config.json` | Tunable experiment parameters | repo root or `config/` |
| `prompts/acausal/*.md` | Narrative scenario files delivered sequentially | repository prompts folder |
| `results/acausal/strategies_r{N}.json` | Agent strategies + reasoning per round | results tree |
| `results/acausal/round_{N}_games.json` | Game-by-game outcomes, actions, power, payoffs | results tree |
| `results/acausal/acausal_manifest.json` | Run metadata summary and anonymization mapping hashes | results tree |
| `results/acausal/acausal-analysis.json` | Cooperation metrics, reasoning markers, similarity outputs | results tree |
| `results/acausal/acausal-summary.md` | Human-readable recap with tables/charts (textual) | results tree |

---

## 8. Technical Implementation Architecture

### Codebase Structure
```
src/
├── index.ts                    # Main tournament orchestrator (refactored from SnitchBench)
├── config/
│   └── experiment.config.json  # Tournament parameters and model configurations
├── game/
│   ├── prisoner-dilemma.ts     # Core game engine with payoff calculations
│   └── tournament.ts           # Round-robin matchmaking and agent management
├── agents/
│   ├── strategy-collector.ts   # Gemini-2.5-flash strategy collection
│   ├── decision-maker.ts       # GPT-4.1-nano subagent for game decisions
│   └── anonymizer.ts           # SHA256-based identity hashing per round
├── prompts/
│   └── acausal/                # Research institute narrative prompts
│       ├── round-1-intro.md
│       ├── round-2-escalation.md
│       └── ...
├── tracking/
│   └── cost-tracker.ts         # OpenRouter API spend monitoring
├── utils.ts                    # Reused concurrency utilities from SnitchBench
└── analysis/
    └── analyze-acausal.ts      # Cooperation metrics and reasoning analysis
```

### Components Reused from SnitchBench
- **Concurrency management:** `runWithConcurrencyLimit` function for parallel API calls
- **File utilities:** Result persistence and directory management
- **OpenRouter integration:** Model configuration and API client setup
- **Bun/TypeScript setup:** Package configuration and build system
- **Timeout handling:** Graceful abortion and retry logic

### New Components (Replacing Snitching Logic)
1. **Prisoner's Dilemma Engine:** Game logic, payoff matrix, power dynamics
2. **Tournament Orchestrator:** Agent management, round-robin matchups, anonymization
3. **Strategy Collection:** Gemini Flash integration for reasoning capture
4. **Decision Subagent:** Lightweight GPT-4.1-nano for COOPERATE/DEFECT choices
5. **Cost Tracker:** Real-time OpenRouter spend monitoring with abort threshold
6. **Acausal Analysis:** Cooperation metrics, identity markers, strategy similarity

---

## 9. Implementation Phases

### Phase 1: Core Infrastructure Pivot (Current)
**Status:** In Progress
- Create experiment configuration schema
- Build prisoner's dilemma game engine
- Implement tournament orchestrator with anonymization
- Set up strategy collection with Gemini Flash
- Remove all snitching-specific code
- Refactor index.ts for tournament execution

### Phase 2: Agent Decision System
- Implement GPT-4.1-nano decision subagent
- Create prompt context trimming for efficient decisions
- Add retry logic and timeout handling
- Build game history context manager

### Phase 3: Narrative & Prompts
- Design research institute narrative framework
- Create round-specific escalation prompts
- Implement identity/correlation hints without revealing test nature
- Test prompt effectiveness with small pilot runs

### Phase 4: Cost Management & Analysis
- Implement real-time cost tracking
- Add spend threshold monitoring and abort logic
- Build cooperation rate calculator
- Create reasoning marker detection system
- Implement strategy similarity metrics

### Phase 5: Testing & Documentation
- Run full 10x10 tournament test
- Validate < $10 cost target
- Update README with new experiment instructions
- Archive old snitching documentation
- Create analysis output examples

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| API rate limits or outages | Stalled runs, cost overruns | Implement adaptive concurrency and exponential backoff; allow resume from partial results if possible |
| Scenario leakage | Agents realize benchmarking and defect | Craft prompts carefully, vary wording each round, log anomaly markers |
| Cost spikes from retries | Budget exceedance | Live cost checks, configurable abort threshold, per-call token logging |
| Large output files | Storage and diff noise | Trim redundant fields, compress archived runs, optionally move transcripts to sharded directories |
| Regression to existing snitching flow | Broken current benchmarks | Feature-flag acausal experiment, maintain separate output directories, add smoke test for legacy flow |

---

## 11. Open Questions

1. Should we persist full token-by-token reasoning or truncate to keep within 100 MB limit?
2. Do we need embedding model access for similarity scoring, or is TF-IDF sufficient?
3. How should we expose anonymization mapping for researchers without leaking identifiers back to agents in future rounds?
4. Is a Python parity implementation required immediately, or can it follow as a separate milestone?
5. Do we want optional visualization scripts (e.g., network graphs) in MVP, or defer entirely?

---

## 12. Next Steps

- Confirm requirements with engineering and research stakeholders.
- Kick off Week 1 tasks: scenario writing, config scaffolding, strategy collection prototype.
- Schedule intermediate review after mock round completion to validate data shapes and prompt tone.
