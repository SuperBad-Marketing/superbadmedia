# Intro Funnel — Landing Page Copy

**Route:** `/trial-shoot`
**Spec reference:** `docs/specs/intro-funnel.md` §7.2, §8, §24
**Voice register:** Quiet confidence. Editorial, not direct-response. Found, not targeted.

---

## Block 1 — Understated opener

**Headline (Black Han Sans, large):**
> Most marketing looks like marketing.

**Subline (DM Sans, regular):**
> We make the kind of content people actually stop for. Then we build a strategy around it.

*Motion: subtle fade-in on load, no flash. House spring.*

---

## Block 2 — Delight moment

**Layout:** Single striking image, full-bleed or near-full-bleed. Real shoot output — high production, candid, cinematic framing.

**Caption beneath (DM Sans italic, Retro Pink):**
> She didn't know we were rolling. That's sort of the point.

*Art direction: the image should feel caught, not posed. Golden-hour light preferred. Subject engaged in their actual work, not looking at camera. The caption should be specific to whatever image is chosen — the above is a template for register, not final copy. Every caption follows the same pattern: observational, dry, never describes what's visible.*

*Motion: image enters on scroll with a subtle parallax. Caption fades in 200ms after image settles. House spring.*

---

## Block 3 — Value drop

**Layout:** Four lines, generous vertical spacing. No icons, no grid. Set in DM Sans, moderate size.

> 1 short-form video
> 10 edited photographs
> A bespoke 6-week marketing plan
> 60 days of portal access

**Below the list (DM Sans, slightly smaller):**
> That's what you walk away with. Whether you work with us after or not.

---

## Block 4 — "What happens at a trial shoot"

**Section heading (Righteous, uppercase, letter-spaced):**
> WHAT HAPPENS

**Numbered timeline (DM Sans). Each step is one sentence, second person:**

> 1. You tell us about your business. Takes two minutes.
> 2. We do our homework — your competitors, your audience, your neighbourhood.
> 3. We come to you. Sixty minutes, on-site, no studio.
> 4. You go back to work. We handle the rest.
> 5. About a week later, everything lands in your portal — photos, video, and a six-week marketing plan, all at once.

*The "about a week later" + "all at once" wording is the upfront timeframe signpost required by spec §24 / F2.a. Sets the bundled-deliverables expectation early so the post-shoot wait reads as care, not delay.*

---

## Block 5 — Curated past work

**Section heading (Righteous, uppercase, letter-spaced):**
> RECENT WORK

**Layout:** 3–4 images in a responsive grid. Each image has a one-line caption beneath.

**Caption register (DM Sans italic, Retro Pink):**
- *"A mortgage broker who hates talking about mortgages. We found something better."*
- *"The café that leads with cold brew. We ran with it."*
- *"Three partners, one story. It took us twenty minutes to find it."*

*Art direction: images from real shoots (or placeholders reflecting target verticals from business context — med aesthetics, financial planning, allied health). Businesses at the >$500k scale per `project_shoot_target_revenue`. Never beginner venues. Each caption is dry, specific to the business, hints at the strategic thinking without explaining it.*

*Motion: staggered entrance on scroll. House spring, 80ms stagger between items.*

---

## Block 6 — Quiet commitment

**Layout:** Two lines, set with breathing room. DM Sans, regular.

> We take three shoots a week, max.
> We ask for five business days' notice — enough time to do the research that makes your shoot worth showing up for.

*No "limited spots" language. No urgency. Just how we work.*

---

## Block 7 — Price, matter of fact

**Layout:** Price set large (Black Han Sans or Righteous), amount only. One line beneath.

> $297

**Below (DM Sans, regular):**
> GST inclusive. That's the whole number.

---

## Block 8 — CTA

**Above button (DM Sans, small):**
> Takes about two minutes. No obligation after that.

**Button (primary action, SuperBad Red background, Warm Cream text):**
> Book your shoot

*On click: hero collapses, section 1 form slides in where the hero was. House-spring transition, not a new Tier-2 moment.*

---

## Block 9 — Minimal footer

> © SuperBad Media Pty Ltd · Melbourne
> [Privacy] · [Terms]

*No social links, no "follow us", no newsletter signup. The landing page is self-contained. If they want more, they'll find it.*

---

## Upfront timeframe signposting (spec §24 / F2.a)

The following copy lines set the bundled-deliverables expectation across multiple surfaces:

**Landing page (block 4, step 5):** Already embedded above — "About a week later, everything lands in your portal — photos, video, and a six-week marketing plan, all at once."

**Payment confirmation surface (post-Stripe success):**
> Your shoot is locked in. After the day, we'll put your photos, video, and six-week plan together — you'll get everything at once, usually within a week.

**Booking confirmation email (body, after the date/time details):**
> Once we've wrapped, we'll build out your photos, video, and marketing plan. Everything lands in your portal at the same time — no drip-feed, no waiting for pieces. Usually about a week.

**Post-shoot portal "awaiting bundle" state (`shoot_completed_awaiting_deliverables`):**
> We're putting your photos, video, and six-week plan together. You'll get everything at once — we'd rather give you the full picture than send it in pieces.
