# SaaS Subscription Billing — Cancel Flow Copy

**Surface:** `/lite/portal/subscription` (SaaS branches). **Spec:** `docs/specs/saas-subscription-billing.md` §6, §14. **Author:** Claude (CMS-4). The cancel flow motivational reality check is the defining brand moment of this page.

---

## Motivational reality check

Renders before any options. Not begging, not guilting, not offering discounts. Honest acknowledgment that building a business is hard and the frustration is the job.

### Copy

**Heading:** `Before you go.`

**Body (Playfair Display italic, centred, generous line height):**

> Building something is mostly this. The part where it feels like you're pushing a boulder up a hill and the hill keeps getting steeper and you start wondering if the boulder is even the right boulder.
>
> It is. And the fact that you're standing here deciding whether to keep pushing is the best evidence that you're the kind of person who finishes things.
>
> If SuperBad isn't the right tool for the job, that's fine. Cancel and take what you've learned. But if this is a Tuesday and you're tired — maybe give it until Thursday.

**Styling:** Dark Charcoal background. Warm Cream text. Playfair Display italic for the body. Generous padding (80px+ top and bottom). The text should feel like a moment, not a section. No heading font — the body IS the heading.

**After the text, a subtle divider, then the options below.**

---

## Product switch (soft first step)

- **Heading:** `Before you cancel — would a different tool suit you better?`
- **Body:** `You don't have to leave SuperBad to change what you're paying for.`
- **Product cards:** one per active product the subscriber isn't currently on. Name + one-line description + tier price range.
- **Card CTA:** `Switch to {productName}`
- **Dismiss:** `No, I want to cancel.`

If subscriber is on Full Suite or only one product exists: skip this section entirely.

---

## Pre-term branch (inside commitment period)

### Gate copy

- **Note:** `You're {monthsRemaining} month{s} into a {commitmentLength}-month commitment.`
- **Subtext:** `Cancelling early has options. None of them involve a penalty — just different ways to handle the time you've already committed to.`

### Option 1 — Pay remainder, keep access

- **Card heading:** `Pay the rest, keep access.`
- **Card body:** `You'll be charged ${remainderAmount} inc. GST today. Full access continues until {committedUntilDate}. No further charges after that.`
- **Confirmation heading:** `Confirm: pay ${remainderAmount} and keep access until {committedUntilDate}.`
- **Confirmation body:** `After {committedUntilDate}, your subscription ends. Your data stays for 30 days after that.`
- **Confirm button:** `Pay ${remainderAmount} and keep access` (charcoal-on-cream, de-emphasised)
- **Cancel button:** `Go back`

### Option 2 — 50% buyout, cancel now

- **Card heading:** `Pay half, cancel now.`
- **Card body:** `${buyoutAmount} inc. GST today. Access ends immediately. Your data stays for 30 days.`
- **Confirmation heading:** `Confirm: pay ${buyoutAmount} and cancel now.`
- **Confirmation body:** `Access ends today. Your data stays for 30 days — download anything you need before then.`
- **Confirm button:** `Pay ${buyoutAmount} and cancel` (charcoal-on-cream, de-emphasised)
- **Cancel button:** `Go back`

### Option 3 — 1-month pause

- **Card heading:** `Take a month off.`
- **Card body:** `No charges for 30 days. Your commitment extends by one month. One pause per commitment period.`
- **Already used:** `You've already paused once this commitment. This option's used up.` (greyed out)
- **Confirmation heading:** `Confirm: pause for 30 days.`
- **Confirmation body:** `Your subscription resumes on {resumeDate}. We'll email you 3 days before. The resume email includes a cancel link if you change your mind.`
- **Confirm button:** `Pause for 30 days`
- **Cancel button:** `Go back`

### Option 4 — Talk to us

- **Card heading:** `Talk to us.`
- **Card body:** `The bartender can help with questions, frustrations, or figuring out if there's a better fit.`
- **CTA:** Opens portal bartender chat. Not Andy's email.

### Option 5 — Continue (stay)

- **Card heading:** `Actually, I'll stay.`
- **Card body:** `Good call.`
- **CTA:** closes cancel flow, returns to product.

---

## Post-term branch (after commitment ends)

### Upgrade

- **Heading:** `Before you cancel — what about more?`
- **Tier cards:** higher-ranked tiers with price and dimension differences highlighted.
- **CTA per card:** `Upgrade to {tierName}`
- **If already on highest tier:** section hidden.

### Downgrade

- **Heading:** `Or pay less for less?`
- **Tier cards:** lower-ranked tiers.
- **CTA per card:** `Downgrade to {tierName}`
- **If already on smallest tier:** `You're already on the smallest plan.`

### Cancel

- **Heading:** `Here's what you'd be losing.`
- **List:** bulleted feature/dimension summary from their current tier. Each item is a real capability, not a marketing bullet. E.g., "4 keyword-researched posts per month" not "Content Engine access."
- **Buttons:**
  - `Actually, I'll stay.` (primary, emphasised)
  - `Cancel anyway.` (text link, muted, no button styling)

### Post-cancel confirmation

- **Heading:** `Cancelled.`
- **Body:** `Your subscription ends at the end of this billing period ({endDate}). You've got full access until then. Your data stays for 30 days after that.`
- **Earned CTA (per `feedback_earned_ctas_at_transition_moments`):** `If you come back, your Brand DNA and data will be here.` — no link, no button. Just a statement. The door is open.

---

## Card-not-on-file edge

- **Note:** `Your payment method isn't on file, so the paid exit options aren't available right now.`
- **CTA:** `Talk to us` → opens bartender chat.
- Options 1 and 2 disabled. Option 3 (pause) still available if eligible.

---

## Pause status page

Renders when subscription is already paused.

- **Heading:** `You're on pause.`
- **Body:** `Your subscription resumes on {resumeDate}. No charges until then.`
- **Option 1:** `Resume early` → reactivates immediately.
- **Option 2:** `Cancel` → visible, honest. Cancel link, not hidden.
- **Note:** `The resume reminder email on {reminderDate} will also have a cancel link.`

---

## Voice register notes

- The motivational reality check is the peak of the cancel flow. It should feel like a quiet moment — not a sales tactic, not a retention trick. If it reads like something a retention team wrote, it's wrong.
- "Maybe give it until Thursday" is the key line. It doesn't argue. It just suggests a pause that has nothing to do with business logic.
- The pre-term options are presented without steering. No "recommended" badge, no green/red colouring, no default selection. Four cards, same visual weight.
- "Actually, I'll stay" / "Good call." — two words. Not "We're glad you decided to stay! Here's what you can look forward to..." Just: good call.
- The post-cancel earned CTA is a single line, not a block. It earns its presence by being the last thing the subscriber reads. No link, no action — just acknowledgment.
