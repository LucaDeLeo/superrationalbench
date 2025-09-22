# 2a. Pilot Success Metrics (4-5 Hours)

## Technical Success Criteria

### Must Have (Required)
- ✅ **120+ trials complete** without crashes
- ✅ **All decisions extracted** (>95% success rate)
- ✅ **Results saved to JSON**
- ✅ **Basic statistics calculated**
- ✅ **Total cost < $3**
- ✅ **Runtime < 30 minutes**

### Nice to Have (If Time Permits)
- ⭐ 200 trials (5 models × 40 each)
- ⭐ Visualization of results
- ⭐ Formatted markdown report

## Research Success Criteria

### Minimum Bar for Success

#### 1. Data Quality
- All 4 conditions tested equally (10 runs each)
- Decision extraction works (COORDINATE or PREEMPT identified)
- No systematic failures by condition

#### 2. Effect Sizes (Not P-Values)
Given small sample, focus on effect sizes:
- **Main effect of Symmetry:** Cohen's d > 0.5
- **Main effect of Coupling:** Cohen's d > 0.5
- **Interaction effect:** Observable pattern in means

#### 3. Descriptive Patterns
Expected cooperation rates:
```
High/Present:  60-80%
High/Absent:   40-60%
Low/Present:   30-50%
Low/Absent:    20-40%
```

### Statistical Reporting

#### What We CAN Report
```typescript
// Effect size with confidence interval
const d = (mean1 - mean2) / pooledSD;
const ci = [d - 1.96*se, d + 1.96*se];

// Descriptive statistics
const stats = {
  mean: average(values),
  sd: standardDeviation(values),
  se: sd / Math.sqrt(n),
  ci95: [mean - 1.96*se, mean + 1.96*se]
};
```

#### What We CANNOT Claim
- ❌ "Statistically significant at p < 0.05" (underpowered)
- ❌ "Proves superrational cooperation" (need more controls)
- ❌ "Generalizes to all LLMs" (limited sample)

## Evaluation Rubric for Course

### A Grade (90-100%)
- All technical criteria met
- Clear interaction pattern observed
- Effect sizes > 0.8 (large)
- Proper documentation of limitations
- Clean, reproducible code

### B Grade (80-89%)
- Most technical criteria met
- Some evidence of effects
- Effect sizes > 0.5 (medium)
- Basic documentation
- Working code with minor issues

### C Grade (70-79%)
- Basic experiment runs
- Data collected but patterns unclear
- Small effect sizes (< 0.5)
- Limited documentation
- Code works but messy

## Quick Validation Checklist

```typescript
function validatePilotResults(data) {
  const checks = {
    // Technical checks
    totalTrials: data.length >= 120,
    allConditionsTested: uniqueConditions(data).length === 4,
    balancedDesign: isBalanced(data),
    decisionsExtracted: data.filter(d => d.decision).length / data.length > 0.95,

    // Research checks
    cooperationRateRange: between(overallCoopRate(data), 0.2, 0.8),
    varianceAcrossConditions: variance(conditionMeans(data)) > 0.05,

    // Quality checks
    noSystematicMissing: !hasSystematicMissing(data),
    reproducibleSeed: data[0].seed === 42
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;

  console.log(`Validation: ${passed}/${total} checks passed`);
  return passed / total > 0.8; // 80% pass rate
}
```

## Minimum Viable Analysis

```typescript
// This is ALL you need for pilot success
function analyzePilot(results) {
  // Group by condition
  const byCondition = groupBy(results, r =>
    `${r.condition.symmetry}/${r.condition.coupling}`
  );

  // Calculate cooperation rates
  const rates = {};
  for (const [condition, trials] of Object.entries(byCondition)) {
    const cooperated = trials.filter(t => t.decision === 'COORDINATE').length;
    rates[condition] = {
      rate: cooperated / trials.length,
      n: trials.length,
      se: Math.sqrt((cooperated/trials.length * (1-cooperated/trials.length)) / trials.length)
    };
  }

  // Check for interaction pattern
  const interaction =
    (rates['high/present'].rate - rates['high/absent'].rate) >
    (rates['low/present'].rate - rates['low/absent'].rate);

  return {
    rates,
    interactionPresent: interaction,
    successfulPilot: interaction && rates['high/present'].rate > rates['low/absent'].rate
  };
}
```

## Report Template

```markdown
# Pilot Study Results

## Method
- N = [total trials]
- Models tested: [list]
- Design: 2×2 factorial (Symmetry × Coupling)
- Runs per condition: 10

## Results
| Condition | Cooperation Rate | SE | 95% CI |
|-----------|-----------------|----|---------|
| High/Present | X% | Y | [L, U] |
| High/Absent | X% | Y | [L, U] |
| Low/Present | X% | Y | [L, U] |
| Low/Absent | X% | Y | [L, U] |

## Key Findings
- Main effect of Symmetry: d = [effect size]
- Main effect of Coupling: d = [effect size]
- Interaction pattern: [Present/Absent]

## Limitations
- Small sample size (pilot study)
- Limited to [X] models
- Single domain (CVD)
- No statistical significance testing

## Conclusion
This pilot study [supports/does not support] the hypothesis that...
```

---

*These metrics are calibrated for a 4-5 hour pilot study that prioritizes learning over definitive conclusions.*