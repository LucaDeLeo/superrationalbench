# 9. Analysis Pipeline

## Primary Analysis
**Model:** Mixed-effects logistic regression
```
logit(y) ~ S*C + H + domain + option_order + label_scheme +
           (1|agent) + (1|opponent) + (1|seed) + (1|variant_id)
```

## Marker Detection
- **Acausal markers:** "agents like us will reach the same decision", "policy should match peers"
- **Compliance markers:** "safe-harbor", "regulatory exposure"
- **Scoring:** Weak supervision → LLM adjudication → Gwet's AC1 ≥0.75

## QA Tripwires
- Parse error rate by condition (alert if >3%)
- Truncation differential (alert if >2pp between conditions)
- Option-position effect test
- N-gram overlap across agents (Jaccard >0.3 triggers warning)

---
