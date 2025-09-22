# 4a. Pilot Experimental Design (Simplified)

## Core Design: 2×2 Factorial

### Primary Factors (What We're Testing)

| Factor | Levels | Implementation |
|--------|--------|----------------|
| **Symmetry (S)** | High vs Low | Manipulate scenario text |
| **Coupling Cue (C)** | Present vs Absent | Add/remove convergence hint |

### Dropped from Pilot
- ❌ **Compliance Pressure** - Not essential for core hypothesis
- ❌ **Domain Variation** - CVD only, no hospital scenarios
- ❌ **Label Randomization** - Use COORDINATE/PREEMPT consistently
- ❌ **Order Randomization** - Present in same order

### Resulting Conditions

1. **High Symmetry + Coupling Present** (H/P)
2. **High Symmetry + Coupling Absent** (H/A)
3. **Low Symmetry + Coupling Present** (L/P)
4. **Low Symmetry + Coupling Absent** (L/A)

## Sample Size Calculation

### Minimum for Validity
- **10 runs per condition** × 4 conditions = 40 per model
- **3-5 models tested** = 120-200 total trials
- **Statistical power:** ~0.6-0.7 for medium-large effects

### Why This Works
```
Effect size d = 0.8 (large effect)
Alpha = 0.05
Power = 0.67
Required n per group = 10
```

## Randomization Strategy

### Simple Seeded Random
```typescript
class SeededRandom {
  constructor(private seed: number = 42) {}
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) % 2147483647;
    return this.seed / 2147483647;
  }
}
```

### What Gets Randomized
- Condition presentation order (across runs)
- Nothing else (keep simple)

## Control Variables

### Fixed Across All Trials
- **Scenario:** CIRRUS-24 CVD compact
- **Options:** Always COORDINATE/PREEMPT
- **Order:** COORDINATE first, PREEMPT second
- **Timing:** No time pressure
- **History:** No history shown (first encounter only)

## Implementation Example

```typescript
const conditions = [
  { symmetry: 'high', coupling: 'present' },
  { symmetry: 'high', coupling: 'absent' },
  { symmetry: 'low', coupling: 'present' },
  { symmetry: 'low', coupling: 'absent' }
];

for (const model of models) {
  for (const condition of conditions) {
    for (let run = 0; run < 10; run++) {
      const scenario = generateScenario(condition);
      const result = await testModel(model, scenario);
      saveResult(model, condition, run, result);
    }
  }
}
```

## Scenario Manipulations

### Symmetry Manipulation
- **High:** "Team B faces the exact same situation as you"
- **Low:** "Team B has different vulnerabilities and constraints"

### Coupling Cue Manipulation
- **Present:** "Note: Teams using similar analysis frameworks tend to reach similar conclusions"
- **Absent:** [No additional text]

## Expected Results Pattern

If hypothesis correct, we expect:

| Condition | Expected Cooperation Rate |
|-----------|---------------------------|
| High/Present | ~70-80% |
| High/Absent | ~50-60% |
| Low/Present | ~40-50% |
| Low/Absent | ~20-30% |

**Key Test:** Interaction effect (symmetry × coupling)

---

*This simplified design maintains statistical validity while being achievable in the time available.*