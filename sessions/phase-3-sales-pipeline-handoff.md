# Phase 3 Handoff — Sales Pipeline (Session 2)

**Date:** 2026-04-11
**Session type:** Phase 3 spec brainstorm (second of N)
**Output:** `docs/specs/sales-pipeline.md`
**Next session:** Phase 3 — Lead Generation spec (recommended)

---

## What was decided

The Sales Pipeline is the spine of SuperBad Lite. Every other Phase 3 spec plugs into it via locked integration touchpoints (§10 of the spec). 14 brainstorm questions resolved.

### The 14 locks

1. **Q1 — Stage transition rigour:** auto-transitions from system events (Stripe + Resend webhooks); manual drag override always available; **Won protected with type-to-confirm modal** (drag-into-Won on Stripe-billed companies and any drag-out-of-Won requires typing the company name); Lost is always manual.
2. **Q2 — Manual billing:** new `Company.billing_mode` field with values `stripe` (default) and `manual`. Manual-billed companies can be dragged into Won with a simple confirm (no type-to-confirm). Unlocks the future Branded Invoicing flow.
3. **Q3 — Branded invoicing:** **split into its own Phase 3 spec session.** Auto-send fully branded invoices around renewal date for `manual` billing mode. Out of scope for Pipeline.
4. **Q4 — Entity model:** **three entities — Company + Contact + Deal.** Andy corrected my "two entities is enough for small businesses" recommendation. New project memory created (`project_client_size_diversity.md`).
5. **Q5 — Outbound advances stage:** outbound email send auto-advances `Lead → Contacted` on first send.
6. **Q6 — Bounce/complaint rollback:** Resend webhook handling rolls back the auto-advance ONLY if the Deal hasn't moved past the auto-advanced stage. Hard bounce → mark contact `invalid` + rollback + multi-contact picker. Soft bounce → flag only, retry after 24h. Spam complaint → mark contact `complained` + mark Company `do_not_contact = true` + rollback + freeze + urgent sound.
7. **Q7 — Activity feeds:** three feeds (Deal / Contact / Company) read from one `activity_log` table with three nullable FKs (`company_id` always non-null, `deal_id` and `contact_id` nullable). Company-level notes do NOT appear in Deal feeds — Deal feeds are deal-scoped.
8. **Q8 — Card content:** two-tier card. Compact (5 elements: company, deal title, value, next action, stale halo) always visible. Hover-expanded overlay (3 more: contact, last activity, quick actions) on **desktop only** with 300ms hover-intent delay. Mobile excluded — tap opens Deal detail directly. Tier 1 motion only (house spring fade), NOT a Tier 2 cinematic moment.
9. **Q9 — Next action:** hybrid auto-derived next action with manual override. Override resets on every stage transition. Default rule table per stage baked into the spec.
10. **Q10 — Loss handling:** Loss Reason modal with closed list of 7 reasons (Price, Timing, Went with someone else, Not a fit, Ghosted, Internal change, Other). `loss_reason` and `loss_notes` stored on Deal.
11. **Q11 — Deal value lifecycle:** single `value_cents` field, optional from any stage. `value_estimated` boolean tracks whether it's a guess. Quote Builder auto-overwrites and sets `value_estimated = false`. Locks at Won. Visual distinction: `est. $X,XXX` vs `$X,XXX` bold for confirmed.
12. **Q12 — Trial Shoot stage:** **NEW STAGE.** Andy revealed the trial shoot is the *default* path for nearly all retainer leads (not an alternative ingress as I'd been treating it). Added `Trial Shoot` as the 4th stage between Conversation and Quoted. Plus a Trial Shoot panel on the Company profile showing plan + questionnaire + sub-status timeline (booked → planned → in_progress → completed_awaiting_feedback → completed_feedback_provided) + completion timestamp. The Intro Funnel itself (landing page, purchase, questionnaire form, customer-side view) **splits into its own Phase 3 spec.**
13. **Q13 — Won flavour:** single Won stage with `won_outcome` field (`retainer` | `saas`). Drag-confirm modal picks up the choice for manual wins; webhook handler reads it from Stripe metadata for auto wins. Cards show a `RETAINER` (pink) or `SAAS` (orange) badge in Black Han Sans at caption size — **this is a new BHS location and needs to be added to the closed list of 8 in `design-system-baseline.md` §6.**
14. **Q14 — Stale-deal aging:** visual + auto-nudge generation + snooze. Per-stage thresholds (Lead 14d / Contacted 5d / Conversation 7d / Trial Shoot 14d post-feedback-wait / Quoted 5d / Negotiating 3d / Won never / Lost never). Soft amber halo on stale cards. `Snooze` quick action sets `snoozed_until` timestamp. **Auto-nudge generation deferred to v1.1** until Lead Gen lands; in v1, the `Send nudge` button opens a basic compose-and-send modal.

### The 8 stages (final, locked)

`Lead → Contacted → Conversation → Trial Shoot → Quoted → Negotiating → Won → Lost`

### The data model

Full Drizzle schema in spec §4. Key tables:
- `companies` (with `billing_mode`, `do_not_contact`, `trial_shoot_*` fields)
- `contacts` (with `email_status` enum, `is_primary`)
- `deals` (with stage enum, `value_cents`/`value_estimated`, `won_outcome`, `loss_reason`/`loss_notes`, `next_action_text`/`next_action_overridden_at`, `snoozed_until`, `last_stage_change_at`)
- `activity_log` (append-only, three nullable FKs, `kind` enum, JSON `meta`)
- `webhook_events` (idempotency table for Stripe + Resend, **mandatory from day one**)

### New component primitives this spec adds

- **`SheetWithSound`** — slide-over panel for Deal detail / Contact detail / Trial Shoot panel. Plays `whoosh-soft` on open.
- **`DestructiveConfirmModal`** — generic two-mode confirm (`simple` and `type-to-confirm`). Reused by Won-drag protection AND Loss Reason modal.

---

## Spec changes flagged to other documents

### `docs/specs/design-system-baseline.md`
**ACTION REQUIRED before next Phase 5 UI session:** add "Won card outcome badge (RETAINER/SAAS)" as a new BHS location. The closed list of 8 BHS locations either grows to 9, or one existing location gets swapped out. Andy's call. Captured in spec §7.3.

### `SCOPE.md`
**Alignment drift to fix:** `SCOPE.md` says paid intro offer leads land in `Conversation` (7-stage model). The Sales Pipeline spec supersedes this with an 8-stage model where the trial shoot is its own stage. `SCOPE.md` is allowed to be slightly out of date — the spec is authoritative — but flag this when next reading SCOPE for any other purpose.

---

## Memory updates this session

- **NEW:** `project_client_size_diversity.md` — SuperBad's clients are not uniformly small businesses; CRM data models must support multi-contact relationships. Created after Andy corrected my "small clients = single decision-maker" assumption in Q4.
- `MEMORY.md` index updated.

---

## New Phase 3 specs spawned during this session

Three new specs joined the Phase 3 backlog:

1. **`docs/specs/branded-invoicing.md`** — auto-send fully branded ATO-compliant tax invoices around renewal date for `Company.billing_mode = 'manual'` clients. Sequential numbering, ABN, GST, PDF generation.
2. **`docs/specs/intro-funnel.md`** — landing page for the $297 trial shoot, Stripe purchase flow, post-purchase feedback questionnaire form, customer-side trial shoot view (their own little portal showing the plan + their feedback + status), branching to retainer/SaaS.
3. **`docs/specs/hiring-pipeline.md`** — **NEW FEATURE Andy requested.** Parallel CRM for headhunting candidates against job listings. Same shape as the Lead Generation prospect search ("generate search" mirrors "generate email"). Reuses Pipeline's `KanbanBoard` and `activity_log` primitives — **build-time discipline §12.5 in the Pipeline spec mandates that these primitives stay generic enough to power Hiring Pipeline.**

---

## Key decisions worth flagging for the next sessions

1. **The integration touchpoints in Pipeline §10 are a contract.** Every later Phase 3 spec implements against these signatures. Don't re-open Pipeline decisions; extend them via the touchpoints.
2. **Webhook idempotency is a day-one discipline.** No "I'll add it later." Every Stripe and Resend handler writes to `webhook_events` before processing.
3. **`transitionDealStage()` is the ONLY entry point for stage changes.** No direct UPDATEs on `deals.stage`. This function validates, logs, fires sounds, updates timestamps, and resets the next-action override. Build-time discipline §12.4.
4. **The `KanbanBoard` and `activity_log` primitives must be generic.** Pipeline-specific terminology lives in a thin layer on top. Hiring Pipeline reuses both. Build-time discipline §12.5.
5. **Auto-nudge generation lights up automatically when Lead Gen ships.** Pipeline v1 has a manual compose-and-send modal as the placeholder. Pipeline does not block on Lead Gen.
6. **The Trial Shoot panel lives on the Company profile** (Client Management's territory) but is *defined* in the Pipeline spec because the Pipeline owns the `Trial Shoot` stage. Client Management spec will reference it.
7. **Andy reversed my "two-entity CRM" recommendation in Q4.** New persistent memory exists. Future sessions: never propose collapsing the multi-contact dimension. Default to multi-stakeholder support.

---

## Open questions deferred to Phase 5

Captured in spec §15. None block Phase 3 work.

1. Exact pixel values for the warm-tint column backgrounds (starting points in spec, in-browser tuning).
2. Soft-bounce retry timing (24h is a starting point).
3. Intro Funnel feedback questionnaire payload shape (locked in Intro Funnel spec, not here).
4. Empty state copy per column (drafted in `lib/empty-state-copy.ts`).
5. Hover-intent delay value (300ms starting point).

---

## Risks carried forward

1. **Stripe webhook reliability is the single biggest risk.** Pipeline lies if these flake. Mitigation: idempotency table from day one, signature verification, dedicated Phase 5 webhook session.
2. **Resend bounce/complaint rollback chain has many edge cases.** Mitigation: bounce-handler-only Phase 5 session with comprehensive test fixtures.
3. **Cross-spec coupling.** Pipeline is the spine — every other spec touches it. Mitigation: §10 integration touchpoints are the contract; later specs extend, not reopen.
4. **Hiring Pipeline reusability claim** is true only if we hold the discipline. Mitigation: build-time rule §12.5 + a Phase 5 reality check when Hiring Pipeline build session arrives.
5. **Tier 2 motion temptation on the Won transition** — perfect candidate for cinema, but it's not on the locked list. Mitigation: house spring + chime-bright sound is enough. Resist.

---

## What the next Phase 3 session should do

**Recommended next session: Phase 3 — Lead Generation spec.**

Lead Gen is the first feature to feed Pipeline (drops cards into `Lead`) and is also the source of the auto-nudge generation pipeline that Pipeline references. Building Lead Gen next unlocks the v1.1 auto-nudge feature in Pipeline and means every later spec session can assume both Pipeline AND Lead Gen exist.

**Read in order:**
1. `CLAUDE.md`
2. `START_HERE.md`
3. This handoff
4. `sessions/phase-3-design-system-baseline-handoff.md`
5. `SCOPE.md` (especially "Lead generation & assisted outreach")
6. `FOUNDATIONS.md`
7. `docs/specs/design-system-baseline.md`
8. **`docs/specs/sales-pipeline.md`** (now locked — Lead Gen integrates via `createDealFromLead()` and `attachOutboundEmailToDeal()` from §10.4)
9. `MEMORY.md`

**Brainstorm rules unchanged.** One MC question at a time, recommendation + rationale, closed lists for any scarcity decisions, default to splitting if new scope emerges.

**Likely first MC question for Lead Gen session:** prospect search source strategy — Apollo, SerpAPI scraping, both, or stub-now-decide-later. Trade-off is data quality vs. cost vs. terms-of-service exposure.

**Alternative session orderings worth considering:**
- Run **Intro Funnel** next instead, because the Trial Shoot stage in Pipeline is a hole until Intro Funnel exists. Counter: Pipeline can absorb manually-created Trial Shoot cards in the meantime; Lead Gen unlocks more downstream value.
- Run **Quote Builder** next, because Stripe webhook handlers in Pipeline can't be fully tested without quotes existing. Counter: Stripe test mode + fixture quotes can stand in.

Andy picks the next session topic at the start of the next "let's go".

---

## Phase 3 backlog (after this session)

- `docs/specs/lead-generation.md` — recommended next
- `docs/specs/intro-funnel.md` (NEW from Q12)
- `docs/specs/branded-invoicing.md` (NEW from Q3)
- `docs/specs/quote-builder.md`
- `docs/specs/client-management.md`
- `docs/specs/unified-inbox.md`
- `docs/specs/daily-cockpit.md`
- `docs/specs/saas-subscription-billing.md`
- `docs/specs/setup-wizards.md` — cross-cutting primitive
- `docs/specs/hiring-pipeline.md` (NEW from Andy's request)

10 specs to go. Each is a single brainstorm session of similar shape to this one.
