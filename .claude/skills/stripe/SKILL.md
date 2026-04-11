---
name: stripe
description: Stripe Node.js SDK for SuperBad HQ invoicing and payments. Covers customer management, one-off payment intents, subscription/recurring billing for retainers, webhook handling (with raw body requirement), invoice generation, and Australian GST considerations. Used for Session 6.1.
---

# Stripe — Invoicing & Payments for SuperBad HQ

Session 6.1 builds automated invoicing and payment tracking. SuperBad's billing model: one-off Trial Shoot ($297), monthly Performance Retainer ($3,997/mo), monthly Flagship ($8,500–$12,500/mo). All setup via the in-platform wizard at `/settings/integrations/stripe`.

## Install

```bash
npm install stripe
```

## Environment Variables

```bash
STRIPE_SECRET_KEY=sk_live_...        # or sk_test_... in dev
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...      # from Stripe CLI or dashboard
```

---

## 1. Stripe Client Singleton

```typescript
// src/lib/stripe.ts
import Stripe from 'stripe'

const globalForStripe = globalThis as unknown as { stripe: Stripe }

export const stripe = globalForStripe.stripe ?? new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})

if (process.env.NODE_ENV !== 'production') globalForStripe.stripe = stripe
```

---

## 2. Customer Management

```typescript
// src/lib/billing/customers.ts
import { stripe } from '@/lib/stripe'
import { db } from '@/db'
import { clients } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Create or retrieve Stripe customer (call once per client at onboarding)
export async function getOrCreateStripeCustomer(clientId: string) {
  const client = await db.select().from(clients).where(eq(clients.id, clientId)).get()
  if (!client) throw new Error('Client not found')

  if (client.stripeCustomerId) {
    return stripe.customers.retrieve(client.stripeCustomerId)
  }

  const customer = await stripe.customers.create({
    email: client.email,
    name: client.name,
    metadata: { clientId, platform: 'superbad_hq' },
  })

  await db.update(clients)
    .set({ stripeCustomerId: customer.id })
    .where(eq(clients.id, clientId))

  return customer
}
```

---

## 3. One-Off Invoice (Trial Shoot, Ad Hoc)

```typescript
// src/lib/billing/invoices.ts
import { stripe } from '@/lib/stripe'

export async function createOneOffInvoice({
  stripeCustomerId,
  description,
  amountAUD,         // in dollars (not cents)
  dueInDays = 7,
}: {
  stripeCustomerId: string
  description: string
  amountAUD: number
  dueInDays?: number
}) {
  // Create invoice item
  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
    amount: Math.round(amountAUD * 100),  // Stripe uses cents
    currency: 'aud',
    description,
  })

  // Create and finalise invoice
  const invoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: 'send_invoice',
    days_until_due: dueInDays,
    metadata: { platform: 'superbad_hq' },
    // Australian tax — apply tax rate if registered for GST
    // default_tax_rates: [process.env.STRIPE_GST_RATE_ID!],
  })

  const finalised = await stripe.invoices.finalizeInvoice(invoice.id)
  await stripe.invoices.sendInvoice(finalised.id)

  return finalised
}
```

---

## 4. Subscription — Recurring Retainer Billing

```typescript
// src/lib/billing/subscriptions.ts
import { stripe } from '@/lib/stripe'

// Price IDs — create these in Stripe dashboard once, then store in env
// STRIPE_PRICE_RETAINER=price_xxx   ($3,997/mo)
// STRIPE_PRICE_FLAGSHIP_LOW=price_xxx ($8,500/mo)
// STRIPE_PRICE_FLAGSHIP_HIGH=price_xxx ($12,500/mo)

export async function createRetainerSubscription({
  stripeCustomerId,
  priceId,
  trialDays = 0,
}: {
  stripeCustomerId: string
  priceId: string
  trialDays?: number
}) {
  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    trial_period_days: trialDays || undefined,
    metadata: { platform: 'superbad_hq' },
  })

  return subscription
}

export async function cancelSubscription(subscriptionId: string, immediately = false) {
  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId)
  }
  // Cancel at end of billing period
  return stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
}
```

---

## 5. Webhook Handler — CRITICAL

Webhooks require the **raw request body** — this is the most common source of webhook signature errors.

```typescript
// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { db } from '@/db'
import { invoices } from '@/db/schema'

// MUST disable body parsing — Stripe needs the raw bytes to verify signature
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()          // raw string, not parsed JSON
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Handle events
  switch (event.type) {
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      await db.update(invoices)
        .set({ status: 'paid', paidAt: new Date() })
        .where(eq(invoices.stripeInvoiceId, invoice.id))
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await db.update(invoices)
        .set({ status: 'overdue' })
        .where(eq(invoices.stripeInvoiceId, invoice.id))
      // Telegram alert
      await notifyTelegram(`⚠️ Payment failed: ${invoice.customer_email} — $${(invoice.amount_due / 100).toFixed(2)}`)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      // Mark client as churned
      break
    }
  }

  return NextResponse.json({ received: true })
}
```

---

## 6. Invoices DB Schema

```typescript
// src/db/schema/invoices.ts
export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text('client_id').references(() => clients.id).notNull(),
  stripeInvoiceId: text('stripe_invoice_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  description: text('description').notNull(),
  amountCents: integer('amount_cents').notNull(),   // always store in cents
  currency: text('currency').default('aud'),
  status: text('status', {
    enum: ['draft', 'sent', 'paid', 'overdue', 'void']
  }).notNull().default('draft'),
  invoiceUrl: text('invoice_url'),   // Stripe-hosted invoice page
  pdfUrl: text('pdf_url'),
  dueAt: integer('due_at', { mode: 'timestamp' }),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})
```

---

## 7. Setup Wizard — Connection Test

```typescript
// src/app/api/integrations/stripe/test/route.ts
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const account = await stripe.accounts.retrieve()
    return NextResponse.json({
      connected: true,
      accountName: account.business_profile?.name ?? account.email,
      country: account.country,
      currency: account.default_currency,
    })
  } catch {
    return NextResponse.json({ connected: false }, { status: 400 })
  }
}
```

---

## 8. Australian GST

- Standard GST rate: 10%
- Create a Tax Rate in Stripe Dashboard → Products → Tax rates → `10% GST (inclusive or exclusive)`
- Store the Tax Rate ID: `STRIPE_GST_RATE_ID=txr_xxx`
- Apply to invoices via `default_tax_rates: [process.env.STRIPE_GST_RATE_ID!]`
- Stripe handles GST display and calculation automatically

---

## 9. Local Webhook Testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# The CLI outputs a webhook signing secret — add to .env.local as STRIPE_WEBHOOK_SECRET
```

---

## 10. Critical Rules

- **Raw body for webhooks** — never parse the body as JSON before signature verification
- **Store amounts in cents** — always, no exceptions
- **Idempotency keys** for mutations — pass `idempotencyKey` to prevent duplicate charges
- **Test mode first** — use `sk_test_` keys in dev, only switch to `sk_live_` in production Coolify env
- **Webhook secret differs** between Stripe CLI (dev) and the production endpoint registered in Stripe dashboard
- **Never store card details** — Stripe handles all card data; we only store customer IDs and invoice IDs
