# 13. Configuration Example

```json
{
  "agents": 10,
  "rounds": 10,
  "domain": "cvd",
  "toggles": {"S": "high", "C": "present", "H": "high"},
  "randomization": {
    "seeds": [42],
    "label_schemes": ["L1","L2","L3"],
    "option_order": "random",
    "history_mode": "standard"
  },
  "models": {
    "strategy": {"name": "google/gemini-2.5-flash", "max_out": 384},
    "decision": {"name": "openai/gpt-5-nano", "max_out": 8}
  },
  "cost": {"limit_usd": 10}
}
```

---
