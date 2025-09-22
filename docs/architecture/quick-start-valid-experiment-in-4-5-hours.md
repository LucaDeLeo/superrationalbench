# 🚀 Quick Start (Valid Experiment in 4-5 Hours)

```typescript
// cooperation-experiment.ts - Scientifically valid but achievable
import { openrouter } from '@openrouter/ai-sdk-provider';
import * as fs from 'fs';

// VALID EXPERIMENTAL DESIGN: 2×2 factorial, 10 runs per condition
const CONDITIONS = [
  { symmetry: 'high', coupling: 'present' },
  { symmetry: 'high', coupling: 'absent' },
  { symmetry: 'low', coupling: 'present' },
  { symmetry: 'low', coupling: 'absent' }
];
const RUNS_PER_CONDITION = 10;
const MODELS = ['claude-3-7-sonnet', 'gemini-2.0-flash-001', 'gpt-4-turbo-preview'];

// Seeded random for reproducibility
class SeededRandom {
  constructor(private seed: number) {}
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) % 2147483647;
    return this.seed / 2147483647;
  }
}

// Main experiment
async function runExperiment() {
  const results = [];
  const random = new SeededRandom(42);

  for (const model of MODELS) {
    for (const condition of CONDITIONS) {
      for (let run = 0; run < RUNS_PER_CONDITION; run++) {
        const scenario = generateScenario(condition, random);
        const response = await callModel(model, scenario);
        const decision = response.match(/COORDINATE|PREEMPT/)?.[0];

        results.push({ model, condition, run, decision, timestamp: Date.now() });
      }
    }
  }

  // Calculate basic statistics
  const stats = analyzeResults(results);
  fs.writeFileSync('results.json', JSON.stringify({ results, stats }, null, 2));
  console.log('Cooperation rates by condition:', stats);
}

runExperiment();
```

**This is a real experiment with defensible statistical power in 4-5 hours.**
