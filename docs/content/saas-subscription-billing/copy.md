# SaaS Subscription Billing — General Copy

**Surface:** Various SaaS billing surfaces not covered by dedicated files. **Spec:** `docs/specs/saas-subscription-billing.md` §10, §14. **Author:** Claude (CMS-4).

Dedicated content files exist for: [checkout.md](./checkout.md), [pricing-page.md](./pricing-page.md), [usage-bar.md](./usage-bar.md), [cap-and-lockout.md](./cap-and-lockout.md), [cancel-flow.md](./cancel-flow.md), [emails.md](./emails.md). This file covers the remaining surfaces.

---

## Upgrade confirmation moment

Renders immediately after a successful tier upgrade. Brief — the moment lands and moves on.

- **Heading:** `{newTierName}.`
- **Body:** `Upgrade's live. {dimensionSummary} Your next invoice reflects the change.`
- **Auto-dismiss:** fades after 5 seconds, returns to product UI.

### Voice

Single word as the heading. The full stop does the work. No "Congratulations!" No confetti. The product just got bigger — the subscriber knows what they did.

---

## First-login bartender line

The bartender's opening line on the subscriber's first portal session after payment. Acknowledges commitment without being sycophantic.

### Monthly

- `Welcome in. You've got {productName} running. Let me know if you need anything.`

### Annual (monthly-billed)

- `Twelve months. That's a commitment. {productName} is live — let me know what you need.`

### Annual (upfront)

- `All in. {productName} is yours for the year. I'll be here when you need me.`

### Voice

One line. Acknowledges the commitment level without celebrating it. The bartender is a colleague, not a customer service bot. "Let me know" is the register — available, not eager.

---

## Product admin empty states

### No products yet (`/lite/products` — first visit)

- **Heading:** `No products yet.`
- **Body:** `This is where your SaaS tools live. Build one with the wizard and it goes on the shelf — pricing page, demo, checkout, the lot.`
- **CTA:** `Create your first product`

### No subscribers (product detail — subscribers tab)

- **Heading:** `No subscribers on {productName} yet.`
- **Body:** `They'll show up here when they do. Tier, billing, usage, health — everything in one place.`

### No revenue data (product detail — overview tab, early days)

- **Heading:** `No revenue data yet.`
- **Body:** `MRR, churn, tier distribution — it all starts counting from the first subscription.`

### Product archived notice

- **Banner:** `{productName} is archived. Existing subscribers continue, but no new signups.`
- **Unarchive CTA:** `Bring it back`

---

## Browser tab titles

| Page | Title |
|------|-------|
| `/lite/products` (index) | `Products — SuperBad Lite` |
| `/lite/products` (with subscriber count) | `Products ({subscriberCount}) — SuperBad Lite` |
| `/lite/products/{slug}` (detail) | `{productName} — SuperBad Lite` |
| `/lite/products/new` (wizard) | `New product — SuperBad Lite` |
| `/get-started/pricing` | `Pricing — SuperBad` |
| `/get-started/checkout` | `Checkout — SuperBad` |

**Note:** Admin pages say "SuperBad Lite" (internal). Public pages say "SuperBad" (per `feedback_no_lite_on_client_facing`).

---

## Demo landing page copy (generic frame)

The spec (§3.2) defines a generic demo frame that each product implements. This is the frame-level copy — product-specific demo implementations live in their own content files (e.g., `docs/content/content-engine/demo-landing-page.md`).

### Pre-demo (no result yet)

- **Page heading pattern:** `See what {productName} would do for your business.`
- **Subhead pattern:** `{productSpecificSubhead}` — each product defines its own.

### Convention-break callout (shared across all product demos)

> This is usually where we'd ask for your email before showing you anything. We'd rather just show you.

Same line on every product demo. Same styling: Playfair Display italic, Warm Cream on Dark Charcoal. The consistency IS the convention break — every product makes the same promise.

### Post-demo transition to tiers

- **Heading pattern:** `Now imagine this running while you sleep.`
- **Body pattern:** `{productSpecificAutomationPitch}. What you just saw was one {unit}. Imagine {tierLimit} a month.`
- **Tier cards flow directly below.** Same card component as pricing page.

### Result persistence note

- `Your demo result transfers to your account on signup. Not a throwaway.`

---

## Cockpit integration headlines

### New signup

- `New {productName} subscriber: {businessName} ({tierName}, {billingCadence})`

### Churn

- `{businessName} cancelled {productName} ({tierName}). {cancellationReason}`

### Payment failure

- `Payment failed for {businessName} on {productName}. {failureCount} failure{s} in {dayCount} days.`

### MRR change

- `MRR {direction}: ${delta}/mo ({reason}). Total MRR: ${totalMrr}/mo.`

### Subscriber hitting limits

- `{businessName} hit {dimensionLabel} cap on {productName} ({tierName}).`

### Aggregate health (daily brief)

- `SaaS: ${totalMrr}/mo MRR · {activeCount} active · {churnCount} churned this month`

---

## Account management labels

### Subscription overview

- **Section heading:** `Your plan`
- **Product line:** `{productName} — {tierName}`
- **Billing line:** `${amount}/mo · {billingCadenceLabel}`
- **Next payment:** `Next charge: {nextChargeDate}`
- **Commitment (if annual):** `Committed until {committedUntilDate}`

### Billing cadence labels

| Cadence | Label |
|---------|-------|
| `monthly` | `Month-to-month` |
| `annual_monthly` | `Annual, billed monthly` |
| `annual_upfront` | `Annual, paid upfront` |

### Payment methods

- **Section heading:** `Payment method`
- **Card display:** `{cardBrand} ending in {last4} · expires {expiry}`
- **Add card:** `Add a new card`
- **Remove card (last one, active subscriptions):** `Can't remove your only card while you have active subscriptions.`
- **Set default:** `Make default`

### Invoice history

- **Section heading:** `Invoices`
- **Row format:** `{date} · ${amount} · {status}` — status: `Paid` / `Failed` / `Pending`
- **Download:** `PDF` link per invoice
- **Empty state:** `No invoices yet. Your first one arrives after your first payment.`
