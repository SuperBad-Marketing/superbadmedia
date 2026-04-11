# React 19 Skill

superbad-hq runs React 19.2.4. This skill covers new APIs and patterns available in React 19.

---

## `use()` Hook — Read Promises and Context

```typescript
import { use, Suspense } from 'react'

// Unwrap a Promise inside a component (must be wrapped in Suspense)
function ClientCard({ clientPromise }: { clientPromise: Promise<Client> }) {
  const client = use(clientPromise)  // suspends until resolved
  return <div>{client.name}</div>
}

export default function Page() {
  const clientPromise = fetchClient('123')
  return (
    <Suspense fallback={<Skeleton />}>
      <ClientCard clientPromise={clientPromise} />
    </Suspense>
  )
}

// Read Context with use() (can be called conditionally unlike useContext)
const theme = use(ThemeContext)
```

---

## `useActionState` — Form State with Server Actions

```typescript
import { useActionState } from 'react'
import { createProspect } from './actions'

export function ProspectForm() {
  const [state, action, isPending] = useActionState(createProspect, { error: null })

  return (
    <form action={action}>
      <input name="name" required />
      {state.error && <p className="text-red-500">{state.error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Adding...' : 'Add Prospect'}
      </button>
    </form>
  )
}

// Server action
'use server'
export async function createProspect(prevState: any, formData: FormData) {
  const name = formData.get('name')
  if (!name) return { error: 'Name is required' }
  await db.prospects.create({ name })
  revalidatePath('/prospects')
  return { error: null }
}
```

---

## `useFormStatus` — Pending State Inside a Form

```typescript
import { useFormStatus } from 'react-dom'

// Must be a child of a <form> element
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving...' : 'Save'}
    </button>
  )
}
```

---

## `useOptimistic` — Optimistic UI Updates

```typescript
import { useOptimistic } from 'react'

export function TaskList({ tasks }: { tasks: Task[] }) {
  const [optimisticTasks, addOptimisticTask] = useOptimistic(
    tasks,
    (state, newTask: Task) => [...state, newTask]
  )

  async function handleAdd(formData: FormData) {
    const task = { id: crypto.randomUUID(), title: formData.get('title') as string }
    addOptimisticTask(task)  // Show immediately
    await createTask(task)   // Persist in background
  }

  return (
    <form action={handleAdd}>
      {optimisticTasks.map(t => <TaskItem key={t.id} task={t} />)}
      <input name="title" />
      <button type="submit">Add</button>
    </form>
  )
}
```

---

## `startTransition` with Async Functions

```typescript
import { startTransition, useState } from 'react'

function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  function handleSearch(value: string) {
    setQuery(value)  // Urgent update — happens immediately
    startTransition(async () => {
      const data = await fetchSearch(value)  // Non-urgent — won't block input
      setResults(data)
    })
  }
}
```

---

## Ref as a Prop (no `forwardRef` needed)

```typescript
// React 19 — ref is a regular prop
function Input({ ref, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />
}

// Use it
const inputRef = useRef<HTMLInputElement>(null)
<Input ref={inputRef} placeholder="Search..." />
```

---

## Context as a Provider

```typescript
// React 19 — use Context directly as a provider
const ThemeContext = createContext('light')

// ✅ New
<ThemeContext value="dark">
  {children}
</ThemeContext>

// ❌ Old (still works but verbose)
<ThemeContext.Provider value="dark">
  {children}
</ThemeContext.Provider>
```

---

## `useDeferredValue` with `initialValue`

```typescript
// New: provide initial value to avoid a Suspense fallback flash
const deferredQuery = useDeferredValue(query, '')  // '' is shown immediately on first render
```

---

## Document Metadata in Server Components

```typescript
// No need for next/head or react-helmet — return directly from components
export default function ClientPage({ client }: { client: Client }) {
  return (
    <>
      <title>{client.name} — SuperBad HQ</title>
      <meta name="description" content={`Client: ${client.name}`} />
      <main>...</main>
    </>
  )
}
```

---

## Error Boundaries — New `onCaughtError` / `onUncaughtError`

```typescript
<ErrorBoundary
  onCaughtError={(error, info) => console.error('Caught:', error, info)}
  fallback={<ErrorFallback />}
>
  {children}
</ErrorBoundary>
```

---

## What Changed from React 18

| Feature | React 18 | React 19 |
|---|---|---|
| Read async data | SWR/useEffect | `use(promise)` |
| Form state | Custom hooks | `useActionState` |
| Submit pending | Manual state | `useFormStatus` |
| Optimistic UI | Manual | `useOptimistic` |
| Ref forwarding | `forwardRef` | Ref as prop |
| Context provider | `.Provider` | Direct |
| Async transitions | No | Yes in `startTransition` |
