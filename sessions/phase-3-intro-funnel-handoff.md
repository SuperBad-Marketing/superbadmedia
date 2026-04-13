# Phase 3 Handoff — Intro Funnel (Session 4)

**Date:** 2026-04-12
**Session type:** Phase 3 spec brainstorm (fourth of N)
**Output:** `docs/specs/intro-funnel.md`
**Next session:** Andy's call — `docs/specs/quote-builder.md` recommended (see §"What the next session should do"), alternatives noted

---

## What was decided

Intro Funnel is the customer-facing acquisition surface for the paid $297 trial shoot. It's been reframed from "sales funnel" to "branded experience that happens to convert" — every decision in the spec respects that framing. 16 brainstorm questions resolved.

### The 16 locks

1. **Q1 — Full flow shape:** landing → section 1 contact → instant portal → questionnaire sections 2–4 → "pay now & book" card → Stripe Payment Element → native calendar → shoot → deliverables → reflection → retainer-fit synthesis → Daily Cockpit for Andy's review.
2. **Q2 — Portal opens after section 1 (not after all 4 sections).** Fast dopamine payoff. Questionnaire sections 2–4 happen inside the portal, personalised.
3. **Q3 — Enrichment runs async on section 1 submit (with amendment).** Gives automations context + disqualifies poor fits. Poor fit = no auto-follow-up drafting, NOT Pipeline removal. Andy's correction to my original "skip enrichment" recommendation.
4. **Q4 — Portal state machine:** 4 pre-payment states + 5 post-payment sub-states, hourly cron transitions.
5. **Q5 — Shape-branched questionnaire (simplified D):** single branching dimension (solo_founder / founder_led_team / multi_stakeholder_company), 3 variants × 4 sections = 12 question banks. Authored in follow-up mini-session. I originally pitched fixed 4 sections (B) and deferred D as too complex; Andy probed and I honestly reassessed — I was anchoring on stale reasoning.
6. **Q6 — Payment = Stripe Payment Element inline, cinematic reveal motion.** Candidate Tier-2 moment #1.
7. **Q7 — Native calendar, not Cal.com.** Andy corrected my Cal.com recommendation citing the `feedback_velocity_assumptions` memory I'd violated — "this won't be as slow as you're making out when we're using Claude Code." Opportunistic primitive shared with marketing-site booking widget.
8. **Q8 — Price editable via Settings → Products → Trial Shoot** with Stripe Payment Intent (dynamic amount), NOT Stripe Products + Prices (immutable).
9. **Q9 — Retainer-fit recommendation is Claude-generated.** Opus-tier, structured JSON output. Andy corrected my v1.1 deferral — "it won't need training data. The signal should be strong enough." I saved a new memory (`feedback_dont_undershoot_llm_capability.md`) from this correction.
10. **Q10 — Post-shoot reflection is a self-persuasion instrument, not feedback extraction.** Andy reframed the entire purpose mid-question. 8 questions, linear arc with safety-valve at Q1, Claude synthesis reveal as candidate Tier-2 moment #2.
11. **Q11 — Aggressive abandon cadence: 15m SMS → 24h SMS+email → 3d email → demote.** Andy introduced Twilio as new stack scope. Cascaded into phone fields, SMS consent, 8am–9pm quiet window, `dnc_phones` table, Twilio reply handling.
12. **Q12 — Cold re-engagement reads funnel history as context.** Single drafting path in Lead Gen's `generateDraft()`. No branching templates — Claude reasons from context (applying the new undershoot-capability memory).
13. **Q13 — Deliverables via Pixieset API + native branded gallery.** Initially I suggested URL link-out; Andy pushed back — make the most of Pixieset API if it exists, gallery URL as fallback. Candidate Tier-2 moment #3.
14. **Q14 — Landing page: on-brand editorial, URL-agnostic across migration.** Andy reframed from "high-conversion single-page" to "branded experience that funnels." `/trial-shoot` route, Lite pre-cutover, marketing site post-cutover.
15. **Q15 — Notification policy: loud on money + human touchpoints, quiet on automation.** Celebratory sound on payment; urgent on negative feedback, SMS replies, booking cancellations; quiet feed for starts, sections, recommendations, reflections.
16. **Q16 — Cancel/reschedule: D + SuperBad-side always-refundable.** 48h refund window, max 2 reschedules, auto-Lost on 3rd attempt. SuperBad-initiated cancel/reschedule is always fully refundable regardless of timing. Copy policy on landing page: *"If we ever need to cancel or reschedule on our end, you get a full refund — no questions, no timing catches."*

### The architectural key moves

1. **Deal creation at section 1 submit**, not at first send (Lead Gen's rule). Intro Funnel's section 1 is a stronger intent signal than a cold Lead Gen candidate, and Trial Shoot is an active stage (not Lead's graveyard).
2. **`funnel_state` as a nullable column on `deals`**, mirroring the authoritative state on `intro_funnel_submissions`. Pipeline can query Deal state without joining.
3. **Polymorphic `calendar_bookings` table** shared with future booking surfaces (marketing-site widget, follow-up conversations). Not an intro-funnel-only primitive.
4. **Two integration chokepoints** added: `enforceAdvanceNoticeRule()` and `enforcePerWeekCap()`. Joined by `isBlockedFromOutreach({ email, phone })` — Lead Gen's existing function gains a phone variant.
5. **Self-persuasion as design primitive**, not data collection. The reflection questionnaire's purpose is to get the prospect to convince themselves that continuing with SuperBad is the obvious next step. Claude synthesis reveal is the climactic moment; retainer-fit recommendation is a side effect.

### The data model

Full Drizzle schema in spec §4. New tables:

- `intro_funnel_submissions` — core funnel state + questionnaire answers + signal tags + abandon sequence state
- `intro_funnel_payments` — authoritative payment record tied to Stripe PaymentIntent
- `intro_funnel_bookings` — trial shoot booking with reschedule_count + cancel reason codes
- `intro_funnel_reflections` — post-shoot questionnaire answers + Claude synthesis text + decision CTA choice
- `intro_funnel_retainer_fit` — Claude-generated recommendation (retainer/saas/neither/either_strong + confidence + reasoning + flags)
- `calendar_bookings` — polymorphic primitive, shared
- `calendar_config` — single-row config
- `intro_funnel_config` — single-row feature config (editable price, copy blocks, reflection delay)
- `dnc_phones` — phone-level DNC, parallel to `dnc_emails`
- `twilio_sms_log` — outbound + inbound SMS log

Companion changes to existing tables:
- `deals` gains: `funnel_submission_id`, `funnel_state`, `post_trial_signal`, `pixieset_gallery_id`, `pixieset_gallery_url`, `reschedule_count`
- `contacts` gains: `phone`, `sms_opt_in`, `sms_consent_at`
- `activity_log.kind` enum gains 21 new values
- `deals.lost_reason` enum gains 7 new values (closed list 7 → 14)
- Trial Shoot sub-status gains `post_trial_awaiting_decision` and `post_trial_negative_feedback`

---

## Spec changes flagged to other documents

### `docs/specs/sales-pipeline.md` — non-breaking updates needed

See spec §19.1. 6 areas of additive change. None block Intro Funnel's Phase 5 build but should be picked up alongside Lead Gen's pending updates in the first Phase 5 schema session:

1. `deals` column additions
2. `contacts` column additions
3. `activity_log.kind` enum (21 new values)
4. `deals.lost_reason` enum (7 new values — Intro Funnel alone drives 6, Lead Gen drove 0; total growth 7 → 14)
5. Trial Shoot sub-status enum (2 new values)
6. `createDealFromLead()` source enum (1 new value: `intro_funnel_contact_submitted`)
7. Trial Shoot panel on Company profile gains 8 new fields/sub-surfaces
8. Stripe webhook handler gains `payment_intent.succeeded` branch for Intro Funnel

### `docs/specs/design-system-baseline.md` — revisit needed

3 new candidate Tier-2 motion moments spawned by Intro Funnel:
- Payment Element reveal (inline card unfolding to checkout)
- Claude synthesis reveal (reflection final screen)
- Deliverables gallery reveal (first view of native Pixieset gallery)

Locked closed list grows 7 → 10 Tier-2 moments (+2 overlays unchanged). Brief revisit session — 15–20 minutes, not a full spec session. Could be absorbed into the design system polish pass in Phase 5.

### `FOUNDATIONS.md` — new stack dependency: Twilio

Non-breaking addition. Mirrors Resend integration pattern:
- `lib/integrations/twilio.ts` wrapper with safe-to-send gate, quiet-window (8am–9pm local, stricter than email), DNC enforcement (phone variant), audit logging
- `dnc_phones` table
- Setup wizard step
- New SMS-specific quiet window constant

Pixieset is NOT a stack addition — just an integration wrapper + URL field. No Foundations touch.

### `SCOPE.md` — no edit required

Intro Funnel was already in scope as a post-brainstorm-expansion spec. SCOPE's "Paid intro offer" bullets under Lead Generation + Trial Shoot stage in Sales Pipeline align with what's been specified.

---

## Memory updates this session

**One new memory created:**

**`feedback_dont_undershoot_llm_capability.md`** — Claude can make qualitative judgments from rich context + well-described criteria; don't defer AI features to v1.1 because "there's no training data yet." Saved after Andy corrected me on the retainer-fit recommendation Q9. Paired with the existing `feedback_velocity_assumptions` memory as "don't undershoot Claude" — velocity covers build-time, this one covers AI-capability.

`MEMORY.md` index updated.

**No other memories.** All other correctives were spec-local decisions, not reusable principles.

---

## New Phase 3 specs spawned during this session

**None.** All Intro Funnel scope was absorbed into this spec. No new features spawned to backlog sessions.

Intro Funnel touches several existing-backlog specs as integration points (detailed in spec §19.4):

- **Brand DNA Assessment** (backlog #5) — shares signal-tag taxonomy
- **Onboarding + Segmentation** (backlog #6) — receives retainer-fit recommendation at Won
- **Client Context Engine** (backlog #7) — synthesis + retainer-fit prompts refactor to delegate to Context Engine when it ships
- **Client Management** (backlog #8) — receives fork-at-Won migration from Intro Funnel portal
- **SaaS Subscription Billing** (backlog #9) — Won-as-SaaS path when recommendation is `saas`
- **Unified Inbox** (backlog #11) — Twilio SMS thread joins inbox when it ships
- **Daily Cockpit** (backlog #12) — consumes Intro Funnel notification events
- **Setup Wizards** (backlog #13) — adds wizard steps for Pixieset, Twilio, calendar, Settings → Products

---

## Follow-up mini-session required: content authoring

Separate from Phase 5 build sessions. A dedicated creative/authoring session with `superbad-brand-voice` + `superbad-visual-identity` skills loaded. Full scope in spec §24. Produces:

- Landing page copy + visual direction + past work curation
- Section 1 form copy + shape classification question
- Sections 2–4: 3 shape variants × 3 sections = 9 question banks with full text, closed-list options, free-text prompts
- Signal-tag taxonomy v1
- Reflection questionnaire 8-screen text (including safety valve + synthesis framing)
- Confirmation email + apology email templates

Can run any time before Phase 5 session 5 (questionnaire build). Recommended: run it shortly before to keep context fresh.

---

## Key decisions worth flagging for future sessions

1. **Deal creation at section 1 submit is Intro Funnel's architectural answer to "where does the Pipeline card come from."** Any future spec that touches Pipeline entry points should assume this is non-negotiable for Intro Funnel.
2. **`enforceAdvanceNoticeRule()` + `enforcePerWeekCap()` + `isBlockedFromOutreach({ email, phone })` are Intro Funnel's chokepoints.** Same discipline as Lead Gen's chokepoints — any new code path that bypasses them is a regression.
3. **Native calendar is a shared primitive, not an Intro Funnel feature.** The marketing-site booking widget (future, unscoped in Lite) will reuse `calendar_bookings` + `calendar_config` + the availability engine. Build it clean.
4. **`intro_funnel_config` is a singleton, not multi-row.** If history ever becomes necessary, add a versions table — do not turn the singleton into a history table.
5. **Pixieset API capability is a Phase 5 discovery, not a Phase 3 commitment.** Spec reserves the native gallery path with URL link-out as documented fallback. Session 10 of Phase 5 confirms.
6. **Twilio is a narrow v1 integration** — only Intro Funnel abandon cadence + inbound reply handling + SuperBad-initiated apology (potentially). NOT for Lead Gen cold outreach, NOT for general client messaging. That's a v1.1+ expansion.
7. **The self-persuasion framing of the reflection questionnaire is the single most fragile creative decision in this spec.** A clumsy implementation feels manipulative. The safety-valve Q1 + genuine voice + absence of manipulation patterns is the safety net. Content authoring mini-session must treat this with care.
8. **Claude synthesis reveal is a load-bearing Tier-2 motion moment.** It's the payoff of the reflection arc. Design-system-baseline revisit must not downgrade it in the revisit session.
9. **Foundations §11.1–§11.5 are exercised for the first time here on a paid customer surface.** If any of them are half-built when Phase 5 session 1 starts for Intro Funnel, they must be completed first.

---

## Open questions deferred to Phase 5

Captured in spec §21. None block Phase 4 build planning.

1. SMS quiet window exact bounds (8am–9pm local is the starting point)
2. Abandonment threshold values (15m/24h/3d starting point)
3. Reschedule limit (2 is starting point)
4. Refund window (48h is starting point)
5. Per-week cap (3 is starting point, editable in Settings)
6. Pixieset API capability (full confirmation in Phase 5)
7. Calendar slot granularity (2h hardcoded v1)
8. Reflection delay after deliverables (24h default, editable)
9. Twilio identity — dedicated number or Andy's mobile
10. Signal-tag taxonomy content (authored in mini-session)
11. Dormant portal activity threshold (30d starting point)
12. Follow-up conversation booking duration (30 min default)

---

## Risks carried forward

Detailed in spec §22. Top 5 to watch:

1. **Twilio onboarding unknowns** — new stack, Australian carrier compliance, number provisioning. Mitigation: isolated integration, email-only fallback for abandon cadence if Twilio blocks.
2. **Pixieset API capability risk** — may not support native gallery. Mitigation: documented URL link-out fallback.
3. **Claude synthesis prompt quality is retention-critical** — bad output kills the reveal. Mitigation: §11.5 drift check + safe fallback + prompt iteration budget.
4. **Self-persuasion psychology is subtle** — can feel manipulative if mishandled. Mitigation: Q1 safety valve always first, content authoring handled as creative session with voice skills loaded.
5. **Payment amount tamper vulnerability** — server-computed PaymentIntent amount is the only defence. Never accept amount from client. Webhook re-verifies.

---

## What the next session should do

**Recommended next session: `docs/specs/quote-builder.md`.**

Rationale:
- Unblocks the Pipeline's Quoted stage end-to-end. Currently the only feeder into Quoted is manual typing — Quote Builder gives it a real creation path.
- Small-to-medium spec size. Focused on: quote generation surface, PDF output, Stripe integration for accepting quotes, quote→deal stage transition.
- Natural companion to Intro Funnel — once Intro Funnel's retainer-fit recommendation lands for a prospect and they're ready to talk, Andy moves them through to Quoted via a generated quote.
- Testable end-to-end with Stripe test mode, unblocks webhook patterns for future billing specs.

**Alternative orderings worth considering:**

- **Brand DNA Assessment** — the largest remaining spec; knocks out the hardest creative work while momentum is high. Counter: Quote Builder is the smaller momentum-preserving choice and unblocks billing patterns.
- **Branded Invoicing** — pairs with Quote Builder (invoicing naturally follows quoting). Could be a single spec session or two. Counter: either split or bundle is defensible.
- **Client Context Engine** — largest architectural spec remaining after Brand DNA. Dependency-heavy. Not a good next choice; wait until more feeding specs exist.

Andy picks at the start of the next "let's go".

**Read in order:**
1. `CLAUDE.md`
2. `START_HERE.md`
3. `SESSION_TRACKER.md` (for Next Action block)
4. This handoff
5. `sessions/phase-3-sales-pipeline-handoff.md`
6. `sessions/phase-3-lead-generation-handoff.md`
7. `sessions/phase-3-intro-funnel-handoff.md` (this file)
8. `SCOPE.md` (especially Sales pipeline → Quoted stage + manual-billed company context)
9. `FOUNDATIONS.md`
10. `docs/specs/design-system-baseline.md`
11. `docs/specs/sales-pipeline.md` (Quoted stage spec)
12. `docs/specs/intro-funnel.md` (for the retainer-fit recommendation pattern that Quote Builder will consume)
13. `MEMORY.md`

**Brainstorm rules unchanged.** One MC question at a time, recommendation + rationale, closed lists for scarcity decisions, default to splitting if new scope emerges.

**Likely first MC question for Quote Builder:** quote structure — is a quote a single document with line items, or a stage-gated proposal with multiple sections (scope, deliverables, pricing, terms)? Trade-off is simplicity vs. premium feel + retainer-appropriate framing.

---

## Phase 3 backlog (after this session)

*12 specs remaining, 4 locked.*

1. ~~`docs/specs/design-system-baseline.md`~~ ✅ **LOCKED**
2. ~~`docs/specs/sales-pipeline.md`~~ ✅ **LOCKED**
3. ~~`docs/specs/lead-generation.md`~~ ✅ **LOCKED**
4. ~~`docs/specs/intro-funnel.md`~~ ✅ **LOCKED (this session)**
5. `docs/specs/quote-builder.md` — **recommended next**
6. `docs/specs/branded-invoicing.md`
7. `docs/specs/brand-dna-assessment.md`
8. `docs/specs/onboarding-and-segmentation.md`
9. `docs/specs/client-context-engine.md`
10. `docs/specs/client-management.md`
11. `docs/specs/saas-subscription-billing.md`
12. `docs/specs/content-engine.md`
13. `docs/specs/unified-inbox.md`
14. `docs/specs/daily-cockpit.md`
15. `docs/specs/setup-wizards.md`
16. `docs/specs/hiring-pipeline.md`

Plus: design-system-baseline revisit (absorb 3 new Tier-2 moment candidates, ~15–20 min)
Plus: content authoring mini-session (Intro Funnel + questionnaire banks + reflection + copy — dedicated creative session)

---

## Honest reality check on Intro Funnel itself

**Is this spec actually doable?** Yes — roughly 13–15 Phase 5 build sessions, each small and well-scoped, plus the content authoring mini-session. Biggest unknowns are Twilio (new stack) and Pixieset API (unknown capability surface). Every other component is well-trodden territory.

**What's genuinely hard:**
- Twilio integration wiring (new stack, carrier compliance, reply handling)
- Pixieset API capability confirmation
- Claude synthesis prompt quality (iteration-heavy)
- Self-persuasion questionnaire authoring (creative load-bearing, fragile tone)
- Native calendar availability engine edge cases (races, timezones, business-day math)

**What's probably fine:**
- Stripe Payment Intents with dynamic amount
- Single enforcement chokepoints (pattern proven in Lead Gen)
- State machine transitions
- Funnel_state hourly cron
- Portal personalisation
- Deal creation at section 1

**What's out of scope and tempting:**
- Multi-language, A/B testing, in-portal chat, Google Calendar sync, phone push, CMS for copy, dynamic per-prospect pricing, gift cards/promos, multi-shoot packages, customer account self-service. All documented as not in v1 (spec §25).

**Verdict:** green light. Architecture is sound, disciplines are named, two risky integrations are isolated enough to fail gracefully. Content authoring is the biggest creative unknown and is handled as a separate mini-session.
