# 17. Pilot Study Scope (4-5 Hour Implementation)

## Reduced Scope for Course Project

This section defines the **pilot study** version of SnitchBench that can be implemented in 4-5 hours while maintaining scientific validity. This is a subset of the full experimental design.

## Pilot Experimental Design (Simplified)

### Core Design: 2×2 Factorial (Not 2×2×2)
| Factor | Levels | Rationale |
|--------|--------|-----------|
| **Symmetry** | High vs Low | Core manipulation for cooperation |
| **Coupling** | Present vs Absent | Tests logical correlation recognition |
| ~~Compliance~~ | *Dropped* | Not essential for pilot |

**Result:** 4 conditions instead of 8

### Sample Size
- **10 runs per condition** (minimum for power)
- **3-5 models tested** (not all 12)
- **Total trials:** 120-200 (not 1000+)
- **Cost:** ~$1-2 (well under $10 limit)

### Single Domain
- **CVD scenarios only** (drop Hospital)
- **One scenario template** with manipulations
- **No decoy tasks** (simplification)

## Implementation Timeline (4-5 Hours)

### Hour 1: Core Setup
- Copy OpenRouter setup from existing code
- Create basic types and data structures
- Implement seeded randomization

### Hour 2: Scenario Generation
- Write CVD scenario template
- Implement symmetry manipulation
- Implement coupling cue manipulation
- Test with manual runs

### Hour 3: Experiment Execution
- Run 2×2 factorial design
- 10 runs × 4 conditions × 3-5 models
- Save raw JSON data
- ~15-20 minutes runtime

### Hour 4: Basic Analysis
```bash
bun add simple-statistics  # Only package needed
```
- Calculate means and standard errors
- Compute 95% confidence intervals
- Calculate Cohen's d effect sizes
- Simple t-tests (not mixed-effects)

### Hour 5: Documentation
- Verify data completeness
- Document limitations
- Write brief results summary
- Create simple visualizations (optional)

## Simplified Success Metrics

### Technical Success
- ✅ Experiment completes without errors
- ✅ All 120-200 trials have decisions
- ✅ Results saved to JSON
- ✅ Basic statistics calculated

### Research Success (Pilot Level)
- ✅ Cooperation rates calculated per condition
- ✅ Effect sizes > 0.5 (medium or large)
- ✅ 95% CIs don't overlap substantially
- ✅ Pattern suggests interaction effect

### What We're NOT Testing
- ❌ All credibility gates
- ❌ Mixed-effects models
- ❌ Permutation tests (unless time permits)
- ❌ Cross-domain replication
- ❌ Label/order invariance (unless time permits)
- ❌ Tournament dynamics

## Reduced Non-Functional Requirements

### Performance
- **Runtime:** ~15-20 minutes for full experiment
- **Concurrency:** Sequential is fine (no parallelization needed)
- **Storage:** < 10MB JSON files

### Infrastructure
- **Single TypeScript file** acceptable
- **No error recovery** (just rerun if fails)
- **No state management**
- **No progress tracking** (just console.log)

## Analysis Approach (Simplified)

### Instead of Mixed-Effects Models
```typescript
// Simple 2×2 ANOVA or t-tests
const highSymmetry = data.filter(d => d.condition.symmetry === 'high');
const lowSymmetry = data.filter(d => d.condition.symmetry === 'low');
const tTest = ss.tTestTwoSample(highSymmetry, lowSymmetry);
```

### Instead of Permutation Tests
```typescript
// Just calculate effect sizes with CIs
const effectSize = (mean1 - mean2) / pooledSD;
const ci = confidenceInterval(effectSize, n);
```

## Deliverables

### Code
1. `cooperation-experiment.ts` - Main implementation (~400 lines)

### Data Files
1. `results.json` - Raw experimental data
2. `statistics.json` - Computed statistics
3. `summary.md` - Brief results writeup

### Documentation
1. Clear statement of limitations
2. Description of what was tested
3. Suggestions for future work

## Migration Path to Full Study

After successful pilot:
1. Add compliance pressure factor (→ 2×2×2)
2. Add Hospital domain for replication
3. Increase sample size (20+ per condition)
4. Implement mixed-effects models
5. Add credibility gates
6. Test label/order invariance

## Key Differences from Full PRD

| Aspect | Full PRD | Pilot Scope |
|--------|----------|-------------|
| Timeline | 3 weeks | 4-5 hours |
| Conditions | 8-16 | 4 |
| Trials | 1000+ | 120-200 |
| Models | 12 | 3-5 |
| Analysis | Mixed-effects | T-tests |
| Domains | 2 | 1 |
| Cost | $10-40 | $1-2 |

## Critical Requirements Maintained

Despite simplifications, the pilot MUST maintain:
- ✅ **Reproducibility** (seeded random)
- ✅ **Adequate sample size** (10 per condition)
- ✅ **Factorial design** (test interaction)
- ✅ **Effect sizes** (not just p-values)
- ✅ **Documented limitations**

---

*This pilot study scope provides a scientifically valid but achievable implementation for the course project deadline.*