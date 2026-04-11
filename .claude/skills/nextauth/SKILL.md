---
name: nextauth
description: Auth.js v5 (NextAuth.js v5) for Next.js App Router. Covers credentials provider, middleware route protection, auth() in Server Components and API routes, session type augmentation, and role-based access control for SuperBad HQ. Used for Session 0.4 and all protected features.
---

# Auth.js v5 (NextAuth) — SuperBad HQ Authentication

SuperBad HQ uses Auth.js v5 (the new NextAuth). The API is completely different from v4 — do not use v4 patterns. Andy is the sole admin user initially; the architecture must support adding team members and client portal users later (Phase 7).

## Install

```bash
npm install next-auth@beta
npx auth secret   # generates AUTH_SECRET, adds to .env.local
```

---

## 1. Core Config — `auth.ts`

```typescript
// src/auth.ts  (project root level, not in app/)
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { loginSchema } from '@/lib/schemas/auth'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .get()

        if (!user || !user.passwordHash) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],

  callbacks: {
    // Persist role in JWT token
    jwt({ token, user }) {
      if (user) token.role = (user as any).role
      return token
    },
    // Expose role in session object
    session({ session, token }) {
      if (session.user) session.user.role = token.role as string
      return session
    },
  },

  pages: {
    signIn: '/login',     // custom login page
    error: '/login',      // redirect errors back to login
  },
})
```

---

## 2. Route Handler — `app/api/auth/[...nextauth]/route.ts`

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

---

## 3. Middleware — Route Protection

```typescript
// middleware.ts  (project root)
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/login')
  const isPublicPage = req.nextUrl.pathname.startsWith('/portal') // client portal has own auth
  const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth')

  if (isApiAuth) return NextResponse.next()

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isAuthPage && !isPublicPage) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect logged-in users away from login page
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  // Match all routes except static files, images, and favicons
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
```

---

## 4. TypeScript Session Type Augmentation

```typescript
// src/types/next-auth.d.ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      role: 'admin' | 'team' | 'client'
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: 'admin' | 'team' | 'client'
  }
}
```

---

## 5. Using `auth()` in Server Components

```typescript
// Any Server Component or page
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) redirect('/login')

  // Role-based gate
  if (session.user.role !== 'admin') redirect('/unauthorized')

  return <Dashboard user={session.user} />
}
```

---

## 6. Using `auth()` in API Route Handlers

```typescript
// src/app/api/clients/route.ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... fetch and return data
}
```

---

## 7. Users Table Schema (Drizzle)

```typescript
// src/db/schema/users.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  role: text('role', { enum: ['admin', 'team', 'client'] }).notNull().default('team'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export type User = typeof users.$inferSelect
```

---

## 8. Seeding Andy's Admin Account

```typescript
// scripts/seed-admin.ts — run once after DB migration
import bcrypt from 'bcryptjs'
import { db } from '../src/db'
import { users } from '../src/db/schema'

async function seed() {
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 12)

  await db.insert(users).values({
    name: 'Andy Robinson',
    email: 'andy@superbadmedia.com.au',
    passwordHash: hash,
    role: 'admin',
  }).onConflictDoNothing()

  console.log('Admin user seeded.')
}

seed()
```

Set `ADMIN_PASSWORD` in `.env.local` — never hardcode it.

---

## 9. Login Page Pattern

```typescript
// src/app/login/page.tsx
'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      email: form.get('email'),
      password: form.get('password'),
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="sb-login-form">
      {error && <p role="alert" className="sb-error">{error}</p>}
      <input name="email" type="email" required placeholder="Email" />
      <input name="password" type="password" required placeholder="Password" />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
```

---

## 10. Environment Variables

```bash
# .env.local
AUTH_SECRET=<generated by npx auth secret>
ADMIN_PASSWORD=<strong password for Andy's account>
```

---

## 11. Critical Rules

- **Auth.js v5 only** — completely different from v4. `import { auth } from '@/auth'` not `getServerSession()`
- **Never `getServerSession()`** — that's v4 API
- **Middleware handles redirects** — don't duplicate auth checks in every page
- **`bcryptjs` not `bcrypt`** — bcryptjs works in Next.js without native bindings
- **Role is in the JWT** — set it in the `jwt` callback, read it from `session` callback
- **Client portal users** — same users table, `role: 'client'`, separate portal route group `/portal/(auth)/`
- **`AUTH_SECRET` must be set** in Coolify environment for production — app will not start without it
