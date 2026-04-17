# Quote Builder — Email Templates

> Canonical source for all Quote Builder email voice treatment. All emails
> are Claude-drafted per-quote and drift-checked. This file provides:
> prompt calibration notes, hard rules, and example outputs showing target
> voice. Phase 5 build sessions use these to calibrate the prompt files.
>
> Voice: dry, observational, self-deprecating, slow burn. First-person
> from Andy. Never explain the joke. Ban "synergy", "leverage",
> "solutions". Short sentences.

---

## Conventions (all QB emails)

**Sign-off:** "Andy" — first name only. No title, no company, no logo.
Rendered in Playfair italic on the client side.

**Footer:** Minimal. Company line: "SuperBad Marketing · Melbourne"
+ unsubscribe link on outreach-classified emails only (transactional
emails don't need one but include a mute-notifications link).

**Button copy on link CTAs:**
- Quote delivery: "Read your quote →"
- Reminder: "Take another look →"
- Settle (Stripe): "View your confirmation →"
- Settle (manual): "View your confirmation →"
- Expiry: (no button — reply-to-email CTA only)
- Supersede: "Read the updated quote →"
- Withdrawal: (no button — contact CTA only)

**Threading:** all emails on the same deal thread via `In-Reply-To` /
`References` headers. The client sees one conversation, not scattered
messages.

---

## 1. Send email (quote delivery) — `draft-send-email`

**Classification:** transactional (response-to-action: Andy clicked Send)

**Prompt calibration notes:**
- Subject ≤ 60 chars. Specific to the deal. Never generic ("Your quote").
- Body 2–4 short paragraphs. No URL in body (rendered as button).
- Address by first name. No "Hi there" / "To whom".
- Reference one specific thing from the deal context (proves human
  attention — a detail from the discovery call, a pain point, a goal).
- No filler. No "I hope this email finds you well."
- End before it gets comfortable. Leave them wanting to click.

**Subject examples:**
- "Your quote for Q3 creative production"
- "The retainer scope we discussed"
- "Quote for {Company} — shoots + social + ads"
- "{First_name}, here's the plan"

**Example output:**

> Hey Sarah,
>
> This covers the three things we talked about on Friday — the monthly
> shoot days, the social content pipeline, and getting your Meta Ads off
> that agency's autopilot.
>
> Everything's in sections so you can read it at your own pace. The terms
> are plain English. The price is what it is.
>
> Take your time with it.
>
> Andy

---

## 2. 3-day reminder — `quote_reminder_3d` handler

**Classification:** transactional

**Prompt calibration notes:**
- Only fires if quote is still in `sent` status (not `viewed`).
- Shorter than the send email. 1–2 paragraphs max.
- Not pushy. Not "just following up." Not "checking in."
- Tone: casual observation. "It's still there."
- Mention days remaining before expiry only if ≤ 7 days.

**Subject examples:**
- "Still sitting there, that quote"
- "The quote from {sent_day_name} is still open"
- "Quick flag — your quote"

**Example output:**

> Hey Sarah,
>
> Just flagging — the quote I sent {sent_day_name} is still open if you
> want to take another look.
>
> No rush. It doesn't expire for another {days_remaining} days.
>
> Andy

---

## 3. Settle email — Stripe-billed — `draft-settle-email`

**Classification:** transactional

**Prompt calibration notes:**
- Payment received. Warm, brief, forward-looking.
- Reference the receipt, the first-deliverable date.
- No effusiveness. No "we're so excited to work with you."
- Tone: settled. Confident. The work starts.

**Subject examples:**
- "Payment received — we're locked in"
- "Confirmed. Let's get started."
- "You're on. First deliverable lands {date}."

**Example output:**

> Hey Sarah,
>
> Payment's through. We're officially on.
>
> Your receipt is on the confirmation page if you need it for your
> records. First deliverable lands {first_deliverable_date}.
>
> I'll be in touch before then.
>
> Andy

---

## 4. Settle email — manual-billed — `draft-settle-email`

**Classification:** transactional

**Prompt calibration notes:**
- Same as Stripe-billed but references invoice date instead of payment.
- "Accepted" not "paid" — money moves later.

**Subject examples:**
- "Accepted — first invoice lands {date}"
- "Locked in. Invoice coming {date}."

**Example output:**

> Hey Sarah,
>
> Locked in. Your first invoice will come through on
> {first_invoice_date} — you can view and pay it from your portal
> anytime.
>
> First deliverable lands {first_deliverable_date}. I'll reach out
> before then.
>
> Andy

---

## 5. Expiry email — `handleQuoteExpire` handler

**Classification:** transactional

**Prompt calibration notes:**
- Quote expired. Not scolding. Door open.
- No "we noticed you didn't respond." No guilt.
- Offer to put a fresh one together if they reply. No form, no link.
- Reply-to-email is the CTA — no button.

**Subject examples:**
- "That quote expired — no stress"
- "Quote expired. Door's open."
- "The quote from {sent_date} hit its limit"

**Example output:**

> Hey Sarah,
>
> The quote I sent on {sent_date} hit its expiry date today. These
> things happen — timing's everything.
>
> If the conversation's still alive on your end, just reply to this
> and I'll put a fresh one together. No forms, no starting over.
>
> Andy

---

## 6. Supersede email — edit-after-send

**Classification:** transactional

**Prompt calibration notes:**
- New version replaces old. Clear, not apologetic.
- One-line summary of what changed (Claude generates from content diff).
- Old link redirects to new — mention this.

**Subject examples:**
- "Updated quote — replaces the one from {original_date}"
- "Revised quote for {Company}"

**Example output:**

> Hey Sarah,
>
> Updated version of the quote from {original_sent_date}. Adjusted the
> scope on the social content to match what we landed on yesterday.
>
> The old link redirects here automatically.
>
> Andy

---

## 7. Withdrawal email

**Classification:** transactional

**Decision:** include one. If Andy explicitly withdraws a quote, the
client should know the link is dead. Brief.

**Prompt calibration notes:**
- Not apologetic. Not dramatic. Just clear.
- Door left open to revisit.

**Subject examples:**
- "That quote's been pulled"
- "Heads up — quote withdrawn"

**Example output:**

> Hey Sarah,
>
> I've withdrawn the quote I sent on {sent_date} — the link's been
> deactivated.
>
> If things shift and you want to revisit, just reply here.
>
> Andy

---

## 8. Cancel-intercept email — pre-term retainer "Let's chat"

**Classification:** transactional

**Prompt calibration notes (from spec §6.7):**
- Client clicked "Let's chat" on the cancel page. Andy needs to reach
  out.
- Never defensive. Never begging. Never "we're sorry to hear."
- Acknowledge the client's position openly.
- Offer a 15-minute call, not a text-based back-and-forth.
- Dry, warm, specific.
- Reference something from the engagement (via Client Context Engine).

**Subject examples:**
- "Saw your message — let's talk"
- "Let's have a proper conversation about this"
- "15 minutes — worth it before you decide"

**Example output:**

> Hey Sarah,
>
> Noticed you're thinking about the retainer. Fair enough — these
> things deserve a proper conversation, not a text exchange.
>
> Got 15 minutes this week? I'd rather hear what's going on directly
> than try to guess from a dashboard.
>
> Andy

---

## 9. Upgrade-intent email — post-term retention

**Classification:** transactional

**Prompt calibration notes:**
- Client explored upgrade options on the retention page. Andy follows up.
- Reference the specific tier they looked at.
- One specific reason why the upgrade suits them (from Client Context).
- Not a hard sell. Information-first.

**Subject examples:**
- "Stepping up — here's what that looks like"
- "{Tier_name} — a look at the scope"

**Example output:**

> Hey Sarah,
>
> Saw you looking at the Production tier. Makes sense — you've been
> getting more out of the shoots than the ads lately, and Production
> gives you a regular shoot day baked in.
>
> Happy to walk through the specifics. Let me know.
>
> Andy

---

## 10. Downgrade-intent email — post-term retention

**Classification:** transactional

**Prompt calibration notes:**
- Client explored downgrade options. Andy follows up.
- Not defensive. Practical.
- Focus on what stays vs what drops. Help them decide if it's enough.
- Offer a quick call.

**Subject examples:**
- "Scaling back — let's make sure it still works"
- "Core tier — here's what changes"

**Example output:**

> Hey Sarah,
>
> Core can work — the question is whether it covers enough ground to
> keep the momentum going.
>
> Let me walk you through what stays and what drops. 15 minutes is all
> it'll take.
>
> Andy

---

## 11. Pause-ending heads-up — SaaS

**Classification:** transactional

**Prompt calibration notes:**
- 3 days before SaaS pause ends. Informational.
- Confirm resume date, new commitment end date.
- "Everything picks up where you left off."
- Sign-off: "SuperBad" (not Andy — this is a SaaS product email).

**Subject examples:**
- "Your subscription resumes on {resume_date}"
- "Heads up — {product_name} comes back online {resume_date}"

**Example output:**

> Hey Sarah,
>
> Your {product_name} subscription comes back online on {resume_date}.
> Commitment now runs through {new_committed_until_date}.
>
> Everything picks up where you left off — no setup, no reconfiguring.
>
> If anything's changed, just reply.
>
> SuperBad
