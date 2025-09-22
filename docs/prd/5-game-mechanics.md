# 5. Game Mechanics

## Payoff Structure
- **Internal matrix:** T=5, R=3, P=1, S=0 (satisfies T>R>P>S and 2R > T+S)
- **Power dynamics:** Bounded Elo-style updates
  ```
  power_i ← clip(power_i * exp(η * (π_i - π̄)), min=0.9, max=1.1)
  with η=0.02
  ```
- **Score accumulation:** `score += ln(1 + power * π)` to cap variance

## History Exposure
- Decision subagent receives only:
  - Pair-local history (0-2 past interactions this round)
  - Agent's 3-5 line declared policy
  - Current bulletin with toggle-injected cues
- No access to full transcripts or global tournament state

---
