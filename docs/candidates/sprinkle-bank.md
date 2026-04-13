# Sprinkle Bank — candidate list for future voice-texture decisions

**Status:** candidate bank, not a spec. Nothing here is locked, scheduled, or committed. This file exists as a parking lot for "sprinkles of SuperBad throughout the site & platform" ideas that surfaced during the 2026-04-12 follow-up to the Surprise & Delight mini-brainstorm, so they're not lost and don't clutter the actual spec.

**Authority:** the governing philosophy is `feedback_surprise_and_delight_philosophy.md` (memory) and `docs/specs/surprise-and-delight.md` (spec). Nothing in this file overrides those. If anything here ever contradicts the spec or the memory, the spec and the memory win.

**How to use this file:**

1. When a Phase 3 spec is being written and touches a relevant surface, open this file, pick **1–2** items that naturally belong on that spec's surfaces, and lock them into the spec's "Voice & delight treatment" heading. Mark the picked items here as *claimed by \<spec name\>*.
2. Before Phase 5 build of `surprise-and-delight.md`, run a short (~20 min) promotion brainstorm that picks **3 categories from this bank to promote into the ambient closed list** in the S&D spec. Closed-list additions are a gate, same discipline as Tier 2 motion additions.
3. Anything not picked by the end of Phase 5 stays here as future iteration material. Not every sprinkle has to ship in v1 — concentration is the point.

**The discipline reminder is non-negotiable:** the 80/20 model works because it's concentrated. Adding everything in this file would turn Lite into a novelty site and kill the voice. The question is never *"which of these do we add"* — it's *"which 3–5 are so good Andy can't not do them."*

---

## 1. Ambient-layer extensions (closed-list additions — brainstorm gate)

The S&D spec locks the ambient layer at **6 surface categories**: empty states, error pages, loading copy, success toasts, placeholder text, morning brief narrative. Adding any of the below requires a closed-list brainstorm gate, same discipline as adding a Tier 2 motion moment.

- **Confirmation dialogs / destructive action prompts.** Example: *"this deletes the deal. no undo. we can't save you from yourself."* High-value because it's a moment where the user is already pausing — voice lands easily. Risk: overdoing dry humour in actually dangerous moments can undermine the "are you sure" question.
- **Form validation errors.** The tiny whispers under input fields. Example: *"that's not an email. close though."* High-volume surface — must be cached + drift-checked carefully or it'll feel random.
- **Status labels.** `pending` / `overdue` / `paid` / `unread` / `waiting` across the pipeline and inbox. Functional-first, voice-second. Easy to overdo.
- **Sign-out screen.** The half-second between click and redirect. Tiny, rare, easy to voice well.
- **Maintenance pages.** Rare, memorable, high-impact when they happen.
- **Session timeout warning.** *"you've been idle 45 minutes. the office is empty."* Admin-only.

**Recommended 3 for the promotion brainstorm:** confirmation dialogs, sign-out screen, session timeout warning. Reason: rare + high-impact + no risk of voice fatigue from over-exposure.

## 2. Structural character text (not ambient — functional copy that carries tone)

Copy that lives in structural positions but can carry voice without being decorative.

- **[CLAIMED by task-manager, brand-dna-assessment, client-management, saas-subscription-billing, setup-wizards]** **Browser tab titles.** *"SuperBad Lite — 3 unread"* vs *"SuperBad Lite — nobody's written"*. Dynamic. Subliminal. Every tab the user keeps open is a tiny SuperBad presence on their OS. Task Manager spec (2026-04-12 mini-brainstorm #4) locks this for the `/lite/tasks` page: `"SuperBad Lite — 4 overdue"` vs `"SuperBad Lite — nothing's on fire"`. Other surfaces may still claim their own dynamic title treatments — the claim is scoped to the Task Manager surface, not the whole pattern. Brand DNA Assessment (2026-04-12) claims: "SuperBad — Section 3 of 5" during assessment, "SuperBad — here you are" on reveal, "SuperBad — [Client Name]'s Brand DNA" on completed profile page. Note: client-facing surfaces use "SuperBad", never "SuperBad Lite" (see `feedback_no_lite_on_client_facing.md`). Setup Wizards (2026-04-13) claims: dynamic tab titles stratified by wizard phase (setting up / connecting / confirming / connected / stuck) with separate pools for admin tone ("SuperBad Lite — connecting Pixieset" / "SuperBad Lite — Pixieset connected") vs client tone ("SuperBad — setting you up" / "SuperBad — almost there"). Content mini-session authors the rotation pools.
- **CSV export filenames.** `clients-2026-04-12.csv` vs `clients-you-owe-work.csv`. Named exports are a moment.
- **URL slugs for terminal states.** `/goodbye` for unsubscribe confirmation, `/we-tried` for failed Stripe flows, `/after-hours` for the late-night site closure. These get shared and pasted — they're free branding.
- **Section headings on index pages.** *"Clients"* → *"the humans paying us"*. Use sparingly. Highest-risk item in the bank — easiest to drift into "trying too hard".
- **[CLAIMED by content-engine]** **System email subject lines.** Magic-link / receipt / password-reset subjects. Auth.js and Stripe both let us override these. Content Engine claims: newsletter notifications, draft-ready notifications, list milestone notifications — every Content Engine email carries a voiced subject line. See `docs/specs/content-engine.md` §10.1.
- **Page `<title>` tags on the marketing site.** Google search results are a voice surface.
- **`<meta name="description">`** — same reason.

**Recommended pick:** browser tab titles. Quietest, highest surface-area-per-line ratio, zero visual budget.

## 3. Transactional voice (emails, PDFs, receipts)

Every programmatic document Lite sends is a voice opportunity.

- **First line of magic-link emails.** One dry sentence above *"click this to sign in"*.
- **Stripe receipt custom text.** Stripe allows a short string on every receipt — a captive audience who's literally reading the document.
- **[CLAIMED by branded-invoicing]** **Invoice PDF footer.** Split treatment: dry line on unpaid PDF (content mini-session authors), *"paid in full. pleasure doing business."* on web view paid confirmation state. Locked into `docs/specs/branded-invoicing.md` §10.1 (Voice & delight treatment).
- **[CLAIMED by quote-builder]** **Quote PDF cover line.** Locked into `docs/specs/quote-builder.md` §4.4 (PDF template line 8) and §10.2 (Voice & delight treatment). The dry Playfair italic line that sits above the scope summary on the 1-page PDF. Content mini-session decides between per-quote Claude generation (drift-checked) and rotation from a hand-written pool (~20 lines minimum).
- **Unsubscribe confirmation page.** *"good luck out there."* A moment of grace after someone leaves — the opposite of the "please don't go" begging most unsubscribe pages do.
- **[CLAIMED by onboarding-and-segmentation]** **Welcome email first line.** The first sentence a new client reads from SuperBad programmatically. Claude-drafted per-client, drift-checked. Locked into `docs/specs/onboarding-and-segmentation.md` Voice & delight treatment.
- **Password reset email** (if SaaS auth ever needs one).
- **[CLAIMED by saas-subscription-billing]** **"Subscription cancelled" email.** The dying-fall moment — another grace opportunity. Locked into `docs/specs/saas-subscription-billing.md` §10.1 (Voice & delight treatment). Dying-fall grace, door left open. Content mini-session authors the copy.

**Recommended pick for the admin-egg expansion / sprinkle brainstorm:** system email first lines. A one-line prompt at the top of every programmatic email = texture everywhere, cost = near zero.

## 4. Recurring time-based pulses (calendar rhythm, not surveillance)

These fire on a schedule, not on a trigger. Different from hidden eggs — not rare, not surveilling, just seasonal.

- **Monday morning vs Friday afternoon cockpit.** Different tone of morning-brief framing depending on day-of-week.
- **Melbourne-specific dates.** AFL Grand Final Day, Melbourne Cup, EOFY (30 June). Single-day soft theming on admin + public.
- **End of quarter / end of month.** One-liner slot in admin footer.
- **Andy's birthday.** Once a year, one line. Either he notices or he doesn't.
- **Site anniversary** — 1 year since Lite launched, 2 years, etc. One-day commemoration line.
- **Southern-hemisphere winter solstice.** A line about shortest day, because it's funny to acknowledge.

**Recommended pick:** the Monday/Friday cockpit tonal shift. Already touches the morning brief slot (which is in the closed list), so no gate needed — it's a refinement, not an addition.

## 5. Signed-in admin greetings (Andy-only ambient texture)

Not eggs — daily texture. Fires every session.

- **Greeting line on cockpit rotation.** *"morning."* / *"evening, Andy. long one?"* / *"back already."* Rotates by time of day and day of week. Generated by `generateInVoice()` with time-of-day context.
- **Sign-in-after-absence line.** *"you haven't been in for 3 days. things happened."* Different from the late-night 2am hidden egg — this is daily texture, once per login, not once per month.
- **Sign-in on public holiday.** *"australian public holiday. why are you here."* Gentle — Andy opted into being a founder, not being nagged.
- **Streak-breaker greeting.** First login after a run of consecutive days. Explicitly avoid framing as a "streak" — no gamification — just a warm observation.

**Recommended pick:** the rotating greeting line on cockpit. Highest-frequency texture in the entire platform. If this lands, Andy gets a dry SuperBad moment every single time he signs in.

## 6. Visual & motion texture (non-copy sprinkles)

Non-text SuperBad-ness.

- **Text selection colour.** SuperBad Red highlight on Warm Cream text across the whole site + platform. Noticed subliminally every time anyone copies a line from the site. Zero visual budget, branded every time.
- **Scrollbar theming.** Warm charcoal track, SuperBad Red thumb. Works on macOS and Windows Chromium scrollbars.
- **Favicon animation.** Tiny pulse dot when the admin tab has unread inbox items or a hot lead. The "someone DM'd you on Twitter" dot treatment.
- **[CLAIMED by content-engine]** **OpenGraph images auto-generated per-page.** Every page that could ever be shared has its own OG card with a dry line baked in. Big investment, big payoff — every share link looks like a SuperBad moment. Content Engine claims: every published blog post gets a branded OG card with a dry line baked into the template. See `docs/specs/content-engine.md` §10.1.
- **Custom 404 illustration.** Not the default shadcn "404 page not found" — something visually SuperBad. Plays nicely with the existing ambient layer slot for error pages.
- **Cursor affordance on specific elements.** Rare. 1–2 deliberate spots. Must be subtle — not "funny cursor", just a moment.
- **Page transition sound that isn't catalogued.** Already ruled out by the sound registry lock — flagged here only to note it's been considered and rejected.

**Recommended pick:** text selection colour + scrollbar theming as a pair. Both are "set-and-forget" design tokens that brand every session of every user forever.

## 7. Long-form personality surfaces

Pages that exist mainly *to be* voice surfaces.

- **`/about`** — not a corporate "our story" page. A one-sided conversation. 200 words. Written once by Andy or generated and approved.
- **`/colophon`** — what Lite is built with, written like an annotated dinner menu. The kind of page a designer links to on Hacker News.
- **Marketing site footer.** Rotating one-liner instead of a static tagline. One-liner regenerates monthly via `generateInVoice()`.
- **[CLAIMED by onboarding-and-segmentation]** **Client portal footer.** *"last updated 3 minutes ago. by a human named Andy."* Shows liveness + humanness at once. Locked into `docs/specs/onboarding-and-segmentation.md` Voice & delight treatment — onboarding portal is the client's first exposure to this footer.
- **Marketing site `/now` page** (the Derek Sivers `/now` pattern). What Andy's working on right now. Hand-updated is fine — or could read from cockpit state.
- **`/humans.txt`** — a dry take on the old humans.txt convention.
- **`/privacy` and `/terms`.** Legal copy is legal copy, but the *intro paragraph* on each is a free voice slot.

**Recommended pick:** marketing site footer rotating one-liner. Everyone sees it; it compounds across visits.

---

## 8. Things explicitly NOT in the bank (for the record)

- **Anything gamified.** No streaks, points, badges, achievements, levels, collectables, progress bars framed as progress. The S&D spec's non-goals rule this out permanently.
- **Anything that pitches.** Selling kills the magic. Any sprinkle that resolves into a CTA is rejected.
- **Chat-style personality bots.** No "hi, I'm Lite, your friendly assistant". Lite is not personified as a character with dialogue — it's a dry platform that occasionally notices things.
- **Cursor trailing effects / particle systems / glitter.** No.
- **Auto-playing audio anywhere ever.** Already ruled out by the sound registry — flagged here only to close the door a second time.
- **Disabling right-click with a dry message.** Annoying, not clever.
- **Auto-appending a SuperBad signature to copied text.** Some sites do this. Don't.
- **Pop-up "you're about to leave!" exit intent.** Dark pattern. Not SuperBad.

---

## 9. My three recommendations for the sprinkle promotion brainstorm

Before Phase 5 builds the S&D feature, run a short brainstorm that picks **3 categories** to promote from this bank into the actual ambient closed list (growing it 6 → 9) and locks their copy-generation slots.

My nominations, ranked:

1. **Browser tab titles** (from §2 Structural character text). Quietest, highest surface-area-per-line ratio, zero visual budget. Every user with a Lite tab open gets subliminal voice presence.
2. **Signed-in admin greeting line on cockpit** (from §5 Admin greetings). Highest-frequency texture in the entire platform. Andy feels SuperBad every single sign-in.
3. **System email first lines** (from §3 Transactional voice). Texture in every programmatic email we send, cost near zero, lands on captive audiences.

Runner-up: **text selection colour + scrollbar theming** (§6) — not an ambient-layer promotion because it's not copy, but a design-token update that should land in the design-system-baseline revisit that's already owed.

---

## How items get claimed

When a Phase 3 spec locks a sprinkle from this bank, edit its bullet here to prepend `[CLAIMED by spec-name]` and link to the spec. Claimed items stay visible in the bank so the history is clear.

When the Phase 5 S&D build picks the 3 promoted categories, prepend `[PROMOTED TO S&D SPEC]` to those entries.

When Andy decides an item is explicitly never shipping, prepend `[REJECTED]` with a one-line reason. Rejected items stay visible as institutional memory.
