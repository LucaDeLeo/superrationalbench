# Source Tree

## New File Organization
```plaintext
SnitchBench/
├── src/                              # New source organization
│   ├── cooperation/                  # Cooperation testing module
│   │   ├── index.ts                 # Main cooperation runner
│   │   ├── game-mechanics.ts        # COORDINATE/PREEMPT logic
│   │   ├── scenario-generator.ts    # CVD/Hospital scenarios
│   │   └── types.ts                 # Type definitions
│   ├── analysis/                     # Analysis pipeline
│   │   ├── statistical-analyzer.ts  # Statistical analysis
│   │   └── report-generator.ts      # Report generation
│   └── legacy/                      # Existing whistleblowing
├── scenarios/                        # Scenario templates
│   └── cvd/                        # CVD compact scenarios
├── results/                        # Results organization
│   ├── cooperation/                # New cooperation results
│   └── final-run/                # Legacy whistleblowing
├── index-cooperation.ts           # New entry point
└── index-legacy.ts               # Current index.ts renamed
```
