# Intro Funnel — Email & SMS Templates

**Spec reference:** `docs/specs/intro-funnel.md` §14, §15, §17, §24
**Voice register:** Andy's voice. Direct, warm, dry. Never corporate. Signed by Andy.
**All emails carry a fresh magic-link OTT in the footer per spec §10.1.**

---

## 1. Payment receipt email

**Classification:** `trial_shoot_payment_receipt`
**Trigger:** Stripe `payment_intent.succeeded`

**Subject:** Your trial shoot is booked

**Body:**
> Hey {name},
>
> Payment's through — $297, done. Here's what happens next:
>
> You'll pick a time for your shoot in your portal. We need at least five business days' notice so we can do the research that makes it worth your time.
>
> After the shoot, your photos, video, and a six-week marketing plan all land together — usually within a week.
>
> [Choose your shoot time →]
>
> — Andy

---

## 2. Booking confirmation email

**Classification:** `shoot_booking_confirmed`
**Trigger:** Calendar booking created
**Attachment:** `.ics` calendar invite

**Subject:** {date} — you're locked in

**Body:**
> Hey {name},
>
> Your shoot's booked for **{date}** at **{time}** ({timezone}).
>
> **Where:** Your place — {business_address_if_known, else "we'll confirm the location closer to the day"}.
> **How long:** About an hour.
> **What to wear:** Whatever you'd normally wear at work. Seriously.
>
> Between now and then, we'll be doing our homework on your business. You don't need to prepare anything.
>
> If something comes up, you can reschedule from your portal — we just need 48 hours' notice.
>
> [Open your portal →]
>
> — Andy
>
> *P.S. Calendar invite attached. Add it, or don't — we'll remind you either way.*

---

## 3. Apology email — SuperBad-initiated cancel

**Classification:** `apology_email`
**Trigger:** Andy cancels from Pipeline panel

**Subject:** I need to reschedule your shoot

**Body:**
> Hey {name},
>
> I'm really sorry — I need to move your shoot. {reason_if_provided, else "Something's come up on my end."}
>
> Your $297 is fully refunded. If you'd like to rebook, your portal's ready whenever you are — no need to pay again, we'll sort that out.
>
> [Rebook your shoot →]
>
> Genuinely sorry about this.
>
> — Andy

---

## 4. Apology email — SuperBad-initiated reschedule

**Classification:** `apology_email`
**Trigger:** Andy reschedules from Pipeline panel

**Subject:** Moving your shoot — sorry about this

**Body:**
> Hey {name},
>
> I need to move your shoot from **{original_date}**. {reason_if_provided, else "Something's come up on my end and I want to make sure your day gets my full attention."}
>
> I've opened up some new times — pick whatever works for you:
>
> [Choose a new time →]
>
> No charge, no catch. Sorry for the shuffle.
>
> — Andy

---

## 5. Abandon SMS — 15 minute

**Classification:** N/A (SMS via Twilio)
**Trigger:** 15 min after last activity, funnel state = contact_submitted or questionnaire_in_progress
**Template (hardcoded, no Claude):**

> Hey {first_name}, saw you started looking at a trial shoot — anything I can help with? — Andy

*No links. Links in SMS reduce delivery rates. The reply path is the engagement signal.*

---

## 6. Abandon SMS — 24 hour

**Classification:** N/A (SMS via Twilio)
**Trigger:** 24h after submission creation

> Hey {first_name} — your trial shoot portal is still there if you want to pick up where you left off. {portal_link} — Andy

*One link. Short. Not a pitch.*

---

## 7. Abandon email — 24 hour (~1h after 24h SMS)

**Classification:** `intro_funnel_abandon_24h`
**Trigger:** ~25h after submission creation (1h after SMS)
**Content:** Claude Haiku-generated, personalised from questionnaire answers + shape. Passes drift check.

**Prompt direction for Haiku:**

> Write a one-paragraph follow-up email to someone who started booking a trial shoot with SuperBad Marketing but didn't finish. You have their name, business name, and any questionnaire answers they completed.
>
> Voice: Andy's voice — direct, warm, no pressure. One paragraph. End with a portal link, no hard CTA.
> Never use: "just checking in", "following up", "don't miss out", "limited spots"
> Do: acknowledge they were interested, make it easy to come back, leave the door open.

**Subject (Haiku-generated):** Personalised, short. Fallback: "Still thinking about it?"

**Signed:** — Andy

---

## 8. Abandon email — 3 day (final rescue)

**Classification:** `intro_funnel_abandon_3d`
**Trigger:** 3 days after submission creation
**Content:** Claude Haiku-generated. Final attempt — reframes rather than reminds.

**Prompt direction for Haiku:**

> Write a short final follow-up email. This is the last time SuperBad will reach out about the trial shoot. The person started but didn't finish booking.
>
> Voice: honest, warm, no pitch. Reframe why it might be worth 15 minutes of their time. Close with "if now's not the right time, no worries" energy. One paragraph plus a closing line.
> Never beg. Never create urgency. Never reference "last chance."

**Subject (Haiku-generated):** Personalised. Fallback: "No pressure"

**Signed:** — Andy

---

## 9. Bundled deliverables announcement email

**Classification:** `deliverables_ready_announcement`
**Trigger:** Both gallery AND six-week plan approved (bundled gate fires)

**Subject:** Everything from your shoot is ready

**Body:**
> Hey {name},
>
> Your photos, video, and six-week marketing plan are all in your portal now.
>
> We put them together as a set — the plan references specific shots from your day, so it makes more sense when you see them side by side.
>
> Take your time looking through it. When you're ready, the plan's got a "Start Week 1" button — that's yours whenever.
>
> [Open your portal →]
>
> — Andy

---

## 10. Reflection-ready nudge email

**Classification:** `reflection_ready`
**Trigger:** 24h (configurable) after deliverables_ready

**Subject:** One more thing from your shoot

**Body:**
> Hey {name},
>
> There's a short reflection in your portal — takes a couple of minutes. It's not a survey, and we're not grading you.
>
> There's something at the end worth seeing. That's all I'll say.
>
> [Open your portal →]
>
> — Andy

---

## First-visit-after-bundle deliverables hub copy (spec §24 / F3.a)

*Rendered inside the Client Management portal on the prospect's first visit after `deliverables_ready`. One-shot — subsequent visits go to chat-home.*

**Hub header (Righteous, uppercase):**
> EVERYTHING FROM YOUR SHOOT

**Gallery tile label:** Your photos & video
**Gallery tile microcopy (DM Sans, small, Retro Pink):** *The moments we caught.*

**Plan tile label:** Your six-week plan
**Plan tile microcopy (DM Sans, small, Retro Pink):** *What to do with them.*

**Bartender first-visit opening line (after hub dismiss, prospect lands in chat-home):**
> Your photos, video, and plan are all in here now. Poke around — the menu's got everything. If you've got questions about the plan or want to talk through any of the shots, I'm here.

*The bartender acknowledges both deliverables, offers navigation, never summarises the plan or explains the gallery per spec §24.*
