# Setup Wizards — General Copy

> Canonical source for empty states, Observatory summary, wizard intro
> copy, and miscellaneous copy surfaces. Phase 5 build sessions read
> this file.

---

## 1. Empty states

### `/lite/integrations` hub — nothing connected

> Nothing connected yet. The critical flight gets you started — Stripe,
> email, and your inbox. Everything else comes when you need it.

### `/lite/integrations` hub — all critical done, others available

> The essentials are live. Connect the rest as you need them — or don't.
> They'll surface when a feature needs them.

### `/lite/integrations` hub — everything connected

> Everything's connected. If something breaks, you'll hear about it
> here first.

---

## 2. Post-completion Observatory summary

Renders on the celebration step for integration wizards. Fills from
the `VendorManifest` fields.

### Client tone (full, spaced, branded)

> **{vendorName} is connected.**
>
> We're now watching {jobCount} background jobs for cost and performance:
> {jobNames}.
>
> If anything looks unusual, we'll flag it. You don't need to do
> anything else here.

### Admin tone (terse)

> **{vendorName} connected.** {jobCount} jobs tracked: {jobNames}.
> Actor: `{actorConvention}`. Kill switch: `{killSwitchKey}`.

---

## 3. Wizard intro copy

Shown at the top of the first step. Audience-differentiated.

### Client tone

> **{wizardName}**
>
> {introCopy — from WizardDefinition.voiceTreatment.introCopy}
>
> Takes about {estimatedMinutes} minutes. Your progress saves
> automatically — you can come back anytime.

### Admin tone

> **{wizardName}** — ~{estimatedMinutes} min. Auto-saves.

---

## 4. Cancel confirmation modal

Appears when the user clicks cancel/close mid-wizard.

### Client tone

**Heading:** Leave this for now?

**Body:**
> Your progress is saved. You can come back anytime — we'll pick up
> right where you left off.

**Buttons:**
- "Save and leave" (primary)
- "Start over" (secondary, destructive — confirmation: "This clears
  your progress. Sure?")
- "Keep going" (tertiary link)

### Admin tone

**Heading:** Save or abandon?

**Buttons:**
- "Save for later"
- "Abandon"
- "Keep going"

---

## 5. Help escalation affordance

Appears after two consecutive step failures (spec §9.2).

### Client tone

> Stuck? Let's figure this out together.
> [Open a chat →]

### Admin tone

> Something's off. Want help?
> [Open setup assistant →]

---

## 6. Progress indicator labels

Shown on hover/tap over the segmented progress bar.

**Step labels:** derived from `WizardStepDefinition.label` per wizard.
No generic pool — each wizard defines its own step names.

**Completed step indicator:** ✓ (not a checkmark emoji — a styled SVG
check in brand-cream on brand-charcoal background)

**Current step indicator:** filled dot, brand-red

**Future step indicator:** hollow dot, neutral-400

---

## 7. Critical-flight banner (cockpit, pre-completion)

Shown on the Daily Cockpit until all three critical wizards complete.

> {completedCount} of 3 setup steps done. {nextWizardName} is next.
> [Continue setup →]

---

## 8. In-flight admin wizard health banner (cockpit, 7d idle)

Shown when an admin wizard has been idle for 7+ days.

> You started {wizardName} {daysAgo} days ago. Still there if you
> want it. [Resume →]

---

## 9. Wizard step copy — per-wizard content

Each wizard's step labels, field labels, help text, and validation
messages are authored by the consuming spec's build session — not here.
This file covers the **shell-level** copy only.

The exceptions are generic step types that carry copy regardless of
wizard:

### `review-and-confirm` step (generic)

**Heading:** Review and confirm.

**Subheading:**
> Here's what you've set up. Check it over before we lock it in.

**Confirm button:** Looks good. Finish.

### `async-check` step (generic)

**Loading text pool:**
1. "Checking…"
2. "Verifying the connection…"
3. "Almost there…"
4. "Talking to {vendor}…"

**Success text:** "Verified."

**Timeout text (after 60s):**
> This is taking longer than usual. You can wait, or close and come
> back — your progress is saved.

### `celebration` step (generic shell — outro line comes from outro-lines.md)

**Sound:** `sound:wizard_complete`

**CTA button (client):** Done

**CTA button (admin):** Done — back to cockpit
