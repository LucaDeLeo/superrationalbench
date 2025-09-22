# Data Models (Simple Types)

## Minimal Types You Need

```typescript
// The factorial condition
type Condition = {
  symmetry: 'high' | 'low';
  coupling: 'present' | 'absent';
  compliance: 'joint' | 'universal';
};

// Single game result
type GameResult = {
  model: string;
  condition: Condition;
  decision: string; // 'COORDINATE' or 'PREEMPT'
  response: string; // Full response for debugging
  timestamp: number;
};

// That's it! Save as JSON:
fs.writeFileSync(
  `results/${model}-${Date.now()}.json`,
  JSON.stringify(results, null, 2)
);
```
