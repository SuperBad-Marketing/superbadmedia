# Claude API Skill

Source: https://github.com/anthropics/skills/tree/main/skills/claude-api

Use this skill when working in `lib/claudeWithTracking.ts`, `lib/agentEngine.ts`, `lib/agentMemory.ts`, or any `/app/api/` route that calls the Anthropic SDK.

**Import:** `import Anthropic from '@anthropic-ai/sdk'`

---

## Model Selection

| Task | Model | Why |
|---|---|---|
| Agent reasoning, complex tasks | `claude-opus-4-6` | Default for agents |
| Most API routes, chat | `claude-sonnet-4-6` | Balanced cost/quality |
| Simple classification, tagging | `claude-haiku-4-5` | Fast, cheap |

**Never** add date suffixes to model IDs — use exactly as above.

---

## Basic Request (TypeScript)

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const message = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Your prompt here' }],
})

const text = message.content[0].type === 'text' ? message.content[0].text : ''
```

---

## Streaming (use for long outputs or chat UI)

```typescript
// In a Next.js API route
export async function POST(req: Request) {
  const { prompt } = await req.json()

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  // Return as ReadableStream for the frontend
  return new Response(stream.toReadableStream())
}

// On the client
const response = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ prompt }) })
const reader = response.body?.getReader()
// Read chunks and append to UI
```

---

## Adaptive Thinking (Opus 4.6 — for complex reasoning)

```typescript
const message = await client.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 8000,
  thinking: { type: 'adaptive' },  // Claude decides when to think
  messages: [{ role: 'user', content: complexPrompt }],
})
```

**Never** use `budget_tokens` with Opus 4.6 or Sonnet 4.6 — it's deprecated. Use `thinking: { type: 'adaptive' }`.

---

## Tool Use (Function Calling)

```typescript
const tools: Anthropic.Tool[] = [
  {
    name: 'get_client_data',
    description: 'Retrieve client information from the database',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string', description: 'The client ID' },
      },
      required: ['clientId'],
    },
  },
]

const response = await client.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 4096,
  tools,
  messages: [{ role: 'user', content: 'Get data for client ABC123' }],
})

// Handle tool call
if (response.stop_reason === 'tool_use') {
  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (toolUse?.type === 'tool_use') {
    const result = await handleToolCall(toolUse.name, toolUse.input)
    // Continue conversation with tool result
  }
}
```

---

## Agentic Loop Pattern

```typescript
// For lib/agentEngine.ts patterns
async function runAgent(task: string, tools: Anthropic.Tool[]) {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: task }
  ]

  while (true) {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      tools,
      messages,
    })

    // Add assistant response to history
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') break

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }
      }
      messages.push({ role: 'user', content: toolResults })
    }
  }

  return messages
}
```

---

## Prompt Caching (for repeated system prompts)

```typescript
// Cache stable system prompts to save tokens on repeated calls
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: [
    {
      type: 'text',
      text: LONG_STABLE_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
  ],
  messages: [{ role: 'user', content: userMessage }],
})

// Check cache hit: response.usage.cache_read_input_tokens > 0
```

**Caching order:** `tools` → `system` → `messages`. Any change before the breakpoint invalidates the cache.

---

## Structured Output

```typescript
// Request JSON output reliably
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: `Extract the following as JSON: ${input}\n\nRespond with only valid JSON, no markdown.`
  }],
})

// Always parse — never string match
const data = JSON.parse(response.content[0].text)
```

---

## Common Pitfalls

- **Don't truncate long inputs silently** — chunk or summarise first
- **Don't use `budget_tokens`** on Opus/Sonnet 4.6 — use `thinking: { type: 'adaptive' }`
- **Always stream** when `max_tokens > 4096` — HTTP timeout risk
- **Don't reimplement SDK types** — use `Anthropic.MessageParam`, `Anthropic.Tool` etc.
- **Always parse tool JSON** with `JSON.parse()` — never regex or string match
- **128K output requires streaming** — mandatory for very long generations
- **Keep `max_tokens` realistic** — hitting the cap truncates mid-sentence

---

## Environment Variables

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

```typescript
// Access in API routes (server-side only — never in client components)
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

Never expose `ANTHROPIC_API_KEY` to the client — it must only be used in `/app/api/` routes or server components.
