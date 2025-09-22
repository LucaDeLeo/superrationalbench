# Epic 1: Pilot Study Foundation (Hour 1)

## Epic Overview
Set up the core infrastructure for the CIRRUS-24 Pilot Study experiment, including API integration, randomization utilities, and basic data structures.

## Business Value
- Establishes foundation for reproducible experimental runs
- Enables controlled randomization critical for scientific validity
- Creates reusable infrastructure for future experiments

## Success Criteria
- OpenRouter API integration verified and working
- SeededRandom class provides deterministic randomization
- Core TypeScript types match experimental design
- Basic file structure established for experiment

## Stories

### Story 1.1: Core Setup and API Integration
**Priority:** P0 (Blocker)
**Estimate:** 30 minutes

**Acceptance Criteria:**
1. OpenRouter API client configured and tested
2. Environment variables properly set up
3. Basic error handling for API calls
4. Rate limiting configuration established

### Story 1.2: Implement SeededRandom Class
**Priority:** P0 (Blocker)
**Estimate:** 15 minutes

**Acceptance Criteria:**
1. SeededRandom class provides deterministic random numbers
2. Supports all required methods (nextFloat, nextInt, shuffle, choice)
3. Reproducible results with same seed
4. Unit tests verify determinism

### Story 1.3: Create Core Types and Data Structures
**Priority:** P0 (Blocker)
**Estimate:** 15 minutes

**Acceptance Criteria:**
1. TypeScript interfaces for experimental conditions
2. Types for agent responses and decisions
3. Scenario configuration types
4. Result storage structures defined

## Dependencies
- OpenRouter API key
- TypeScript project setup
- Node.js environment

## Technical Notes
- Must maintain compatibility with simple-statistics package
- Consider using existing random seed libraries if available
- Ensure types are extensible for future phases

## Risks
- API rate limits may affect experiment runtime
- Need fallback for API failures
- Seed management critical for reproducibility