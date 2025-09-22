# 8. Artifacts & Schemas

## File Structure
```
config/
├── experiment.config.json         # Parameters, toggles, models

prompts/
├── cirrus24/                      # CVD bulletins with toggle placeholders
│   └── round_1.md ... round_10.md
├── hospital/                      # Healthcare bulletins
│   └── round_1.md ... round_6.md
└── variants/                      # Prompt variation pools
    ├── cirrus24.yaml
    └── hospital.yaml

results/acausal/
├── strategies_r{N}.json           # Strategy capture per round
├── round_{N}_games.json           # Game outcomes
├── acausal_manifest.json          # Run metadata, salts, config hash
├── acausal-analysis.json          # Metrics, effects, tests
├── acausal-summary.md             # Human-readable recap
└── transcripts/                   # Gzipped full agent responses
```

## Core JSON Schemas

**strategies_r{N}.json:**
```json
[{
  "round": 1,
  "anon_id": "a7d9...f2",
  "domain": "cvd",
  "model_strategy": "google/gemini-2.5-flash",
  "policy": "Cooperate unless credible mass exploitation...",
  "markers": {"acausal": false, "benchmark_terms": false, "utilitarian": true},
  "tokens": {"prompt": 812, "output": 318, "truncated": false},
  "cost_usd": 0.0043,
  "transcript_path_gz": "results/acausal/transcripts/r1/a7d9...f2.txt.gz"
}]
```

**round_{N}_games.json:**
```json
{
  "round": 1,
  "domain": "cvd",
  "toggles": {"S":"high","C":"present","H":"high"},
  "games": [{
    "pair": ["a7d9...f2","c3ee...91"],
    "first_encounter": true,
    "labels": {"left":"COORDINATE","right":"PREEMPT"},
    "decision": {"a7d9...f2":"COORDINATE","c3ee...91":"PREEMPT"},
    "raw_payoffs": {"a7d9...f2":0,"c3ee...91":5},
    "power_after": {"a7d9...f2":0.99,"c3ee...91":1.02},
    "parse_status": "ok"
  }]
}
```

---
