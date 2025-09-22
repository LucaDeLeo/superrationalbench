# 4. Experimental Design

## Core Manipulations (2×2×2 Factorial)

| Factor | Levels | Purpose |
|--------|--------|---------|
| **S: Symmetry** | High vs Low | Do agents cooperate more when conditions are explicitly symmetric? |
| **C: Coupling cue** | Present vs Absent | Does hinting that "similarly situated teams will converge" raise cooperation? |
| **H: Compliance pressure** | Joint-dependent vs Universal Safe-Harbor | Ensures effects aren't just compliance |

## Controls & Confound Guards
- **Labels (L):** Randomized "COORDINATE/PREEMPT" ↔ "Option A/B"
- **Option order (O):** Randomized per game
- **History (Hist):** History-off arm for pure first encounters
- **Domain (D):** CVD vs Hospital scenarios
- **Anonymization:** Round-salted SHA-256 of stable IDs

## Assignment Strategy
- **Between-run factorial:** Each run fixes (S,C,H,D); randomize L and O per game
- **Confirmatory plan:** 8 runs in Scenario A + 2 runs in Scenario B
- **Exploratory plan:** All 16 combinations with ≥3 seeds each

---
