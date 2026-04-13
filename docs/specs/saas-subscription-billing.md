# SaaS Subscription Billing — Feature Spec

**Phase 3 output. Locked 2026-04-12. 29 questions resolved.**

SuperBad's second revenue arm: self-serve subscription products. This spec defines the generic billing infrastructure — products, tiers, pricing, signup, usage tracking, cancel flow, and subscriber management. Specific products (outreach/enrichment, Studio, ads wizard, etc.) plug in later via their own specs. The spec designs the shelf and the cash register, not what goes on the shelf.

The billing model is deliberately anti-conventional. Same per-month price for monthly and annual. Monthly pays a one-time setup fee. Annual waives it. The framing is identity and commitment, not discounts. Three commitment levels — getting started, committed, all in — with copy that talks about the kind of business that plans ahead, not the kind that hunts for deals.

---

## 1. Locked decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Product architecture | Generic multi-product infrastructure. Each product has its own popcorn tier set (small/medium/large). Products configured by Andy in admin, not hardcoded. |
| Q2 | Source of truth | Lite DB is source of truth. Andy manages everything in Lite's admin. Stripe Products/Prices auto-created via API on publish. |
| Q3 | Usage limits model | Feature flags + multiple named usage dimensions per product. Each tier sets caps per dimension. `recordUsage(customerId, dimensionKey)` tracking primitive. 1–3 dimensions per product practical guardrail. |
| Q4 | Commitment lengths | Monthly and annual only. Monthly is no-commitment. Annual gets the setup fee waived. |
| Q5 | Pricing model | Same per-month price for monthly and annual. Monthly includes one-time setup fee. Annual waives it. Identity and commitment framing, not discounts. |
| Q6 | Annual billing options | Annual offers both monthly-billed (12-month commitment) and upfront (lump sum). Three commitment cards: getting started / committed / all in. |
| Q7 | Setup fee recurrence | Charged on every new monthly subscription. Naturally closes the cancel-long-resubscribe-short loophole. |
| Q8 | Usage limit enforcement | Hard cap with one-click upgrade. Feature stops at limit, upgrade screen offers next tier pro-rated. No overages, no surprises. |
| Q9 | Usage counter reset | Billing cycle anniversary. Counter resets when they pay. Stripe `current_period_start`/`current_period_end` as reference. |
| Q10a | Tier change timing | Upgrades immediate with pro-ration. Downgrades take effect at end of current period. |
| Q10b | Product switching | Seamless product switch. Stripe subscription updated in place. Commitment carries over. No setup fee on switch. Usage resets on new product's dimensions. |
| Q11 | Public signup architecture | Two-layer: product-specific interactive demo landing pages (optional per product) + generic pricing comparison page. Both converge on the same checkout. Two entry paths: warm traffic (demo/pricing page → account → locked dashboard → payment) and cold outreach (pre-populated dashboard from enrichment data → payment). |
| Q12 | Demo gating | No email gate. Fully open. Page explicitly calls out the convention it's breaking. Demo shows discovery; pitch makes clear the product automates contact in the subscriber's brand voice. |
| Q13 | Checkout page | Minimal. Product name + tier. Commitment toggle. Clear total. Payment Element. One button. Support email at bottom. |
| Q14 | Commitment toggle shape | Three stacked radio cards with identity framing. No hidden options, no steering defaults. |
| Q15 | Cancel flow divergence | Inherit Quote Builder's locked shape. Add product-switch as soft first step before pre-term branches. AI chatbot (portal bartender) as contact option, not Andy's email. Max escalation only reaches Andy. |
| Q16 | Pause behaviour | As Quote Builder locked, plus cancel link visible in resume reminder email. Cancel page includes motivational reality check about entrepreneurship. Paid exit options: pay remainder (retain access until anniversary date) or 50% buyout (cancel now). |
| Q17 | Subscriber dashboard | Same chat-first portal layout as retainer. Bartender chat is home. Menu reflects product-specific items via `productConfig` interface contract. |
| Q18 | Product admin | Dedicated `/lite/products` with setup wizard for new product creation. Wizard: name → dimensions → tiers → pricing → feature flags → demo config → review → publish. Post-creation editing is direct. |
| Q19 | Product lifecycle | Archive only, no duplicate. Wizard is the only creation path. Archive stops new signups, existing subscribers continue. |
| Q20 | Admin analytics | Three zoom levels: cockpit headlines → `/lite/products` aggregate dashboard → per-product detail page. |
| Q21 | Usage tracking | Central `usage_records` table. `checkUsageLimit()` before action, `recordUsage()` after success. Products call both explicitly. Shared upgrade-prompt component. |
| Q22 | Usage on tier change | Usage carries over on upgrade. Downgrades reset naturally at end-of-period. |
| Q23 | Trial model | No traditional free trial. Account creation before payment. Locked dashboard (can see, can't act). Cold outreach prospects get pre-populated dashboard from enrichment data. Outreach email is meta-demonstration of the product. |
| Q24 | Onboarding sequence | Brand DNA hard gate after payment. Cold prospects get Brand DNA pre-seeded from enrichment data (shorter questionnaire). Warm traffic does full Brand DNA. Both converge on identical profile quality. |
| Q25 | Multi-subscription | Multiple independent subscriptions allowed. Each product has own tier, billing cycle, commitment. Full Suite priced so it's obviously better than 2+ individual products. No bundle discount — popcorn effect does the nudging. Checkout shows Full Suite comparison when adding a second product. |
| Q26 | Account management | Fully native inside the portal. Card updates, invoice history, payment methods — all branded. Stripe Billing Portal not exposed. |
| Q27 | Billing emails | 9 lifecycle email templates. No usage emails — usage communicated via persistent sticky bar in product UI. |
| Q28 | Payment failure | Immediate lockout on first failure. Data preserved. Update card to reactivate. 3 failures in 7–10 days triggers "you're about to lose your leads" escalation. Andy cockpit alert after escalation window. |
| Q29 | Voice & delight | Full voice treatment across 12 surfaces: demo landing, checkout cards, usage bar, cap screen, lockout screen, cancel flow, cancelled email, data-loss email, upgrade confirmation, first login, pricing page, portal menu. |

### 1.1 Setup wizard shell reference (added 2026-04-13 Phase 3.5)

The `/lite/products` product-creation flow described in Q18 renders through the `WizardDefinition` primitive owned by [setup-wizards.md](./setup-wizards.md) §5.2. Wizard key: **`saas-product-setup`**. Render mode: **slideover**. This spec owns the step content (name → dimensions → tiers → pricing → feature flags → demo config → review → publish) and the completion payload (Stripe Products/Prices created, `saas_products` row persisted, `activity_log` entry written). The shell (progress bar, resume, cancel, celebration step, Observatory integration) lives in the primitive — do not re-describe the shell in Phase 5 build sessions.

---

## 2. Architecture overview

### 2.1 Two revenue arms, one subscription primitive

Lite's two arms share the same underlying Stripe primitives:

- **Retainer arm** (Quote Builder): Andy builds a custom quote → client accepts → Stripe Subscription created → commitment enforced at Lite UX layer.
- **SaaS arm** (this spec): subscriber self-serves → picks product + tier + commitment → Stripe Subscription created → commitment enforced at the same Lite UX layer.

Both arms share: the `deals` table for subscription state, the cancel flow at `/lite/portal/subscription`, the `scheduled_tasks` worker for reminders and lifecycle events, the `sendEmail()` gate for all outbound email, and the `logActivity()` audit trail.

What differs: SaaS has product/tier/dimension metadata, usage tracking and enforcement, a public signup flow, an interactive demo surface, and identity-framed commitment pricing instead of per-client custom quotes.

### 2.2 Pricing philosophy

The popcorn theory operates at two levels:

1. **Within each product:** three tiers (small/medium/large) differentiated by usage limits. The gap between medium and large is deliberately small in price relative to the value increase.
2. **Across products:** Full Suite is priced so that subscribing to 2+ individual products is obviously more expensive than just getting everything. No explicit discount — the pricing makes it self-evident.

The commitment model is identity-based, not discount-based:
- Monthly: same rate + one-time setup fee. "Getting started."
- Annual (monthly-billed): same rate, no setup fee, 12-month commitment. "Committed."
- Annual (upfront): pay the full year in one hit, no setup fee. "All in."

The setup fee on every new monthly subscription naturally closes the cancel-long-resubscribe-short loophole. No anti-gaming logic needed.

### 2.3 Two entry paths

**Warm traffic** (ads, social, organic):
1. Interactive demo on product landing page (fully open, no email gate)
2. Or pricing comparison page
3. Account creation
4. Locked dashboard (can browse, can't act)
5. Payment gate on first functional action
6. Payment → Brand DNA (hard gate) → product unlocked

**Cold outreach** (Lead Gen system):
1. Lead Gen enriches prospect
2. Outreach email is a meta-demonstration ("this email is the product working on your business")
3. Click-through lands on pre-populated dashboard (enrichment data already there)
4. Locked dashboard (can see their data, can't act on it)
5. Payment gate
6. Payment → Brand DNA (pre-seeded from enrichment, shorter questionnaire) → product unlocked

Both paths converge on the same locked-dashboard state and the same checkout flow.

---

## 3. Public signup surfaces

### 3.1 Pricing page (`/get-started/pricing` or equivalent public route)

Comparison grid showing all active products. Each product is a column (or card on mobile). Tiers are rows within each product: small, medium, large. Each cell shows:

- Tier name (from admin)
- Monthly price (GST-inclusive, per `feedback_felt_experience_wins`)
- Usage limits per dimension ("50 searches / mo", "200 outreach sends / mo")
- Feature flag highlights
- "Get started" button

Below the grid, Full Suite is presented as a distinct section: "or get everything" with its own tier cards and the price comparison that makes the popcorn effect visible.

Voice treatment on all copy — product descriptions, tier names, comparison language. Content mini-session scope.

### 3.2 Interactive demo landing pages (per-product, optional)

Each product can define its own demo landing page. For search-based products (outreach/enrichment):

- Full search interface: vertical, business size, location, or business name
- One free enriched result, live, no gate, no signup required
- Result page explicitly calls out the convention break: *"this is usually where we'd ask for your email before showing you anything. we'd rather just show you."*
- Below the result: the automation pitch — *"we find them, write to them in your voice, and follow up while you sleep. Now imagine [tier limit] of these a month."*
- Tier cards below the pitch, flowing naturally into the checkout

The demo infrastructure defines the frame (search → result → pitch → tiers → checkout). Each product owns its demo implementation and result rendering.

Demo results transfer to the subscriber's account on signup — the search they ran becomes their first piece of dashboard data. Mechanism is product-specific.

### 3.3 Checkout page

Laser-focused. One job: close.

**Layout:**
- Product name + tier name at top (confirmation, not re-sell)
- Three stacked radio cards for commitment:
  - **Monthly** — "$X/mo + $Y one-time setup fee" + identity framing copy
  - **Annual (monthly-billed)** — "$X/mo, no setup fee. 12-month commitment." + identity framing copy
  - **Annual (upfront)** — "$X × 12 today. No setup fee." + identity framing copy + unique "all in" confirmation message on selection
- Clear total below the selected card
- Stripe Payment Element
- Single action button
- Small "issues? email andy@superbadmedia.com.au" at bottom
- If subscriber already has another product subscription: "or get everything with Full Suite for $X/mo" comparison line

**Suppression:** no voice treatment while Payment Element is visible and active. S&D suppression rules apply.

**Second product nudge:** when someone adds a second individual product subscription, the checkout shows the Full Suite price alongside. Not a modal, not a popup — a visible comparison line. The popcorn effect, not a hard sell.

---

## 4. Billing mechanics

### 4.1 Stripe object mapping

**On product publish:**
- 1 Stripe Product created per Lite product
- Per tier: 3 Stripe Prices created:
  - Monthly recurring (`interval: 'month'`)
  - Annual recurring billed monthly (`interval: 'month'` — commitment enforced at Lite layer, not Stripe)
  - Annual upfront (`interval: 'year'`)
- Stripe Product and Price IDs stored locally on `saas_products` and `saas_tiers`

**On price change:**
- Stripe Prices are immutable. Lite archives the old Price and creates a new one.
- Existing subscribers stay on their current Price until their next renewal or explicit tier change.

**On product archive:**
- Stripe Product marked inactive. No new subscriptions possible.
- Existing Stripe Subscriptions continue until cancelled.

### 4.2 Subscription creation

**Monthly:**
1. Stripe Customer created (or existing Customer reused if they have other subscriptions)
2. Stripe Subscription created with monthly Price
3. Setup fee added as `add_invoice_items` on the first invoice
4. First invoice charged immediately
5. Deal created at Won stage with `won_outcome = 'saas'`, `billing_cadence = 'monthly'`

**Annual (monthly-billed):**
1. Same Customer handling
2. Stripe Subscription created with monthly Price
3. No setup fee
4. First invoice charged immediately
5. `deals.committed_until_date` set to today + 12 months
6. Deal created with `billing_cadence = 'annual_monthly'`

**Annual (upfront):**
1. Same Customer handling
2. Stripe Subscription created with annual Price
3. No setup fee
4. Full year charged immediately
5. `deals.committed_until_date` set to today + 12 months
6. Deal created with `billing_cadence = 'annual_upfront'`

### 4.3 Commitment enforcement

Identical to Quote Builder's model: commitment is enforced at the Lite UX layer via the cancel flow, not at the Stripe layer. Stripe sees a plain rolling subscription. Lite tracks `committed_until_date` and routes the cancel flow through pre-term or post-term branches accordingly.

The setup fee charged on every new monthly subscription (Q7) naturally closes the cancel-long-resubscribe-short loophole. Someone who cancels annual and resubscribes monthly pays the setup fee again — a real cost with no special anti-gaming logic.

### 4.4 Upgrade / downgrade / product switch

**Tier upgrade (immediate):**
1. Stripe Subscription updated with new Price (`proration_behavior: 'create_prorations'`)
2. `deals.saas_tier_id` updated
3. Usage carries over (no reset)
4. Pro-rated charge on next invoice
5. `logActivity('saas_subscription_upgraded')`

**Tier downgrade (end of period):**
1. Stripe Subscription schedule: new Price takes effect at `current_period_end`
2. `deals.saas_tier_id` updated at period end (via webhook)
3. Usage resets naturally with new billing cycle
4. `logActivity('saas_subscription_downgraded')`

**Product switch (seamless):**
1. Stripe Subscription items updated: remove old Price, add new Price
2. `deals.saas_product_id` and `deals.saas_tier_id` updated
3. Commitment carries over — `committed_until_date` unchanged
4. No setup fee (they're already a subscriber)
5. Usage resets (different product, different dimensions)
6. `logActivity('saas_subscription_product_switched')`

### 4.5 Setup fee mechanics

- Charged as `add_invoice_items` on the first invoice of a monthly subscription
- One-time per subscription (not recurring)
- Andy sets the amount per tier in the admin
- Not charged on: annual subscriptions, product switches, or re-activation after payment failure
- IS charged on: new monthly subscriptions after a previous cancellation (Q7 — loophole closure)

### 4.6 Payment failure handling

1. `invoice.payment_failed` webhook fires → immediate lockout
2. Subscriber sees branded lockout screen with card update form (native, not Stripe Billing Portal)
3. Subscriber updates card → Stripe retries → if `invoice.paid` fires → unlock, log recovery
4. Track failure count: 3 failures within 7–10 days → escalation
5. Escalation: "you're about to lose your leads" email (content mini-session authors copy — urgent, honest, not guilt-trip) + `scheduled_tasks` job for the data-loss warning timing
6. After escalation window (10 days from first failure): cockpit alert for Andy to decide next steps
7. No auto-deletion of subscriber data without Andy's explicit action
8. No auto-cancellation — subscription stays in Stripe's dunning cycle alongside Lite's lockout

**Idempotency:** failure count tracked per billing cycle. A successful payment resets the counter. Webhook handler checks `invoice.id` against processed events table per FOUNDATIONS §8.

### 4.7 Multiple subscriptions per customer

- One Stripe Customer per contact (shared across all their subscriptions)
- One Stripe Subscription per product subscription
- One deal per product subscription (multiple deals per contact allowed)
- Each deal tracks its own: `subscription_state`, `committed_until_date`, `pause_used_this_commitment`, `billing_cadence`, `saas_product_id`, `saas_tier_id`
- Usage tracked per product per dimension per billing cycle
- Cancel flow operates per subscription (not per customer)
- If subscribing to Full Suite: existing individual subscriptions cancelled and replaced

---

## 5. Usage tracking and enforcement

### 5.1 Central primitive in `lib/billing/`

Two exported functions:

**`checkUsageLimit(contactId, productId, dimensionKey): { allowed: boolean, used: number, limit: number | null, tierName: string, nextTier: TierInfo | null }`**

Reads `usage_records` for the current billing period (derived from Stripe subscription's `current_period_start`). Compares against the tier's limit for this dimension. Returns the full state so the UI can render the sticky bar and the upgrade prompt.

**`recordUsage(contactId, productId, dimensionKey): void`**

Inserts a row into `usage_records` with the current billing period start. Called after a successful capped action. Products are responsible for calling this — no automatic middleware.

### 5.2 Sticky usage bar

Persistent bar in the product UI showing current consumption vs limit per dimension. Always visible — ambient awareness, not a notification.

Voice treatment evolves with usage:
- Low usage: calm, factual
- Mid usage: neutral
- Approaching cap (~80%): dry observation (e.g. "making sure the juice was worth the squeeze")
- At cap: dead-pan acknowledgment before the upgrade prompt

Copy authored in content mini-session. Rendered via `generateInVoice()` from S&D spec with `ambient_copy_cache` for performance.

### 5.3 Hard cap with upgrade prompt

When `checkUsageLimit()` returns `allowed: false`:

1. Capped action blocked — feature button disabled or action returns gracefully
2. Upgrade prompt component renders inline:
   - Current tier and usage ("50 of 50 searches used this month")
   - Next tier card with its limits and price difference (pro-rated for remainder of cycle)
   - One-click upgrade button → triggers immediate tier upgrade (§4.4)
   - Voice treatment on the prompt — dry, not corporate
3. If already on the highest tier: prompt shows "you've maxed out [product name]" — no upgrade available. Contact support link.

### 5.4 Usage on billing cycle reset

Usage counted by `billing_period_start` on `usage_records`. New billing cycle = new period start = counter effectively resets (old records still exist for analytics, new queries filter by current period).

No cleanup job needed. Old records are useful for usage analytics on the admin dashboard.

---

## 6. Cancel flow (SaaS-specific)

Lives at `/lite/portal/subscription` (shared route with retainer, branching by subscription type). Inherits Quote Builder's structural locks (§9) with SaaS-specific modifications.

### 6.1 Motivational reality check

Before any options, the cancel page displays a motivational message about entrepreneurship. Not begging, not guilting, not offering discounts. Honest acknowledgment that building a business is hard and the frustration is the job. Content mini-session authors the exact copy with `superbad-brand-voice` loaded.

### 6.2 Product switch (soft first step)

"Before you go — would a different product suit you better?"

Shows other active products the subscriber isn't on. One-click switch (seamless, per §4.4). If they switch, cancel flow exits. If they dismiss, proceed to cancel branches.

### 6.3 AI chatbot contact

The portal bartender (from Client Management spec) is the contact option. Not Andy's email. Subscribers can ask questions, express frustration, request help — the chatbot handles it with the bartender register. Maximum escalation (chatbot determines it can't resolve) reaches Andy via comms inbox.

"Talk to us" button opens the portal chat, not an email compose.

### 6.4 Gate: which branch?

```
if subscription is paused:
  render pause-status page (resume early / extend pause / cancel link visible in reminder email)

elif today < committed_until_date:
  → pre-term branch

else:
  → post-term branch
```

### 6.5 Pre-term SaaS branch (4 options + continue)

**Option 1 — Pay the remainder, keep access:**
- Click → confirmation screen with calculated amount and access-end date (the commitment anniversary)
- *"You'll be charged $X,XXX inc. GST today. You keep full access until {committed_until_date}. No further charges after that."*
- Charcoal-on-cream confirmation button (de-emphasised per Quote Builder pattern)
- On confirm: off-session Payment Intent for remainder. Subscription set to cancel at `committed_until_date` (not immediately). `deals.subscription_state = 'cancelled_paid_remainder'`
- Remainder calculation: `monthly_amount_cents * months_remaining_rounded_up` where `months_remaining = ceil((committed_until_date - today) / 30)`
- Idempotency key: `saas_exit:{deal_id}:paid_remainder:{today_iso}`

**Option 2 — 50% buyout, cancel now:**
- Same confirmation screen pattern with `buyout_cents = floor(remainder_cents / 2)` (client-favourable rounding)
- Access ends immediately on payment success
- `deals.subscription_state = 'cancelled_buyout'`
- Idempotency key: `saas_exit:{deal_id}:buyout:{today_iso}`

**Option 3 — 1-month pause:**
- As locked in Quote Builder §9.3. One pause per commitment period. Extends `committed_until_date` by 30 days. Anti-stack rule: disabled if `pause_used_this_commitment = true`.
- Resume reminder email includes visible cancel link (Q16 amendment)

**Option 4 — Continue:**
- Page closes, no action.

### 6.6 Post-term branch

Identical to Quote Builder §9.4 (shared with retainer):

**Upgrade:** shows higher-ranked tiers. Click logs intent, routes to upgrade flow.

**Downgrade:** shows lower-ranked tiers. Click logs intent, routes to downgrade flow. Edge case: already on smallest tier → *"you're already on the smallest plan."*

**Cancel:** "here's what you'd be losing" list — bulleted usage limits and features from their current tier. Two buttons: *"actually, I'll stay"* + *"cancel anyway"*. Cancel confirmation → Stripe subscription cancelled → `deals.subscription_state = 'cancelled_post_term'`.

### 6.7 Card-not-on-file edge

If `customer.default_payment_method` is absent, paid-exit options disabled. "Talk to us" (AI chatbot) becomes the effective fallback.

---

## 7. Subscriber portal experience

### 7.1 Dashboard layout

Same chat-first portal as retainer clients (Client Management spec). Bartender chat is home. Menu bubble expands to full-page overlay menu with product-specific items.

**Standard portal menu items** (shared with retainer):
- Chat (home)
- Brand DNA
- Invoices
- Messages
- Download My Data

**Product-specific menu items** (defined by each product via `productConfig.menuItems`):
- The product's own interface (e.g. "Outreach Dashboard", "Studio", "Campaigns")
- Product-specific settings or preferences

For subscribers with multiple products: all product menu items visible. Each product's interface is a separate section.

### 7.2 Account management (native)

Accessible via menu: "Account" or "Billing."

**Subscription overview:**
- Current product(s) and tier(s)
- Billing cadence and next payment date
- Commitment status and end date (if annual)
- Usage summary per dimension (mirroring the sticky bar)

**Payment methods:**
- Display: card brand, last 4 digits, expiry
- Add new: Stripe SetupIntent + inline Payment Element
- Remove: with confirmation (cannot remove last payment method if active subscriptions exist)
- Set default: one-click

**Invoice history:**
- List of past invoices with date, amount, status
- Each invoice expandable to show line items
- Download PDF (Stripe-generated)

**Plan management:**
- Change tier → upgrade/downgrade flow (§4.4)
- Switch product → product switch flow (§4.4)
- Cancel → cancel flow (§6)

### 7.3 Usage sticky bar

Persistent across all product pages. Shows each active dimension:

`[dimension icon] 42 / 50 searches this month`

Multiple dimensions stack vertically (or horizontally on wide screens). Voice treatment on the label evolves with usage level (§5.2).

### 7.4 Payment failure lockout

When a subscription is in payment-failed state:

- Product interface replaced with a branded lockout screen
- Card update form (native Payment Element for new SetupIntent)
- Clear explanation: what happened, what to do, that their data is safe
- Voice treatment — honest, with character, not sterile corporate error copy
- After card update + successful retry: instant unlock, product accessible

---

## 8. Product admin (`/lite/products`)

### 8.1 Index page

**Summary cards at top:**
- Total active subscribers
- Total MRR (across all products)
- New subscribers this month
- Churn this month

**Product list below:**
- Card per product showing: name, status badge (draft/active/archived), subscriber count, product MRR, tier breakdown bar chart
- Click to open product detail
- "New product" button → launches wizard

### 8.2 New product wizard

Step-by-step creation per `feedback_setup_is_hand_held`:

1. **Name & description** — product name, short description, URL slug
2. **Usage dimensions** — add 1–3 named dimensions (key + display name). Explain what a dimension is in plain English.
3. **Tiers** — create 3 tiers (small/medium/large naming is Andy's choice). Per tier: name, usage limits per dimension, feature flags (toggle list)
4. **Pricing** — per tier: monthly price (GST-inclusive) + setup fee. Annual prices derive automatically (same rate, no setup fee). Clear preview of all price points.
5. **Demo config** (optional) — enable interactive demo landing page, configure which search fields are exposed
6. **Review** — full summary of everything before publish. Edit any section.
7. **Publish** — creates Stripe Product + Prices, sets status to active

Wizard state persists (can be abandoned and resumed). Draft products visible in admin but not on public pages.

### 8.3 Product detail page

**Tabs:**

**Overview:** subscriber count, MRR, tier distribution, recent signups, churn events. Usage distribution chart (how many subscribers are near their limits per dimension).

**Tiers & pricing:** edit tiers, adjust prices (creates new Stripe Prices), modify feature flags. Changes to existing tiers affect new subscribers only — existing subscribers stay on their current Price until renewal or explicit change.

**Usage dimensions:** view and edit dimension display names. Adding new dimensions or removing existing ones is a gated action (affects all tiers, requires reviewing all tier limits).

**Demo:** toggle demo on/off, configure demo fields, preview demo page.

**Subscribers:** list of active subscribers for this product with tier, billing cadence, usage this period, subscription age, health status. Click through to contact profile.

### 8.4 Product archive

One-click from product detail. Confirmation dialog. Effects:
- Product removed from public pricing page and demo
- No new subscriptions possible
- Existing subscribers continue unchanged
- Product card on admin index shows "archived" badge
- Reversible: can un-archive to re-publish

---

## 9. Stripe webhook handlers

All handlers use `webhook_events` table idempotency per FOUNDATIONS §8. All email sends route through `sendEmail()` per §11.2.

| Event | Handler |
|-------|---------|
| `invoice.paid` | Log payment. If subscriber was locked out: unlock, reset failure counter, log recovery. Update `deals` billing state. |
| `invoice.payment_failed` | Increment failure counter. If first failure: lock out subscriber, send payment-failed email. If 3rd failure within 7–10 days: send data-loss warning email, schedule cockpit alert. |
| `customer.subscription.updated` | Handle tier changes, product switches, pause/resume state changes. Update `deals` accordingly. |
| `customer.subscription.deleted` | Confirm cancellation. Update `deals.subscription_state`. Send cancelled confirmation email. |

**Handlers inherited from Quote Builder's `scheduled_tasks` worker:**
- `subscription_pause_resume_reminder` — fires 3 days before pause ends. Email includes resume date AND visible cancel link.
- `subscription_pause_resume` — fires on resume date. Clears pause state.

**New scheduled task types:**
- `saas_data_loss_warning` — fires 7 days after first payment failure if not resolved. Sends escalation email.
- `saas_annual_renewal_reminder` — fires 7 days before annual renewal date. Email reminds subscriber of upcoming charge.
- `saas_card_expiry_warning` — fires 30 days before card expiry. Email prompts card update.

---

## 10. Voice & delight treatment

### 10.1 Voice-treated surfaces (12 total)

Every surface below gets Claude-generated copy drift-checked against SuperBad's Brand DNA via `generateInVoice()` from the S&D spec, cached via `ambient_copy_cache`.

1. **Demo landing page** — convention callout, result reveal, automation pitch
2. **Pricing page** — product descriptions, tier card copy, comparison language
3. **Checkout commitment cards** — identity framing on all three. "All in" gets unique post-payment message.
4. **Usage sticky bar** — evolving personality: calm → neutral → dry → dead-pan
5. **Usage cap hit screen** — dry acknowledgment, not corporate limit-reached copy
6. **Payment failed lockout** — honest, character, clear
7. **Cancel flow motivational reality check** — entrepreneurship is hard, the frustration is the job
8. **Cancelled email** — dying-fall grace, door left open
9. **Data-loss warning email** — urgent but still has character
10. **Upgrade confirmation** — the moment lands
11. **First login after subscribing** — bartender acknowledges commitment
12. **Portal product menu items** — labels carry voice

### 10.2 Sprinkle bank claims

- **"Subscription cancelled" email** (bank §3) — claimed for the dying-fall grace moment
- **Browser tab titles for `/lite/products`** (bank §2) — admin surface, dynamic: "SuperBad Lite — 47 subscribers" vs "SuperBad Lite — no products yet"

### 10.3 Suppression

S&D suppression rules apply fully:
- No voice during active Payment Element flows
- No voice during wizard steps
- No voice on error states requiring clarity
- No voice during first portal session (first-visit tour takes precedence)

---

## 11. Data model

### 11.1 New tables

**`saas_products`**
```
id                    text PK (nanoid)
name                  text not null
description           text
slug                  text unique not null
status                text not null: 'draft' | 'active' | 'archived'
demo_enabled          boolean default false
demo_config           text nullable (JSON)
menu_config           text nullable (JSON — portal menu items)
product_config_schema text nullable (JSON — onboarding interface contract)
stripe_product_id     text nullable
display_order         integer default 0
created_at            integer not null (timestamp_ms UTC)
updated_at            integer not null (timestamp_ms UTC)
```

**`saas_tiers`**
```
id                          text PK (nanoid)
product_id                  text not null FK → saas_products
name                        text not null
tier_rank                   integer not null (1 = small, 2 = medium, 3 = large)
monthly_price_cents_inc_gst integer not null
setup_fee_cents_inc_gst     integer not null default 0
feature_flags               text nullable (JSON — { "priority_support": true, ... })
stripe_monthly_price_id     text nullable
stripe_annual_price_id      text nullable
stripe_upfront_price_id     text nullable
created_at                  integer not null
updated_at                  integer not null
```

**`saas_usage_dimensions`**
```
id            text PK (nanoid)
product_id    text not null FK → saas_products
dimension_key text not null
display_name  text not null
display_order integer default 0
created_at    integer not null
UNIQUE(product_id, dimension_key)
```

**`saas_tier_limits`**
```
id           text PK (nanoid)
tier_id      text not null FK → saas_tiers
dimension_id text not null FK → saas_usage_dimensions
limit_value  integer nullable (null = unlimited)
UNIQUE(tier_id, dimension_id)
```

**`usage_records`**
```
id                   text PK (nanoid)
contact_id           text not null FK → contacts
company_id           text not null FK → companies
product_id           text not null FK → saas_products
dimension_key        text not null
billing_period_start integer not null (timestamp_ms UTC)
recorded_at          integer not null (timestamp_ms UTC)
INDEX(contact_id, product_id, dimension_key, billing_period_start)
```

### 11.2 Column additions to existing tables

**`deals`** (additions — all nullable, null for non-SaaS deals):
```
saas_product_id   text nullable FK → saas_products
saas_tier_id      text nullable FK → saas_tiers
billing_cadence   text nullable: 'monthly' | 'annual_monthly' | 'annual_upfront'
```

Note: `committed_until_date`, `subscription_state`, `pause_used_this_commitment`, `stripe_subscription_id`, `stripe_customer_id` already defined by Quote Builder. Shared across retainer and SaaS.

**`deals.won_outcome` enum** gains no new values — `'saas'` already exists from Pipeline spec.

### 11.3 `activity_log.kind` additions

11 new values:

- `saas_product_created`
- `saas_product_published`
- `saas_product_archived`
- `saas_subscription_created`
- `saas_subscription_upgraded`
- `saas_subscription_downgraded`
- `saas_subscription_product_switched`
- `saas_payment_failed_lockout`
- `saas_payment_recovered`
- `saas_data_loss_warning_sent`
- `saas_usage_limit_reached`

Existing values from Quote Builder that apply to both retainer and SaaS (no duplication needed): `subscription_paused`, `subscription_pause_ended`, `subscription_cancelled_post_term`, `subscription_early_cancel_paid_remainder`, `subscription_early_cancel_buyout_50pct`, `subscription_cancel_intercepted_preterm`.

### 11.4 `scheduled_tasks.task_type` additions

3 new values:
- `saas_data_loss_warning`
- `saas_annual_renewal_reminder`
- `saas_card_expiry_warning`

Idempotency keys:
| Task type | Key pattern |
|-----------|-------------|
| `saas_data_loss_warning` | `data_loss:{deal_id}:{failure_date_iso}` |
| `saas_annual_renewal_reminder` | `annual_reminder:{deal_id}:{renewal_date_iso}` |
| `saas_card_expiry_warning` | `card_expiry:{contact_id}:{expiry_month}` |

---

## 12. Integrations

### 12.1 Stripe

- **Products API** — create/update/archive Products on publish
- **Prices API** — create Prices per tier per commitment length. Archive old Prices on price change.
- **Subscriptions API** — create, update (tier change, product switch, pause), cancel
- **SetupIntents API** — native card capture for account management
- **PaymentIntents API** — off-session charges for cancel-flow paid exits (remainder / buyout)
- **Webhooks** — `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Billing Portal** — cancel disabled, not exposed to subscribers (Q26 — fully native account management)

### 12.2 Resend (via `sendEmail()` gate)

9 email templates, all routed through §11.2 gate:

1. Payment confirmation (per billing cycle)
2. Payment failed (with card update link)
3. Card expiring soon (30 days before)
4. Annual renewal reminder (7 days before)
5. Subscription cancelled confirmation (dying-fall voice)
6. Pause confirmation
7. Upgrade/downgrade confirmation
8. Product switch confirmation
9. Data-loss warning (3x failure escalation)

All templates: transactional classification (§11.2), bypass quiet window (§11.4), drift-checked against SuperBad's Brand DNA (§11.5).

### 12.3 Lead Gen integration

- Outreach email for SaaS prospects includes meta-demonstration copy
- Enrichment data from Lead Gen populates pre-signup dashboard
- SaaS prospects enter Lite with pre-existing contact + company records from Lead Gen
- Demo results from warm traffic persist to subscriber account on signup (product-specific mechanism)

### 12.4 Brand DNA integration

- Hard gate after payment, before product access
- Pre-seeding from enrichment data for cold outreach prospects (cross-spec flag — Brand DNA spec must define the pre-seed mechanism)
- Full Brand DNA for warm traffic
- Both paths produce identical profile quality

---

## 13. Cross-spec flags

### 13.1 Sales Pipeline (LOCKED)
- `deals` gains 3 nullable columns: `saas_product_id`, `saas_tier_id`, `billing_cadence`
- Multiple deals per contact allowed (one per product subscription)
- Cold SaaS signups create deals at Won stage directly (no pipeline progression)
- `activity_log.kind` gains 11 values (§11.3)

### 13.2 Lead Generation (LOCKED)
- Outreach email template for SaaS prospects includes meta-demonstration framing
- Enrichment data must be accessible to pre-populate subscriber dashboards
- SaaS outreach track may need product-specific qualifying signals

### 13.3 Intro Funnel (LOCKED)
- Retainer-fit recommendation of `'saas'` routes prospect to SaaS signup flow
- Deal transitions from Trial Shoot → Won with `won_outcome = 'saas'`

### 13.4 Onboarding + Segmentation (LOCKED)
- SaaS onboarding trigger: Stripe payment success on SaaS product
- Brand DNA pre-seeding for cold outreach prospects (new mechanism)
- Revenue Segmentation after Brand DNA for SaaS customers
- Each product's `productConfig` interface contract defines menu items and first-run view

### 13.5 Brand DNA Assessment (LOCKED)
- Must define pre-seeding mechanism: mapping enrichment data → Brand DNA answer pre-fills
- Pre-seeded assessments must be clearly marked so the subscriber knows which answers were inferred vs. direct
- Shorter questionnaire when pre-seeded — skip questions already answered with high confidence

### 13.6 Client Management (LOCKED)
- Portal menu includes product-specific items from `productConfig.menuItems`
- Portal bartender handles SaaS cancel flow AI chat contact
- Account management pages (native card update, invoice history, payment methods) are new portal sections
- Cancel flow pages at `/lite/portal/subscription` gain SaaS-specific branches

### 13.7 Client Context Engine (LOCKED)
- Subscriber usage patterns (limit hits, upgrades, downgrades) as signals
- Payment failures as health-affecting events

### 13.8 Daily Cockpit (#12)
- SaaS headline signals: new signup, churn, payment failure, MRR change, subscriber hitting limits
- Aggregate SaaS health: total MRR, active subscribers, churn rate
- Payment failure escalations surface as cockpit alerts

### 13.9 Finance Dashboard (#17)
- Reads SaaS revenue data: MRR by product, subscriber counts, churn, ARPU
- Setup fee revenue tracked separately from recurring revenue

### 13.10 Surprise & Delight (LOCKED)
- Suppression during Payment Element flows
- Voice treatment on all 12 surfaces (§10.1) uses `generateInVoice()` + `ambient_copy_cache`
- Cancel flow motivational message is a new ambient surface category (check if promotion gate needed or if it falls under existing "error pages" / "empty states" umbrella — likely needs a gate since it's a new surface type)

### 13.11 Quote Builder (LOCKED)
- Shared cancel flow infrastructure at `/lite/portal/subscription`
- SaaS branches inherit retainer patterns but diverge on: AI chatbot contact (not Andy's email), pay-remainder retains access, motivational reality check
- `scheduled_tasks` worker gains 3 new task types
- Setup fee as loophole closure replaces any complex anti-gaming logic

### 13.12 Foundations
- §11.2: all 9 email templates route through `sendEmail()` gate with `classification: 'transactional'`
- §11.3: all timestamps (billing dates, renewal dates, usage periods) rendered via `formatTimestamp()`
- §11.5: all voice-treated surfaces drift-checked against SuperBad's Brand DNA

---

## 14. Content mini-session scope

**Largest SaaS content session in the project.** Dedicated creative session with `superbad-brand-voice` + `superbad-visual-identity` + `superbad-business-context` skills loaded.

**Produces:**

1. **Pricing page:** generic tier naming convention guidance, comparison grid copy structure, Full Suite positioning copy
2. **Demo landing page:** convention-break callout, result reveal framing, automation pitch ("we find them, write to them in your voice, follow up while you sleep"), transition to tier cards
3. **Checkout commitment cards:** identity framing for all three (monthly = getting started, annual = committed, upfront = all in). Unique "all in" post-payment message.
4. **Usage sticky bar:** personality copy progression across 4 usage levels (low / mid / near-cap / at-cap). Per-dimension variants if needed.
5. **Usage cap hit screen:** dry acknowledgment + upgrade prompt framing
6. **Payment failed lockout screen:** honest, character-full lockout message
7. **Cancel flow motivational reality check:** entrepreneurship reality message (the defining brand moment of the cancel page)
8. **9 email templates:** payment confirmation, payment failed, card expiring, renewal reminder, cancelled (dying-fall), pause confirmation, upgrade/downgrade confirmation, product switch confirmation, data-loss warning (urgent with character)
9. **Upgrade confirmation:** moment-landing copy
10. **First-login bartender line:** acknowledges they just committed
11. **Product admin empty states:** no products yet, no subscribers yet, first product encouragement
12. **Browser tab title treatments** for `/lite/products`

---

## 15. Build-time disciplines

Additions to the project-wide discipline list:

38. **Every capped action calls `checkUsageLimit()` before execution and `recordUsage()` after success.** No product bypasses the central usage primitive. A missed check found in Phase 5 spawns an immediate fix task.
39. **Stripe Price changes always create new Price objects.** Never modify an existing Stripe Price. Archive old, create new. Existing subscribers unaffected until renewal or explicit change.
40. **No Stripe Billing Portal exposure to subscribers.** All account management is native. Cancel routing goes through Lite's cancel flow exclusively.
41. **Setup fee logic lives in one place.** The `createSubscription()` function in `lib/billing/` handles setup fee addition for monthly subscriptions. No ad-hoc `add_invoice_items` elsewhere.
42. **Product demo implementations are product-specific.** The billing infrastructure defines the frame (search → result → pitch → checkout). Each product owns its demo logic. No generic demo that tries to fit all products.

---

## 16. Open questions for later phases

1. **Product-specific demo implementations.** Each product spec defines how its demo works. This spec only defines the frame.
2. **Pre-seeding mechanism for Brand DNA.** Flagged as cross-spec for Brand DNA spec. How enrichment data maps to Brand DNA answers needs its own design.
3. **Full Suite product definition.** Is it literally "all products" or a curated bundle? Defined when specific products are brainstormed.
4. **SaaS outreach email copy.** The meta-demonstration framing for outreach emails targeting SaaS prospects. Content session for Lead Gen or a dedicated SaaS outreach content session.

---

## 17. Risks

1. **Multiple subscriptions per customer adds Stripe complexity.** Managing multiple Subscription objects per Customer, multiple payment failure states, multiple cancel flows. Mitigated by: each subscription maps to one deal, each deal tracks its own state independently. The shared infrastructure (webhook handlers, cancel flow routing) handles multiplexing.

2. **Pre-populated dashboard coupling to Lead Gen.** Cold outreach pre-population requires Lead Gen enrichment data to be accessible to product dashboards. Mitigated by: enrichment data already stored on contact/company records. Products read from there, not from Lead Gen internals.

3. **Native account management maintenance.** Building card update, invoice history, and payment method management natively means ongoing maintenance when Stripe adds new payment methods or changes APIs. Mitigated by: Stripe's API is stable and well-documented. The UI surface is small (one page). Update cadence is low.

4. **Voice treatment across 12 surfaces is a lot of content.** The content mini-session for this spec is substantial. Mitigated by: most surfaces are short (one-liners, sticky bar variants, email subject+first-line). The cancel flow motivational message is the only long-form piece.

5. **Demo landing page conversion assumption.** The no-gate, no-trial model assumes the demo is compelling enough to convert. If it isn't, there's no fallback lead capture. Mitigated by: cold outreach path captures leads independently. Warm traffic that doesn't convert is genuinely low-intent — gating them wouldn't have converted them either.

---

## 18. Reality check

### Hardest parts
1. **The interactive demo landing pages.** Product-specific, require real API calls to enrichment services, need to feel polished on first impression. Each product's demo is essentially a mini-app. Mitigated by: this spec defines the frame, product specs own the implementation, and only search-based products need complex demos.
2. **Native account management.** Stripe SetupIntent flow for card capture, 3D Secure handling, payment method lifecycle. Well-documented but fiddly. Mitigated by: Stripe's React components handle most of the complexity.
3. **Usage tracking at scale.** If a product has thousands of subscribers each recording dozens of actions per day, the `usage_records` table grows fast. Mitigated by: SQLite with WAL mode handles this volume comfortably. Index on `(contact_id, product_id, dimension_key, billing_period_start)` keeps queries fast.

### What could go wrong
- Stripe webhook ordering causes race conditions between `invoice.paid` and `customer.subscription.updated` — mitigated by idempotency keys and processing-order tolerance in handlers.
- Setup fee creates friction that suppresses monthly signups — mitigated by: the demo removes the "will this work?" uncertainty, and the fee is positioned as a fair cost, not a penalty.
- The no-trial model underperforms vs industry-standard free trials — mitigated by: the demo + locked dashboard IS the trial, just structured differently. If conversion data shows a problem, a time-limited trial can be added later without rewriting anything.

### Is this actually doable
**Yes.** The billing mechanics are standard Stripe patterns. The novel parts are the demo landing pages (product-specific, built per product) and the voice treatment (content, not code). The data model is clean — 5 new tables, 3 new columns on an existing table, well-scoped. The cancel flow inherits 80% of its logic from Quote Builder. Phase 5 build is estimated at 4–5 sessions.

---

## 19. Phase 5 sizing

5 sessions:

- **Session A: Data model + Stripe integration.** Tables, Stripe Product/Price creation on publish, subscription creation flow (all 3 billing cadences), setup fee mechanics, webhook handlers, `lib/billing/` usage primitives. **Large.** No dependencies beyond FOUNDATIONS infrastructure session.

- **Session B: Product admin.** `/lite/products` index, dashboard, new-product wizard, product detail page (all tabs), archive/un-archive, Stripe sync on publish. **Medium-large.** Depends on Session A.

- **Session C: Public signup.** Pricing page, checkout page (commitment cards + Payment Element), demo landing page frame (product-specific demos built in product sessions). **Medium.** Depends on Session A (needs Stripe Prices to exist).

- **Session D: Subscriber experience.** Usage sticky bar, hard cap + upgrade prompt, tier upgrade/downgrade flow, product switch, account management (card update, invoices, payment methods), portal menu integration. **Large.** Depends on Sessions A + C.

- **Session E: Cancel flow + payment failure.** SaaS cancel branches at `/lite/portal/subscription`, motivational reality check, AI chatbot contact integration, pause amendments, payment failure lockout + recovery + data-loss warning escalation. **Medium.** Depends on Session D.

A before B. A before C. B and C can run in parallel. D after A + C. E after D.
