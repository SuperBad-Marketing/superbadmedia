---
name: typescript-validation
description: Type-safe form validation and API contracts using Zod + React Hook Form in Next.js App Router. Covers schema definition, type inference, Server Actions, API route validation, and error handling patterns for superbad-hq.
---

# TypeScript Validation — Zod + React Hook Form

superbad-hq uses TypeScript throughout. All forms and API boundaries must be type-safe and validated. The stack is:

- **Zod** — schema definition + validation (both client and server)
- **React Hook Form** — form state management + performance
- **`@hookform/resolvers/zod`** — connects the two
- **Next.js Server Actions** — for form submissions

---

## 1. Install Check

```bash
# Check package.json before assuming these exist
# If missing:
# npm install zod react-hook-form @hookform/resolvers
```

---

## 2. Define Schemas Once, Use Everywhere

The golden rule: **define your Zod schema once and derive TypeScript types from it**. Never write duplicate type definitions.

```tsx
// src/lib/schemas/client.ts
import { z } from 'zod'

export const clientSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid phone number').optional().or(z.literal('')),
  tier: z.enum(['trial', 'retainer', 'flagship']),
  vertical: z.enum(['medical-aesthetics', 'financial', 'allied-health', 'other']),
  monthlyBudget: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
  startDate: z.string().datetime().optional(),
})

// Derive TypeScript type — never write this manually
export type ClientFormData = z.infer<typeof clientSchema>

// Partial schema for updates (all fields optional)
export const updateClientSchema = clientSchema.partial()
export type UpdateClientData = z.infer<typeof updateClientSchema>

// Pick subset for a specific form
export const quickAddClientSchema = clientSchema.pick({ name: true, email: true, tier: true })
export type QuickAddClientData = z.infer<typeof quickAddClientSchema>
```

---

## 3. React Hook Form + Zod — Standard Pattern

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientSchema, type ClientFormData } from '@/lib/schemas/client'

export function ClientForm({ onSubmit }: { onSubmit: (data: ClientFormData) => Promise<void> }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty, isValid },
    reset,
    setError,
    watch,
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      tier: 'retainer',
      vertical: 'medical-aesthetics',
    },
    mode: 'onBlur', // validate on blur for better UX
  })

  const handleFormSubmit = async (data: ClientFormData) => {
    try {
      await onSubmit(data)
      reset()
    } catch (error) {
      // Set server-side errors back onto specific fields
      if (error instanceof Error && error.message.includes('email')) {
        setError('email', { message: 'This email is already registered' })
      } else {
        setError('root', { message: 'Failed to save. Please try again.' })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate aria-labelledby="form-title">
      <h2 id="form-title" className="text-lg font-semibold text-sb-cream mb-6">Add Client</h2>

      {/* Root-level error */}
      {errors.root && (
        <div role="alert" className="mb-4 p-3 bg-sb-danger/10 border border-sb-danger/20 rounded text-sm text-sb-danger">
          {errors.root.message}
        </div>
      )}

      {/* Field */}
      <Field
        label="Business name"
        required
        error={errors.name?.message}
        htmlFor="name"
      >
        <input
          id="name"
          type="text"
          {...register('name')}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className={inputClass(!!errors.name)}
        />
      </Field>

      {/* Select */}
      <Field label="Service tier" required error={errors.tier?.message} htmlFor="tier">
        <select id="tier" {...register('tier')} className={inputClass(!!errors.tier)}>
          <option value="trial">Trial Shoot — $297</option>
          <option value="retainer">Performance Retainer — $3,997/mo</option>
          <option value="flagship">Flagship — $8,500–$12,500/mo</option>
        </select>
      </Field>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || !isDirty}
        aria-busy={isSubmitting}
        className="w-full py-2.5 bg-sb-accent text-sb-cream rounded-lg font-medium hover:bg-sb-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Saving...' : 'Save client'}
      </button>
    </form>
  )
}

// Reusable field wrapper
function Field({ label, required, error, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label htmlFor={htmlFor} className="text-sm font-medium text-sb-cream/80">
        {label}
        {required && <span aria-hidden="true" className="text-sb-danger ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-sb-danger">
          {error}
        </p>
      )}
    </div>
  )
}

// Input class helper
function inputClass(hasError: boolean) {
  return `w-full px-3 py-2 bg-sb-card border rounded-lg text-sm text-sb-cream placeholder:text-sb-cream/30 focus:outline-none focus:ring-2 focus:ring-sb-accent/50 transition-colors ${
    hasError ? 'border-sb-danger/50' : 'border-sb-cream/10 hover:border-sb-cream/20'
  }`
}
```

---

## 4. Server Actions with Zod

Use the same schema on both client and server — never trust the client alone.

```tsx
// src/app/actions/clients.ts
'use server'

import { z } from 'zod'
import { clientSchema } from '@/lib/schemas/client'
import { revalidatePath } from 'next/cache'

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export async function createClientAction(
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  // 1. Validate on the server — always
  const parsed = clientSchema.safeParse(formData)

  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 2. Business logic with validated + typed data
  try {
    const client = await saveClientToFile(parsed.data)
    revalidatePath('/clients')
    return { success: true, data: { id: client.id } }
  } catch (err) {
    return { success: false, error: 'Failed to create client. Please try again.' }
  }
}
```

```tsx
// Using Server Action in a Client Component
'use client'
import { createClientAction } from '@/app/actions/clients'

const handleSubmit = async (data: ClientFormData) => {
  const result = await createClientAction(data)

  if (!result.success) {
    // Re-map server field errors back to RHF
    if (result.fieldErrors) {
      Object.entries(result.fieldErrors).forEach(([field, messages]) => {
        setError(field as keyof ClientFormData, { message: messages[0] })
      })
    } else {
      setError('root', { message: result.error })
    }
    return
  }

  router.push(`/clients/${result.data?.id}`)
}
```

---

## 5. API Route Validation

Every API route that accepts a body must validate it with Zod.

```tsx
// src/app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { clientSchema } from '@/lib/schemas/client'

export async function POST(request: NextRequest) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = clientSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    )
  }

  // parsed.data is fully typed here
  const client = await createClient(parsed.data)
  return NextResponse.json(client, { status: 201 })
}
```

---

## 6. Common Schema Patterns

```tsx
import { z } from 'zod'

// Optional string that allows empty string
const optionalString = z.string().optional().or(z.literal(''))

// Australian phone
const auPhone = z.string().regex(/^(\+61|0)[2-9]\d{8}$/, 'Invalid Australian phone number')

// Currency (store as cents to avoid float issues)
const cents = z.number().int().min(0)

// Date range
const dateRange = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
}).refine(r => new Date(r.from) <= new Date(r.to), {
  message: 'End date must be after start date',
  path: ['to'],
})

// File upload
const fileUpload = z.object({
  name: z.string(),
  size: z.number().max(10 * 1024 * 1024, 'File must be under 10MB'),
  type: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
})

// Paginated query params
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
})

// API route usage
export async function GET(request: NextRequest) {
  const params = paginationSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  )
  if (!params.success) {
    return NextResponse.json({ error: 'Invalid query params' }, { status: 400 })
  }
  // params.data.page, params.data.limit, etc — all typed
}
```

---

## 7. Multi-Step Forms

```tsx
// Define each step's schema separately, then combine
const step1Schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
})

const step2Schema = z.object({
  tier: z.enum(['trial', 'retainer', 'flagship']),
  budget: z.number().min(0),
})

const step3Schema = z.object({
  notes: z.string().optional(),
  startDate: z.string().datetime().optional(),
})

// Full schema for final submission
const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema)
type FullFormData = z.infer<typeof fullSchema>

// In component — validate current step only before advancing
const STEP_SCHEMAS = [step1Schema, step2Schema, step3Schema]

const validateStep = async (step: number, data: Partial<FullFormData>) => {
  const result = STEP_SCHEMAS[step].safeParse(data)
  return result.success
}
```

---

## 8. Reusable Controlled Input Components

```tsx
// src/components/ui/FormInput.tsx
import { useFormContext } from 'react-hook-form'

interface FormInputProps {
  name: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
  hint?: string
}

export function FormInput({ name, label, type = 'text', required, placeholder, hint }: FormInputProps) {
  const { register, formState: { errors } } = useFormContext()
  const error = errors[name]?.message as string | undefined
  const hintId = hint ? `${name}-hint` : undefined
  const errorId = error ? `${name}-error` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-sb-cream/80">
        {label}
        {required && <span aria-hidden="true" className="text-sb-danger ml-1">*</span>}
      </label>
      <input
        id={name}
        type={type}
        placeholder={placeholder}
        {...register(name)}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={`px-3 py-2 bg-sb-card border rounded-lg text-sm text-sb-cream placeholder:text-sb-cream/30 focus:outline-none focus:ring-2 focus:ring-sb-accent/50 ${
          error ? 'border-sb-danger/50' : 'border-sb-cream/10'
        }`}
      />
      {hint && <p id={hintId} className="text-xs text-sb-cream/40">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs text-sb-danger">{error}</p>}
    </div>
  )
}

// Usage with FormProvider:
// <FormProvider {...methods}><FormInput name="email" label="Email" type="email" required /></FormProvider>
```

---

## 9. Type Guards & Runtime Checks

```tsx
// When consuming API responses, always validate
async function fetchClient(id: string): Promise<Client> {
  const res = await fetch(`/api/clients/${id}`)
  const json = await res.json()

  const parsed = clientSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error(`Invalid client data: ${parsed.error.message}`)
  }

  return parsed.data
}

// Discriminated union for API responses
const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.discriminatedUnion('success', [
    z.object({ success: z.literal(true), data: dataSchema }),
    z.object({ success: z.literal(false), error: z.string() }),
  ])
```

---

## 10. Quick Reference

```tsx
// Basic string with constraints
z.string().min(1).max(255)

// Number coercion from form inputs (strings)
z.coerce.number().int().positive()

// Optional vs nullable
z.string().optional()   // string | undefined
z.string().nullable()   // string | null
z.string().nullish()    // string | null | undefined

// Transform
z.string().toLowerCase()  // .transform(v => v.toLowerCase())
z.string().trim()

// Conditional validation
z.object({
  paymentType: z.enum(['invoice', 'card']),
  invoiceEmail: z.string().email().optional(),
}).refine(
  (data) => data.paymentType !== 'invoice' || !!data.invoiceEmail,
  { message: 'Invoice email required for invoice payment', path: ['invoiceEmail'] }
)

// Safe parse (never throws)
const result = schema.safeParse(input)
if (result.success) { result.data } else { result.error }

// Type from schema
type T = z.infer<typeof schema>

// Extend a schema
const extended = baseSchema.extend({ newField: z.string() })

// Pick / omit
const picked = fullSchema.pick({ name: true, email: true })
const omitted = fullSchema.omit({ internalId: true })
```
