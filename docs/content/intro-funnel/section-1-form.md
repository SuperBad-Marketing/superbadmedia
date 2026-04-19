# Intro Funnel — Section 1 Contact Form Copy

**Spec reference:** `docs/specs/intro-funnel.md` §3, §9.1, §7.2
**Voice register:** Warm, direct, minimal. The form is part of the landing page — same quiet confidence.

---

## Form header

*Appears when the hero collapses and section 1 slides in.*

**Heading (Righteous, uppercase):**
> LET'S START

**Subline (DM Sans):**
> Tell us the basics. We'll take it from here.

---

## Field labels and helpers

| Field | Label | Placeholder / Helper |
|-------|-------|---------------------|
| Name | Your name | *"What should we call you?"* |
| Business name | Your business | *"The name on the door."* |
| Email | Email | *"Where we'll send your portal login."* |
| Phone | Phone | *"For day-of coordination. We won't cold call you."* |

---

## SMS opt-in

**Checkbox (checked by default):**
> It's okay to text me about my shoot.

**Helper text beneath (DM Sans, small, muted):**
> We'll only text about your booking — reminders, changes, that sort of thing. You can opt out any time.

*Compliance note: SMS consent language meets Australian Spam Act requirements. Checked-by-default is permissible for transactional/booking-related SMS when the relationship context is clear. This is NOT marketing consent — it's booking coordination.*

---

## Shape classification question

**Question (DM Sans, regular):**
> Which best describes your business right now?

**Options (tappable cards, single-select):**

| Option text | Maps to |
|------------|---------|
| It's just me | `solo_founder` |
| I run it with a small team | `founder_led_team` |
| There are a few decision-makers involved | `multi_stakeholder_company` |

*No explanation text on the cards. The options are self-evident. No "why are we asking" tooltip — it reads as natural interest, not segmentation.*

---

## Submit button

**Button (primary action):**
> Next

*Not "Submit" (too formal), not "Let's go" (too casual for a payment funnel). "Next" is honest — there's more after this.*

---

## Post-submit redirect

Instant redirect to `/lite/intro/[token]`. Portal welcome screen handles the dopamine moment — section 1 doesn't need a success state beyond the redirect.

**Magic-link email fires in parallel. Subject line:**
> Your SuperBad portal is ready

**Email body (brief, one paragraph):**
> Hey {name} — your portal's live. Everything about your trial shoot lives here from now on. If you ever need to get back in, this link's your key.
>
> [Return to your portal →]
>
> — Andy

*The "Return to your portal" link is a fresh magic-link OTT per spec §10.1 portal-guard.*
