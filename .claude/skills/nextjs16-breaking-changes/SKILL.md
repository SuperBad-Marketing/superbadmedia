# Next.js 16 Breaking Changes Skill

Source: https://github.com/gocallum/nextjs16-agent-skills

superbad-hq runs Next.js 16.2.2. This skill documents the critical breaking changes and new patterns.

---

## CRITICAL: Async Request APIs

In Next.js 16, `headers()`, `cookies()`, `params`, and `searchParams` are **now async**. This is the most common source of bugs when migrating.

```typescript
// ❌ Next.js 14/15 — synchronous (BROKEN in Next.js 16)
import { headers, cookies } from 'next/headers'
const h = headers()
const c = cookies()

// ✅ Next.js 16 — must await
import { headers, cookies } from 'next/headers'
const h = await headers()
const c = await cookies()
```

```typescript
// ❌ Old — params direct access
export default function Page({ params }: { params: { id: string } }) {
  const id = params.id  // BROKEN
}

// ✅ New — params are a Promise
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}

// ✅ Same for searchParams
export default async function Page({ searchParams }: { searchParams: Promise<{ q: string }> }) {
  const { q } = await searchParams
}
```

---

## Turbopack is Default in Dev

Next.js 16 uses Turbopack by default for `next dev`. No config needed.

```bash
next dev              # Turbopack (default, fast)
next dev --webpack    # Opt back to webpack if you hit a bug
next build            # Still uses webpack for production
```

---

## Server Actions

Server Actions are stable and the preferred way to handle form mutations:

```typescript
// app/actions.ts
'use server'

export async function createClient(formData: FormData) {
  const name = formData.get('name') as string
  // Database write, revalidation, etc.
  revalidatePath('/clients')
}

// In a Server Component
import { createClient } from './actions'

export default function Page() {
  return (
    <form action={createClient}>
      <input name="name" />
      <button type="submit">Add Client</button>
    </form>
  )
}
```

### GOTCHA: `"use server"` files may ONLY export async functions

This is a **React rule**, enforced at build time by Turbopack. Every export from a `"use server"` file must be an `async function`. Exporting anything else — constants, arrays, objects, plain functions, type aliases — is a build error.

```typescript
// ❌ BREAKS THE BUILD
'use server'

export const QUESTIONS_PER_SECTION = 15        // constant → error
export const QUESTION_BANK = [...]              // array → error
export type SubmitResult = { ok: boolean }      // type → error
export function helper() { ... }                // non-async fn → error

export async function submitAnswer(...) { ... } // ✓ only this is allowed
```

```typescript
// ✓ CORRECT — split into two files

// lib/feature/constants.ts (plain module)
export const QUESTIONS_PER_SECTION = 15
export const QUESTION_BANK = [...]
export type SubmitResult = { ok: boolean }

// app/feature/actions.ts (Server Actions only)
'use server'
import { QUESTION_BANK, type SubmitResult } from '@/lib/feature/constants'

export async function submitAnswer(...): Promise<SubmitResult> { ... }
```

**Rule of thumb:** `actions.ts` holds async functions and nothing else. Constants, question banks, type aliases, pure helpers all live in a sibling non-`"use server"` file and are imported in.

---

## `after()` for Non-Blocking Side Effects

Run code after the response is sent — for logging, analytics, webhooks:

```typescript
import { after } from 'next/server'

export async function POST(req: Request) {
  const data = await req.json()
  const result = await processData(data)

  // This runs AFTER the response is sent — doesn't block the user
  after(async () => {
    await logToAnalytics(data)
    await notifyWebhook(result)
  })

  return Response.json(result)
}
```

---

## `unstable_cache` → `use cache`

The new `use cache` directive is the preferred caching approach:

```typescript
// ✅ New approach
async function getData() {
  'use cache'
  return await fetchFromDatabase()
}

// Still works — but use 'use cache' for new code
import { unstable_cache } from 'next/cache'
const getCached = unstable_cache(async () => fetchData(), ['key'])
```

---

## `React.cache()` for Per-Request Deduplication

```typescript
import { cache } from 'react'

// Deduplicate identical calls within a single request
export const getClient = cache(async (id: string) => {
  return await db.clients.findById(id)
})

// Call it multiple times — only one DB query per request
const client1 = await getClient('123')
const client2 = await getClient('123')  // Uses cached result
```

---

## Route Handlers — Parallel Async Operations

```typescript
// ❌ Sequential — slow
export async function GET() {
  const clients = await getClients()
  const metrics = await getMetrics()
  const prospects = await getProspects()
  return Response.json({ clients, metrics, prospects })
}

// ✅ Parallel — fast
export async function GET() {
  const [clients, metrics, prospects] = await Promise.all([
    getClients(),
    getMetrics(),
    getProspects(),
  ])
  return Response.json({ clients, metrics, prospects })
}
```

---

## Type Changes

```typescript
// Updated param types for Next.js 16
type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Layout params
type LayoutProps = {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}
```

---

## `serverExternalPackages` (already in next.config.ts)

Heavy packages that should not be bundled (already configured in superbad-hq):
```typescript
// next.config.ts — already set up correctly
serverExternalPackages: ['@remotion/renderer', '@remotion/bundler', 'esbuild']
```

---

## Common Migration Mistakes

- Accessing `params.id` synchronously → must `await params` first
- Using `headers()` without `await` in API routes
- Forgetting `async` on Page/Layout components that use `params`
- Not wrapping non-blocking work in `after()`
- Running sequential `await` chains that could be `Promise.all()`
