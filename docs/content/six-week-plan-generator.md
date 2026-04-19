# Six-Week Plan Generator — Content Mini-Session Output

Content for `docs/specs/six-week-plan-generator.md`. LLM prompts live in `lib/ai/prompts/six-week-plan/*.ts` — this file covers portal copy, email bodies, PDF layout, and Andy's review UI microcopy.

---

## Portal plan page copy

### Intro block surround

Renders above the plan intro paragraph (which is LLM-generated per-client). Static frame copy:

> **Your Six-Week Plan**
>
> Built from everything we learned about your business — what you told us, what we found, and what we saw on shoot day.

### "Start Week 1" button

Primary action. Copy:

> **Start Week 1**

Subtext beneath button (smaller, muted):

> You're running this. When you're ready, we'll start the clock.

### Week-card empty-state text

Shown for weeks not yet accessible (pre-activation, or weeks beyond the current cadence window):

> This week opens when Week {N-1} wraps.

### Revision modal

Heading:

> Tell us what's off

Note above textarea:

> You get one free revision on this plan. If you'd like more conversations about fit, that's something we can do as part of a retainer.

Textarea placeholder:

> What doesn't fit? Be specific — "the social posting cadence is too aggressive for my team size" helps more than "it doesn't feel right."

Submit button:

> Send revision note

### Revision reply inline card (F3.c)

**Regenerate variant** (plan was revised after their note):

> Your plan was revised after your note — have a read through.

Dismiss: "Got it"

**Explain / hand-reject variant** (Andy replied, plan stands):

> Andy replied to your revision note.

Click expands inline to show `revision_reply_body`. Dismiss below: "Got it"

---

## Email bodies

### Release email (`six_week_plan_released`)

Fires as part of the bundled `deliverables_ready` event — owned by Intro Funnel spec. No standalone release email for the plan. Plan release copy is a section within the bundled deliverables email (see `docs/content/intro-funnel.md` when that mini-session lands).

### Revision-resolved: regenerated (`six_week_plan_revision_regenerated`)

**Subject:** Your plan's been updated

**Body:**

We took your note on board and reworked the plan. It's live on your portal now — worth a fresh read through from the top, not just the parts you flagged.

{portal_link_button: "Read updated plan"}

Andy
SuperBad Marketing

### Revision-resolved: explained (`six_week_plan_revision_explained`)

**Subject:** Re: your revision note

**Body frame** (Andy's reply is the core — this is the envelope):

{andy_reply_body}

—
Andy
SuperBad Marketing

### Non-converter expiry (`six_week_plan_non_converter_expiry`)

**Subject:** Your plan — keeping a copy

**Body:**

It's been a few weeks since your shoot, and you've had the plan for a while now. Hopefully some of it's landed — even one or two of those early weeks can shift things.

Your portal goes quiet in about a week. The plan's yours either way — attached as a PDF, same version that's on the portal now.

If anything here lands differently now that you've had it for a few weeks, you know where to find me.

{mailto_link: andy@superbadmedia.com.au, subject: "Coming back about my plan — {business_name}"}

Andy
SuperBad Marketing

**Attachment:** Fresh PDF render of the plan at send time.

---

## Archived-portal offline-page microcopy (F3.d)

Renders on the Client Management archived-mode portal shell when a non-converter's 60-day window has closed.

> Your portal is quiet now. Your plan stays yours.

{download_pdf_link: "Download your plan"}

Below, if Pixieset gallery link exists:

> Your gallery's still live over on Pixieset — {pixieset_link}.

---

## Pending-refresh-review band copy (F3.e / F4.a)

Renders above the plan intro block on `/portal/[token]/plan` during post-Won, pre-refresh-review-live window.

**Pre-payment variant** (`retainer_payment_received_at IS NULL`):

> Andy's doing a pass on this for the retainer — the live version lands when your first payment comes through.

**Post-payment variant** (`retainer_payment_received_at IS NOT NULL`):

> Kicking off Week 1 shortly — Andy's finalising the refreshed plan.

---

## PDF layout direction (F3.b)

### Cover page

Full-bleed cover. Composition:

- SuperBad mark — top-left, modest size (not centred hero logo)
- Business name — large, set in the display typeface, vertically centred
- Date line — "Strategy dated {month} {year}" in body type, quiet
- Subtitle — "Six-Week Plan" in caps, small, beneath the date line
- No content preview, no table of contents

### Intermediate-page footer

- SuperBad mark — small, left-aligned in footer margin
- Page number — right-aligned in footer margin, body type
- No header chrome — clean space for plan content

### Closing page

Dedicated sign-off spread:

- Sprinkle line — set in display typography, larger than body, centred: **"This plan belongs to you. So does the nerve to run it."**
- SuperBad mark beneath — small, centred, quiet
- No CTA, no link, no "learn more"

### Render overlay

During synchronous Puppeteer render (2-5s):

- Branded progress overlay: SuperBad mark + "Rendering your plan…" + subtle spinner
- Overlay inherits Tier-1 house spring for enter/exit
- Auto-dismisses when download fires — not a modal the prospect acknowledges

---

## Andy's review UI microcopy

### Browser tab title rotation pool

For `/lite/six-week-plans/[planId]/review`:

- "Review: {prospect_name}'s plan"
- "{business_name} — six-week plan"
- "Plan review — {prospect_name}"

### Flagged-assumption badges

- **Low confidence** — red badge: "Low confidence"
- **Medium confidence** — amber badge: "Medium"
- **High confidence** — green badge (no text, just colour — high confidence is unremarkable)

### Flagged-assumption "Correct this" button

Inline beside each flagged assumption. Click adds the correction to a regen note textarea that appears at the bottom of the assumptions section.

Regen note textarea placeholder:

> What's actually true? The more specific you are, the sharper the regen.

### Regen-note placeholder (strategy review)

Appears when Andy clicks "Regen with note":

> What should the strategy do differently? e.g. "They're not ready for ads — lean heavier on organic for the first 4 weeks."

### Self-review flagged warning banner

Red banner at the top of the review screen when `self_review_flagged` is true:

> Automated review flagged issues with this plan. See below.

Issues render as a bulleted list beneath the banner.

### Strategy review action labels

- **Approve & generate weeks** (primary)
- **Regen with note** (secondary)
- **Pause this plan** (tertiary, muted)

### Detail review action labels

- **Approve plan** (primary)
- **Regen selected weeks** (secondary — appears when Andy checks week cards)
- **Regen content angles only** (secondary)
- **Back to strategy** (tertiary, muted)

### Revision-review action labels (§7.2)

- **Regenerate with this note** (primary)
- **Draft a reply** (secondary — triggers Haiku draft)
- **Write my own reply** (secondary — opens empty textarea)
