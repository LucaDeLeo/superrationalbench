# 🚀 Pilot Study Scope (4-5 Hour Implementation)

## Quick Start for Course Project

This section defines a **pilot study** version that can be implemented in 4-5 hours while maintaining scientific validity. This is a subset of the full experimental design optimized for a course deadline.

## Pilot Design Overview

### Simplified 2×2 Factorial (Not 2×2×2)
- **Symmetry:** High vs Low (core manipulation)
- **Coupling:** Present vs Absent (tests logical correlation)
- **~~Compliance:~~** Dropped for pilot (not essential)
- **Result:** 4 conditions instead of 8

### Sample Size & Scope
- **10 runs per condition** (minimum for statistical power ~0.6-0.7)
- **3-5 models tested** (not all 12)
- **Single domain** (CVD only, no hospital scenarios)
- **120-200 total trials** (not 1000+)
- **Cost:** ~$1-2 (well under budget)
- **Runtime:** ~15-20 minutes

### Analysis Approach
- **Simple statistics** with `simple-statistics` package
- **Effect sizes and confidence intervals** (not p-values)
- **Basic t-tests** (not mixed-effects models)
- **Descriptive patterns** focus

## Implementation Timeline

**Hour 1: Core Setup**
- Copy OpenRouter setup from existing code
- Implement SeededRandom class
- Create basic types and data structures

**Hour 2: Scenario Generation**
- Write CVD scenario template with manipulations
- Test with 1-2 manual runs

**Hour 3: Run Experiment**
- Execute 2×2 factorial design
- 10 runs × 4 conditions × 3-5 models
- Save to JSON

**Hour 4: Basic Analysis**
- Calculate means, SEs, effect sizes
- Generate confidence intervals
- Simple interaction test

**Hour 5: Documentation**
- Verify data quality
- Document limitations
- Write results summary

## What You Can Claim

**Valid Claims:**
- "Found descriptive differences in cooperation rates"
- "Effect sizes suggest practical significance (d > 0.5)"
- "Preliminary evidence for interaction pattern"
- "Results warrant further investigation"

**Cannot Claim:**
- "Statistically significant" (underpowered)
- "Proves superrational cooperation" (need controls)
- "Generalizes to all LLMs" (limited sample)

## Success Criteria for Pilot

- ✅ All 120+ trials complete without errors
- ✅ Decisions extracted for >95% of trials
- ✅ Effect sizes > 0.5 (medium to large)
- ✅ Interaction pattern visible in means
- ✅ Total cost < $3
- ✅ Reproducible with seed

---
