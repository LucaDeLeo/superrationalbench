# 7. Agent Configuration

## LLM Models
- **Strategy model:** `google/gemini-2.5-flash` (full transcript capture, token caps)
- **Decision model:** `openai/gpt-5-nano` (short outputs; single label + rationale)

## Baselines (Deterministic)
- AlwaysC, AlwaysD, TitForTat, GrimTrigger
- Zero-cost, used for calibration
- Excluded from primary analysis

## Concurrency & Reliability
- **Concurrency:** 6 (strategy), 8 (decision)
- **Retries:** Exponential backoff with jitter: 1s, 2s, 4s (max 3)
- **Circuit-breaker:** On 5 consecutive errors in 60s, pause 30s
- **Cost projection:** Abort if `projected_total > limit`

---
