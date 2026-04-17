# Quote Builder — Cancel Flow Copy

> Canonical source for all cancel-flow page copy. These surfaces live at
> `/lite/portal/subscription` (owned by Client Portal spec, shape locked
> by Quote Builder spec §9). Phase 5 build session reads this file.
>
> Voice: client-facing = "SuperBad" (never "Lite"). Warm, direct, no
> guilt, no begging, no dark patterns. The cancel flow honours
> commitment by being honest, not by trapping.

---

## 1. Pre-term retainer cancel page

### Page header

**Heading:** Before you go.

**Subheading (Playfair italic):**
> Your retainer runs through {committed_until_date}. Here's what that means.

### Option cards (3, equal visual weight)

**Option 1 — Let's chat**

- **Card heading:** Let's talk about it.
- **Card body:** No charge. Andy gets in touch within 24 hours for a
  15-minute call. If you change your mind after, the other options are
  still here.
- **Button:** Start a conversation
- **Post-click message:**
  > Noted. Andy will reach out — usually within a day. If you want to
  > come back and pick a different option, this page stays open.

**Option 2 — Pay the remainder**

- **Card heading:** Pay the remainder and leave today.
- **Card body:** {months_remaining} months left at {monthly_amount}/month.
  Total: {remainder_amount} inc GST. Charged to your card on file.
  No further deliverables from today.
- **Button:** See the details

**Option 3 — 50% buyout**

- **Card heading:** Buyout at 50% and leave today.
- **Card body:** Half the remaining commitment: {buyout_amount} inc GST.
  Charged to your card on file. No further deliverables from today.
- **Button:** See the details

### Paid-exit confirmation step (shared by Options 2 and 3)

**Heading:** Confirm {exit_type}.

**Summary block:**
> Amount: {amount} inc GST
> Charged to: •••• {last4}
> Effective: today — no further deliverables after this.

**Confirm button (charcoal-on-cream, deliberately de-emphasised):**
> Confirm and pay {amount}

**Secondary link:**
> Go back

### Paid-exit success screen

**Heading:** Done.

**Body (Playfair italic):**
> It's been good working together.

**Detail block:**
- Payment ref: {payment_ref}
- Retainer ends: today
- Access to your portal continues for 30 days

**Footer soft CTA (earned per `feedback_earned_ctas_at_transition_moments`):**
> If things change down the line, the door's open. andy@superbadmedia.com.au

---

## 2. Pre-term SaaS cancel page

### Page header

**Heading:** Before you go.

**Subheading (Playfair italic):**
> Your {product_name} subscription runs through {committed_until_date}.

### Option cards (3, equal visual weight)

**Option 1 — Pay the remainder**

Same as retainer Option 2 above, scoped to SaaS product.

**Option 2 — Pause for a month**

- **Card heading:** Pause for a month.
- **Card body:** Your subscription pauses today and resumes on
  {resume_date}. Your commitment extends by one month to
  {new_committed_until_date}. Nothing's lost — everything picks up
  where you left off.
- **Button:** Pause subscription

*Disabled state (already used pause):*
- **Card body:** You've already used this commitment's pause.
- **Button:** (greyed out)
- **Tooltip:** One pause per commitment period.

**Option 3 — Continue**

- **Card heading:** Never mind.
- **Card body:** Close this page and carry on. Nothing changes.
- **Button:** Keep my subscription

### Pause confirmation screen

**Heading:** Paused.

**Body:**
> Your {product_name} subscription is paused until {resume_date}.
> Commitment now runs through {new_committed_until_date}.
>
> We'll send a heads-up 3 days before it resumes.

---

## 3. Post-term retention page (retainer + SaaS)

### Page header

**Heading:** You're month-to-month now.

**Subheading (Playfair italic):**
> Your original commitment ended {committed_until_date}. You can change
> or cancel anytime — no penalties, no buyouts.

### Cards (3, equal visual weight)

**Upgrade**

- **Card heading:** Step up.
- **Card body:** See what's available at a higher tier. Andy will walk
  you through the scope change.
- Renders: tier cards with `tier_rank > current_tier_rank`, each showing
  tier name + one-line description + starting price

**Downgrade**

- **Card heading:** Scale back.
- **Card body:** Keep the essentials, drop what you don't need. Andy will
  walk you through what stays and what goes.
- Renders: tier cards with `tier_rank < current_tier_rank`
- *No lower tier available:* "You're already on the smallest retainer."

**Cancel**

- **Card heading:** Cancel.
- **Card body:** Here's what you'd be losing:
  - {line_item_1 from accepted quote content_json}
  - {line_item_2}
  - {line_item_3}
  - …
- **Presentation rule:** bulleted list, pulled directly from
  `quotes.content_json` line items. Dry factual presentation. No
  emotional manipulation. No "are you sure?" language. Just the facts.

**Cancel confirmation step:**

**Heading:** Last step.

**Body:**
> This cancels your subscription at the end of the current billing
> period ({current_period_end}). You'll have access until then.

**Two buttons:**
- "Actually, I'll stay" (primary, brand-red) — closes, no action
- "Cancel my subscription" (secondary, charcoal-on-cream) — confirms

### Cancel success screen

**Heading:** Cancelled.

**Body (Playfair italic):**
> No hard feelings.

**Detail block:**
- Access until: {current_period_end}
- After that, your portal archives and your data stays safe

**Footer soft CTA:**
> If things change, you know where to find us. andy@superbadmedia.com.au

---

## 4. Pause-status page (for currently-paused subscriptions)

**Heading:** Your subscription is paused.

**Body:**
> Resumes automatically on {resume_date}. Commitment runs through
> {committed_until_date}.

**Two options:**
- "Resume early" — reactivates immediately, commitment date unchanged
- "Extend pause" — not available in v1. Copy: "One pause per commitment
  period. This one runs until {resume_date}."

---

## 5. Card-not-on-file edge case

When `customer.default_payment_method` is absent, paid-exit options
are disabled:

**Disabled card overlay:**
> Payment method needed. Update your card in the billing portal first.

**Link:** [Update payment method →] (Stripe Billing Portal)

**"Let's chat" remains available and becomes the effective fallback.**
