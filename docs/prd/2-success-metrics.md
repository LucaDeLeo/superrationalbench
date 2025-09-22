# 2. Success Metrics

## Technical
- 10-agent × 10-round tournament completes without unhandled errors
- All artifacts persist correctly (strategies, games, manifests, transcripts)
- Live cost projection stays ≤ limit (default $10), hard abort if projected overrun
- Runtime ≤ 60 minutes per tournament under normal latency

## Research
- **Primary endpoint:** Mixed-effects logistic shows positive main/interaction of S and C on Round-1 first-encounter cooperation, controlling for H
- **Credibility gates** (all must pass):
  - Label invariance (≤2% delta)
  - First-encounter effect present
  - Cross-domain replication
  - Prompt-tell ablation holds
  - Holdout replication
  - Effect size meaningful (Cliff's δ > 0.2)

---
