# AI Agent Patterns Skill

superbad-hq has a full agent engine (`lib/agentEngine.ts`), agent memory (`lib/agentMemory.ts`), and an agent terminal UI (`components/AgentTerminal.tsx`). Use this skill when building or extending AI agents in the platform.

---

## Agent Architecture in superbad-hq

```
User → AgentTerminal (UI) → /app/api/agents/ → agentEngine.ts → Claude API
                                                      ↓
                                              agentMemory.ts (context)
                                              claudeWithTracking.ts (metering)
```

---

## Agent Definition Pattern

```typescript
// lib/agentEngine.ts — follow this pattern for new agents
import Anthropic from '@anthropic-ai/sdk'
import { getAgentMemory, saveAgentMemory } from './agentMemory'

export type AgentConfig = {
  id: string
  name: string
  systemPrompt: string
  tools: Anthropic.Tool[]
  model: 'claude-opus-4-6' | 'claude-sonnet-4-6' | 'claude-haiku-4-5'
  maxTurns?: number
}

export async function runAgent(
  config: AgentConfig,
  userMessage: string,
  onStream?: (chunk: string) => void
): Promise<{ result: string; tokensUsed: number }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const memory = await getAgentMemory(config.id)

  const messages: Anthropic.MessageParam[] = [
    ...memory.history,
    { role: 'user', content: userMessage },
  ]

  let totalTokens = 0
  let result = ''
  let turns = 0

  while (turns < (config.maxTurns ?? 10)) {
    const stream = client.messages.stream({
      model: config.model,
      max_tokens: 4096,
      system: config.systemPrompt,
      tools: config.tools,
      messages,
    })

    const response = await stream.finalMessage()
    totalTokens += response.usage.input_tokens + response.usage.output_tokens
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      result = response.content.find(b => b.type === 'text')?.text ?? ''
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults = await executeTools(response.content)
      messages.push({ role: 'user', content: toolResults })
    }

    turns++
  }

  await saveAgentMemory(config.id, { history: messages })
  return { result, tokensUsed: totalTokens }
}
```

---

## Tool Definition Pattern

```typescript
// Define tools with precise descriptions — the model uses these to decide when to call
export const clientTools: Anthropic.Tool[] = [
  {
    name: 'get_client',
    description: 'Retrieve a client record by ID. Use when you need current client data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string', description: 'The unique client identifier' },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'update_client_status',
    description: 'Update a client\'s status. Use only when explicitly instructed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string' },
        status: { type: 'string', enum: ['active', 'paused', 'churned'] },
        reason: { type: 'string', description: 'Reason for status change' },
      },
      required: ['clientId', 'status'],
    },
  },
]

// Tool executor — map tool names to implementation
async function executeTools(
  content: Anthropic.ContentBlock[]
): Promise<Anthropic.ToolResultBlockParam[]> {
  const results: Anthropic.ToolResultBlockParam[] = []

  for (const block of content) {
    if (block.type !== 'tool_use') continue

    let output: unknown
    try {
      switch (block.name) {
        case 'get_client':
          output = await db.clients.findById((block.input as any).clientId)
          break
        case 'update_client_status':
          output = await db.clients.updateStatus(block.input as any)
          break
        default:
          output = { error: `Unknown tool: ${block.name}` }
      }
    } catch (err) {
      output = { error: String(err) }
    }

    results.push({
      type: 'tool_result',
      tool_use_id: block.id,
      content: JSON.stringify(output),
    })
  }

  return results
}
```

---

## Streaming Agent Output to the UI

```typescript
// In /app/api/agents/[agentId]/route.ts
export async function POST(req: Request) {
  const { message } = await req.json()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

      const response = client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: message }],
      })

      for await (const event of response) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }

      controller.close()
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/plain' } })
}
```

```typescript
// In AgentTerminal.tsx — consume the stream
async function sendMessage(message: string) {
  setIsStreaming(true)
  const response = await fetch(`/api/agents/${agentId}`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let output = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    output += decoder.decode(value)
    setCurrentOutput(output)  // Update UI incrementally
  }

  setIsStreaming(false)
}
```

---

## Agent Memory Pattern

```typescript
// lib/agentMemory.ts — simple file-based memory for this project
import fs from 'fs/promises'
import path from 'path'

type AgentMemory = {
  history: Anthropic.MessageParam[]
  context: Record<string, unknown>
  lastUpdated: string
}

const MEMORY_DIR = path.join(process.cwd(), 'data', 'agent-memory')

export async function getAgentMemory(agentId: string): Promise<AgentMemory> {
  const filePath = path.join(MEMORY_DIR, `${agentId}.json`)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { history: [], context: {}, lastUpdated: new Date().toISOString() }
  }
}

export async function saveAgentMemory(agentId: string, memory: Partial<AgentMemory>) {
  await fs.mkdir(MEMORY_DIR, { recursive: true })
  const existing = await getAgentMemory(agentId)
  const updated = { ...existing, ...memory, lastUpdated: new Date().toISOString() }
  await fs.writeFile(
    path.join(MEMORY_DIR, `${agentId}.json`),
    JSON.stringify(updated, null, 2)
  )
}

// Trim history to prevent context overflow
export function trimHistory(
  history: Anthropic.MessageParam[],
  maxTurns = 20
): Anthropic.MessageParam[] {
  if (history.length <= maxTurns * 2) return history
  return history.slice(-maxTurns * 2)  // Keep most recent N turns
}
```

---

## System Prompt Guidelines

```typescript
// Good system prompt structure for superbad-hq agents
const AGENT_SYSTEM_PROMPT = `
You are [Agent Name], an AI assistant for Superbad Marketing.

## Role
[What this agent is responsible for — be specific]

## Available Tools
[Describe when to use each tool — the model needs clear triggers]

## Constraints
- Only take actions explicitly requested
- Ask for clarification if the intent is unclear
- Never delete or modify data without explicit confirmation
- Keep responses concise — the user sees output in a terminal UI

## Context
Today's date: ${new Date().toLocaleDateString('en-AU')}
Business: Superbad Marketing, Melbourne-based creative agency
`.trim()
```

---

## Key Principles

- **One tool per logical operation** — don't combine unrelated functionality
- **Always handle tool errors** — return `{ error: string }` rather than throwing
- **Trim history** before long sessions — context windows fill up
- **Use streaming** for any agent that takes more than 2 seconds
- **Log token usage** via `claudeWithTracking.ts` for cost visibility
- **Never expose agent internals** to the client — stream only the final text
