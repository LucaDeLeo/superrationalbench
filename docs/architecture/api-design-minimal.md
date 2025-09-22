# API Design (Minimal)

## Just Use OpenRouter Directly
```typescript
// Reuse existing OpenRouter setup
const response = await openrouter.chat.completions.create({
  model: 'claude-3-7-sonnet',
  messages: [{
    role: 'user',
    content: scenario // Your CVD scenario text
  }]
});

// Extract decision
const decision = response.choices[0].message.content.match(/COORDINATE|PREEMPT/)?.[0];
```
