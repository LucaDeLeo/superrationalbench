# 11. Risk Mitigation

| Risk | Mitigation | Implementation |
|------|-----------|----------------|
| Compliance masquerade | Factorial H toggle | Designed into experiment |
| Reciprocity leakage | First-encounter primary | Round-1 analysis focus |
| Label valence | L1/L2/L3 randomization | Per-game randomization |
| Prompt tells | Blinded codebook + toggles | Dual-rater validation |
| Instrumentation bias | Strict parser, no defaults | parse_status tracking |
| Power runaway | Bounded updates [0.9, 1.1] | Elo-style with η=0.02 |
| Cost overrun | Live projection + abort | Real-time monitoring |

---
