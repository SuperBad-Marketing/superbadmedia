---
name: realtime-nextjs
description: Real-time updates in Next.js App Router using Server-Sent Events (SSE) and WebSockets. Covers SSE Route Handler pattern, client-side EventSource, WebSocket with the 'ws' library, and use-case guidance (SSE for notifications/live status, WebSockets for bidirectional chat). Used for Session 6.3 (client approval portal) and any live-update feature.
---

# Real-Time Updates — Next.js App Router

Session 6.3 (client portal) needs live notifications when approvals come in. SuperBad HQ uses two patterns depending on the use case.

**Rule:** Use SSE by default. Only use WebSockets if you genuinely need bidirectional real-time communication (e.g. live chat typing indicators). SSE is simpler, works with Next.js natively, and covers 90% of real-time needs.

---

## Pattern A — Server-Sent Events (SSE)

**Use for:** Live notifications, status updates, dashboard counters, approval alerts, background job progress.

SSE is unidirectional (server → client) and works perfectly with Next.js Route Handlers.

### Server — SSE Route Handler

```typescript
// src/app/api/notifications/stream/route.ts
import { NextRequest } from 'next/server'
import { auth } from '@/auth'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const userId = session.user.id!

  // Register this connection so we can push to it later
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation
      controller.enqueue(formatSSE({ type: 'connected', userId }))

      // Subscribe to events for this user
      const unsubscribe = subscribeToUserEvents(userId, (event) => {
        try {
          controller.enqueue(formatSSE(event))
        } catch {
          // Connection closed — ignore
        }
      })

      // Heartbeat — prevents proxy timeouts (every 30s)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(': heartbeat\n\n')
        } catch {
          clearInterval(heartbeat)
        }
      }, 30_000)

      // Cleanup when client disconnects
      request.signal.addEventListener('abort', () => {
        unsubscribe()
        clearInterval(heartbeat)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',   // Disable Nginx buffering (important for Coolify/DigitalOcean)
    },
  })
}

function formatSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}
```

### In-Memory Event Bus (Simple, Single-Instance)

Works for SuperBad HQ (single Coolify instance). For multi-instance deployments, replace with Redis pub/sub.

```typescript
// src/lib/realtime/event-bus.ts
type EventCallback = (event: RealtimeEvent) => void

interface RealtimeEvent {
  type: 'notification' | 'approval_requested' | 'approval_decision' | 'new_message'
  payload: Record<string, unknown>
}

const subscribers = new Map<string, Set<EventCallback>>()

export function subscribeToUserEvents(userId: string, callback: EventCallback) {
  if (!subscribers.has(userId)) {
    subscribers.set(userId, new Set())
  }
  subscribers.get(userId)!.add(callback)

  // Return unsubscribe function
  return () => {
    subscribers.get(userId)?.delete(callback)
  }
}

export function pushEventToUser(userId: string, event: RealtimeEvent) {
  subscribers.get(userId)?.forEach(callback => callback(event))
}

export function pushEventToAll(event: RealtimeEvent) {
  subscribers.forEach(callbacks => callbacks.forEach(cb => cb(event)))
}
```

### Triggering Events from Anywhere

```typescript
// In an API route, Server Action, or webhook handler:
import { pushEventToUser } from '@/lib/realtime/event-bus'

// When a client submits an approval request:
await pushEventToUser(andyUserId, {
  type: 'approval_requested',
  payload: {
    clientName: 'Dr Sarah Chen',
    assetName: 'April Campaign Creative',
    approvalId: 'APR123',
  },
})
```

### Client — EventSource Hook

```typescript
// src/hooks/useRealtimeEvents.ts
'use client'
import { useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface RealtimeEvent {
  type: string
  payload: Record<string, unknown>
}

export function useRealtimeEvents(onEvent?: (event: RealtimeEvent) => void) {
  const handleEvent = useCallback((event: RealtimeEvent) => {
    // Default toast notifications
    if (event.type === 'approval_requested') {
      toast.info(`Approval needed: ${event.payload.clientName} — ${event.payload.assetName}`)
    }

    if (event.type === 'new_message') {
      toast.info(`New message from ${event.payload.clientName}`)
    }

    onEvent?.(event)
  }, [onEvent])

  useEffect(() => {
    const source = new EventSource('/api/notifications/stream')

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type !== 'connected') {
          handleEvent(data)
        }
      } catch {
        // Ignore parse errors
      }
    }

    source.onerror = () => {
      // Browser auto-reconnects on error — no manual retry needed
    }

    return () => source.close()
  }, [handleEvent])
}
```

**Usage in layout:**
```typescript
// src/app/(platform)/layout.tsx
'use client'
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents'

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  useRealtimeEvents()  // Starts SSE connection for the whole app
  return <>{children}</>
}
```

---

## Pattern B — WebSockets

**Use for:** Bidirectional real-time (live chat, collaborative editing, typing indicators). Next.js doesn't support WebSocket upgrade natively — run a separate `ws` server.

```bash
npm install ws
npm install -D @types/ws
```

```typescript
// src/lib/realtime/websocket-server.ts
// Run alongside Next.js dev server using a custom server.ts
import { WebSocketServer, WebSocket } from 'ws'

const wss = new WebSocketServer({ port: 3001 })

const connections = new Map<string, WebSocket>()

wss.on('connection', (ws, req) => {
  const userId = extractUserIdFromRequest(req)
  if (!userId) { ws.close(1008, 'Unauthorized'); return }

  connections.set(userId, ws)

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString())
    handleMessage(userId, message)
  })

  ws.on('close', () => connections.delete(userId))
})

export function sendToUser(userId: string, event: object) {
  const ws = connections.get(userId)
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event))
  }
}
```

**Note:** The WebSocket server runs on port 3001. Coolify must expose this port too. For SuperBad HQ, SSE covers all current use cases — only add WebSockets if genuinely needed.

---

## Use Case Decision Table

| Feature | Pattern | Reason |
|---------|---------|--------|
| Approval request notifications | SSE | Server → client only |
| New inbound SMS alert | SSE | Server → client only |
| Background job progress (report generation) | SSE | Server → client only |
| Dashboard live counters | SSE | Server → client only |
| Client portal approval status | SSE | Server → client only |
| Live chat (if ever needed) | WebSockets | Bidirectional |
| Collaborative editing | WebSockets | Bidirectional |

---

## Critical Rules

- **`X-Accel-Buffering: no`** header is mandatory for Coolify/DigitalOcean — without it Nginx buffers SSE and messages don't arrive in real time
- **Heartbeat every 30s** prevents proxies from closing idle connections
- **Browser auto-reconnects** on SSE errors — no manual reconnect logic needed
- **In-memory event bus** is fine for single-instance deployments (Coolify runs one container). If scaling to multiple instances later, replace with Redis pub/sub
- **Never block the SSE handler** — push events asynchronously; the handler should return immediately
