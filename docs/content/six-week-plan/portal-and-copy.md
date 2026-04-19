# Six-Week Plan Generator — Portal, PDF, and UI Copy

**Spec reference:** `docs/specs/six-week-plan-generator.md` §5, §6, §7, §13, §17
**Voice register:** Prospect-facing copy is warm, direct, honest. Admin copy is dry and functional.

---

## Portal plan page copy

### "Start Week 1" button

**Button text:**
> Start Week 1

**Subtext below button (DM Sans, small, muted):**
> You're running this. When you're ready, we'll start the clock.

*No "are you sure" modal. The click is the commitment. Per spec §6.2, activated_at sets immediately.*

### Intro block surround

*The plan_intro paragraph (Claude-generated, DM Sans) renders between the heading and the week cards. No additional surround copy needed — the intro speaks for itself. Heading above it:*

**Heading (Righteous, uppercase):**
> YOUR SIX-WEEK PLAN

### Week card empty-state

*Only visible if a plan is in generation or pending review. Not a typical prospect state — they see this only if they somehow navigate to /plan before approval.*

> Your plan is being put together. We'll let you know when it's ready.

### Revision modal

**Heading:**
> Tell us what's off

**Note above textarea (DM Sans, small):**
> You get one free revision on this plan. If you'd like more conversations about fit, that's something we can do as part of working together.

**Textarea placeholder:**
> *"What doesn't match your business — be as specific as you can."*

**Character minimum:** 40
**Validation message (if under 40 chars):** Give us a bit more to work with.

**Submit button:** Send this to Andy
**Cancel link:** Never mind

### Post-revision state (revision used up)

*The "This doesn't fit" link is replaced with:*

> Have more questions about this plan? [Email Andy →](mailto:andy@superbadmedia.com.au?subject=Question%20about%20my%20plan%20—%20{business_name_encoded})

### Revision reply inline card — regenerate variant

*Spec §6.1 F3.c. Shows when plan was regenerated after prospect's revision note.*

> Your plan was revised after your note.

**Dismiss control (small, right-aligned):** Got it

### Revision reply inline card — explain / hand-reject variant

*Shows when Andy sent an explanation rather than regenerating.*

> Andy replied to your revision note — [read →]

*Click expands inline (not modal) to show Andy's reply text. Tier-1 house spring.*

**Dismiss control (small, below expanded reply):** Got it

---

## Pending-refresh-review band copy (spec §8.1 / F3.e / F4.a)

*Quiet band above the plan intro block while `active_strategy.status = pending_refresh_review`.*

### Pre-payment variant (retainer_payment_received_at IS NULL)

> Andy's tailoring this plan for your retainer — the live version kicks in with your first payment.

### Post-payment variant (retainer_payment_received_at IS NOT NULL)

> Kicking off Week 1 shortly — Andy's putting the finishing touches on your plan.

*Neither variant references "pending refresh review" or any internal-state language. Per `feedback_felt_experience_wins`.*

---

## Archived-portal offline-page microcopy (spec §8.4 / F3.d)

*Rendered by Client Management §10 Archived mode when portal archives at day 60.*

**Heading (Righteous, uppercase):**
> YOUR PORTAL IS QUIET NOW

**Body (DM Sans):**
> Your plan stays yours — [download your PDF →].
>
> The photos and video from your shoot are still here too — [view gallery →].

**Below (DM Sans, small, muted):**
> If anything here lands differently now that you've had it for a while, Andy's inbox is always open.

*Warm sign-off, not administrative. No CTA beyond the mailto implied in the line.*

---

## PDF layout direction (spec §6.5 / F3.b)

### Cover page

**Layout:** Full-bleed Dark Charcoal background.
- **SuperBad mark** — top-left or centred, Warm Cream, moderate size (not dominant).
- **Business name** — set in Righteous, uppercase, Warm Cream, generous size. Centred vertically.
- **Date line** — below business name, DM Sans, Retro Pink: "Strategy dated {month} {year}" (e.g. "Strategy dated May 2026").
- **Subtitle** — below date, DM Sans, Warm Cream, smaller: "Six-Week Plan".
- No content preview. The cover is a single framing beat.

### Intermediate pages

- **Header:** Clean. No chrome. Plan content starts at top of page.
- **Footer:** SuperBad mark (small, left-aligned, Warm Cream) + page number (right-aligned, DM Sans, Retro Pink). Minimal — not a branded bar.

### Closing page

**Layout:** Full-bleed Dark Charcoal background.
- **Sprinkle line** — set in Playfair Display italic, Warm Cream, generous size, centred:

> This plan belongs to you. So does the nerve to run it.

- **SuperBad mark** — centred beneath the line, smaller than the cover mark.
- No CTA, no website, no "learn more." The line is the signoff.

### Render overlay (in-portal, during PDF generation)

*Synchronous Puppeteer render, ~2–5 seconds.*

**Overlay content:**
- SuperBad mark (centred, Warm Cream on Dark Charcoal)
- Below mark: "Putting your plan together…" (DM Sans, Retro Pink)
- Subtle pulse animation on the mark (house spring, gentle)
- Overlay auto-dismisses when download fires. Not a modal — no acknowledge action needed.

### Superseded-PDF notice (prompt modal)

*Fires when prospect visits the plan page after Andy regenerated their plan and they've previously downloaded the old version.*

**Heading:** Your plan was updated
**Body:** A newer version is ready — want the latest?
**Primary action:** Download updated plan
**Secondary action:** Not now

---

## Emails

### Revision-resolution email — regenerated (spec §7.3 / F3.c)

**Classification:** `six_week_plan_revision_regenerated`
**Trigger:** Andy approves the new version after regeneration from prospect's revision note

**Subject:** Your plan's been revised

**Body:**
> Hey {name},
>
> We took your note on board and rebuilt the plan. It's in your portal now — same place, updated version.
>
> [See your revised plan →]
>
> — Andy

*No plan content in the email body. Prospect goes to the portal to read.*

### Revision-resolution email — explained (spec §7.3 / F3.c)

**Classification:** `six_week_plan_revision_explained`
**Trigger:** Andy sends an explanation from the revision-review screen

**Subject:** About your plan

**Body:**
> Hey {name},
>
> {andy_reply_text}
>
> Your plan's still in your portal if you want another look.
>
> [Open your portal →]
>
> — Andy

*Andy's reply IS the body. The email is the envelope around it.*

### Non-converter expiry email — day 53 (spec §8.4 / F3.d)

**Classification:** `six_week_plan_non_converter_expiry`
**Trigger:** Day 53 post-shoot-completion (7 days before portal archive)

**Subject:** Your plan — keeping it yours

**Body:**
> Hey {name},
>
> It's been a few weeks since your shoot. Your photos, video, and six-week plan have been sitting in your portal — hopefully you've had a chance to dig in.
>
> The portal goes quiet in about a week. Your plan is yours either way — it's attached to this email as a PDF, same as what's in the portal.
>
> If anything here lands differently now that you've had it for a few weeks, you know where to find me.
>
> [Email Andy →](mailto:andy@superbadmedia.com.au?subject=Coming%20back%20about%20my%20plan%20—%20{business_name_encoded})
>
> — Andy

**Attachment:** Fresh PDF render (not cached).

*Four beats per spec: (1) warm acknowledgement, (2) signpost, (3) soft CTA, (4) signoff. No pitch, no form, no landing page.*

---

## Browser tab title rotation pool (Andy's review surface)

*For `/lite/six-week-plans/[planId]/review`.*

| State | Tab title options (rotate) |
|---|---|
| `pending_strategy_review` | "Plan for {prospect} — strategy ready" · "{prospect}'s plan — your call" |
| `pending_detail_review` | "Plan for {prospect} — details ready" · "{prospect}'s plan — nearly there" |
| Regen count ≥ 3 | "{prospect}'s plan — take three" · "Plan for {prospect} — maybe this one" |
| `approved` | "Plan for {prospect} — shipped" |

---

## Andy review UI microcopy

### Flagged assumption badges

- **Low confidence:** "We're guessing here"
- **Medium confidence:** "Probably right, worth checking"
- **High confidence:** "This one's solid"

### "What to verify" label

> Check with {prospect_name}:

### Regen-note placeholder

**Strategy regen textarea placeholder:**
> *"What should the strategy focus on differently? Be specific — the more you give it, the better the next pass."*

**Per-week regen textarea placeholder:**
> *"What's off about this week? Name the specific tasks or angles that need changing."*

### Self-review flagged banner

**Banner text (red, top of review page):**
> The self-review flagged some issues with this plan. See below.

**Per-issue format:**
> ⚠ {issue_description}

### Regen cost control warning (spec §5.4, ≥4 regens in 24h)

> This plan's had a few passes — want to pause and sketch it differently?

**Dismiss:** Keep going
