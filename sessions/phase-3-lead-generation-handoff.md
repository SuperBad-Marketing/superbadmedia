# Phase 3 Handoff — Lead Generation (Session 3)

**Date:** 2026-04-12
**Session type:** Phase 3 spec brainstorm (third of N)
**Output:** `docs/specs/lead-generation.md`
**Next session:** Andy's call — `docs/specs/intro-funnel.md` recommended (see §"What the next session should do")

---

## What was decided

Lead Generation is the first feature to feed the Sales Pipeline. It's an **operations pipeline, not a research tool** — runs automatically on a 3am cron, Andy's only daily surface is an approval queue, scoring and search config are set once in Settings. 13 brainstorm questions resolved.

### The 13 locks

1. **Q1 — Targeting:** financial-viability-first across two tracks (retainer and SaaS). Vertical-agnostic. Andy corrected my initial vertical-based framing.
2. **Q2 — Architecture:** unified search + dual-scored + winner-takes-all with qualification floors per track. Andy's model, cleaner than my three-option pitch.
3. **Q3 — Enrichment signal set:** nine sources (Meta Ad Library, Google Maps, Google Ads Transparency Center, PageSpeed, whois, Instagram Business Discovery, YouTube Data API, website scrape, Maps extras). Andy pushed back on my initial ad-centric framing; the expanded set catches businesses that don't run ads.
4. **Q4 / Q5 — Soft-adjustment:** Claude soft-adjustment (±10 with rationale, Haiku-tier) **deferred to v1.1**. v1 scoring is pure rules with `softAdjustment = 0` passed through as a forward-compat placeholder. The function signature accepts the parameter from day one so v1.1 enables a flag, not a refactor.
6. **Q6 — Contact email discovery:** Hunter.io Domain Search as primary, pattern inference fallback marked `email_confidence: 'inferred'`, inferred-email bounces treated as expected (not reputation incidents).
7. **Q7 — Approval queue + earned autonomy:** single queue across both tracks (newest first). Per-track graduation state machine: `manual → probation → auto_send → circuit_broken`. 10 clean approvals unlock probation; 5 probation sends unlock auto_send; rolling-20 at 80% clean maintains; hard bounce / spam complaint / sub-60s unsubscribe / drift-flagged all circuit-break. 15-minute delay on auto_send sends so Andy can Reject. Clean = manual approval with zero edits; nudged = non-clean.
8. **Q8 — Warmup ramp:** 5 → 10 → 15 → 20 → 30/day over 4 weeks, non-overrideable. Lives in `resend_warmup_state` with week computed from `started_at`.
9. **Q9 — Sequences:** engagement-gated indefinite with 4-tier engagement model. Tier 1 (click) / Tier 2 (full open ≥60s dwell) / Tier 3 (sub-60s open only) / Tier 4 (none). Tiers 3 and 4 both increment `consecutive_non_engagements`; Tiers 1 and 2 reset it. Cutoff at 3 consecutive non-engagements. Sub-60s opens still count as positive weighted-metrics signal per Andy's direct correction.
10. **Q10 — Search input UX:** automated daily run configured once in Settings → Lead Generation → Daily Search (wizard-wrapped). Fields: location + radius, optional category, standing brief, max new prospects/day, dedup window, run time, Run now button. Manual override via "Looking for something specific?" button on the Lead Gen surface. **Warmup cap clamps the daily run output non-overrideably** — if user setting is 20/day and warmup cap is 5/day, effective max today is 5 (minus any scheduled sequence touches). Visible in Settings at config time.
11. **Q11 — Surface shape:** three tabs — Queue / Runs log / Metrics. Queue is primary with header showing today's run summary, per-track autonomy state, warmup state. Runs log is raw table of last 30 runs. Metrics is a **closed list of 4 panels**: Funnel (30d), Approval rate sparkline (30d, per track), Autonomy streak (per track), Warmup progress.
12. **Q12 — Do Not Contact:** three-tier with single enforcement function. Company-level (existing) + email-level (new `dnc_emails` table) + domain-level (new `dnc_domains` table). `isBlockedFromOutreach()` is the only read path, called from exactly three places: dedup, pre-draft, pre-send. Management surface at Settings → Lead Generation → Do Not Contact, three tabs.
13. **Q13 — Sender identity:** single fixed sender `Andy Robinson <hi@contact.superbadmedia.com.au>`. One warmup, one reputation, one reply pipe. Multi-sender retrofit documented as v1.1 half-day upgrade.

### The architectural key move: Candidate → Deal at first send

Prospects sourced by the daily run live in `lead_candidates` until the first outbound send fires, at which point `createDealFromLead()` promotes them to a Pipeline Deal at the `Lead` stage. This keeps the Pipeline's Lead column from becoming a graveyard of untouched prospects. Manually-entered prospects (typed directly into Pipeline) skip `lead_candidates` entirely.

### The data model

Full Drizzle schema in spec §4. Key new tables:
- `lead_candidates` — prospects from daily runs, with viability profile + pending draft reference
- `outreach_drafts` — every Claude-generated draft, with nudge chat thread + drift check metadata + approval state
- `outreach_sends` — authoritative send record tied to Resend message ID with engagement signals
- `outreach_sequences` — state machine for engagement-gated continuation
- `lead_runs` — append-only audit log of every daily run (powers Runs tab + Metrics panel)
- `dnc_emails` / `dnc_domains` — email and domain blocklists
- `resend_warmup_state` — single-row warmup ramp state
- `autonomy_state` — per-track graduation state (rows for `saas` and `retainer`)

Companion changes to existing tables:
- `contacts.email_status` enum gains `'unsubscribed'` (Pipeline spec update needed)
- `activity_log.kind` enum gains Lead Gen values (Pipeline spec update needed)

---

## Spec changes flagged to other documents

### `docs/specs/sales-pipeline.md` — two non-breaking updates needed
1. **`contacts.email_status` enum** gains `'unsubscribed'` — needs a migration row and the spec §4 schema update.
2. **`activity_log.kind` enum** gains: `outreach_sent`, `outreach_opened`, `outreach_clicked`, `outreach_replied`, `outreach_bounced`, `outreach_unsubscribed`, `sequence_stopped_engagement`, `sequence_stopped_manual`, `autonomy_graduated`, `autonomy_demoted`. Non-breaking.

Neither of these are blocking for Lead Gen to enter build. They can be picked up in the first Phase 5 schema session.

### `SCOPE.md` — no edit required
SCOPE §1 mentions Apollo.io as a possible paid data source; this spec supersedes with the Meta Ad Library + Google Maps + Google Ads Transparency Center + Hunter.io mix. Specs are allowed to supersede SCOPE — just flagging for context.

### `FOUNDATIONS.md` — no edit required
Lead Gen composes §11.1 (universal audit log), §11.2 (safe-to-send gate), §11.3 (timestamps), §11.4 (quiet window), §11.5 (drift check) as designed. First concrete feature to use all five.

### `docs/specs/design-system-baseline.md` — no edit required
No new BHS locations. Existing closed list (+ the RETAINER/SAAS Won badge from Pipeline) covers Lead Gen's surfaces.

---

## Memory updates this session

**None.** No new persistent memories needed. The session ran clean against existing memories; every corrective was a spec-local decision, not a reusable principle.

---

## New Phase 3 specs spawned during this session

**None.** All scope was absorbed into this spec. No new features spawned to other backlog sessions.

Lead Gen touches several existing-backlog specs as integration points:
- **Client Context Engine** (backlog #7) — Lead Gen's `generateDraft()` is architecturally a special case of the Context Engine's draft primitive (empty-history cold fallback). Context Engine spec session should refactor Lead Gen's generator to delegate without behavioural change.
- **Content Engine** (backlog #10) — Lead Gen's `recentBlogPosts` parameter is populated from Content Engine queries once it ships.
- **Unified Inbox** (backlog #11) — inbound reply matching will auto-transition sequences to `stopped_reply`; until then, manual "They replied" button from Pipeline is the only route.
- **Setup Wizards** (backlog #13) — Lead Gen adds wizard steps for Meta Ad Library, SerpAPI, Hunter.io, PageSpeed, Instagram OAuth, YouTube API, Resend cold-subdomain DNS, and initial Daily Search config.

---

## Key decisions worth flagging for the next sessions

1. **`enforceWarmupCap()` and `isBlockedFromOutreach()` are Lead Gen's two chokepoints.** Any new feature or retry/resend code path that bypasses either is a regression. Build-time disciplines §12.A / §12.I / §12.J cover them.
2. **Scoring rules live in code, never in a config UI.** `scoring.ts` is the only source. No "tune scoring rules in Settings" feature, ever, in v1. Changes ship as deploys.
3. **Prompts live in version-controlled files at `lib/lead-gen/prompts/`.** No inlined prompt strings in route handlers. Matches Content Engine's locked pattern.
4. **`lead_candidates` is append-only through the candidate lifecycle.** `promoted_to_deal_id` populates on first send; the row is never deleted. Audit trail.
5. **Candidate → Deal promotion happens at first-send time, not at candidate-creation time.** This is the architectural answer to "Lead column graveyard." Future specs that touch Pipeline's Lead stage should assume this pattern.
6. **Autonomy is earned, per track, and can circuit-break.** The graduation state machine is not decorative — it's the trust mechanism that lets Lead Gen operate hands-off. Circuit breakers are loud (notification + urgent sound + activity log). No silent autonomy flips in either direction.
7. **Engagement tiering is noisy and will need v1.1 tuning.** The 60s dwell threshold and the 3-consecutive cutoff are both starting points. Metrics panel's approval rate sparkline is the signal that catches drift before it burns.
8. **Foundations §11.1–§11.5 must all be honoured.** Lead Gen is the first feature that composes all five. If any of them are missing from `lib/integrations/resend.ts` or `logActivity()` when the first Phase 5 session starts, those must be built first.

---

## Open questions deferred to Phase 5

Captured in spec §16. None block Phase 4 build planning.

1. Sub-60s open threshold (60s is starting point)
2. Cadence values (4/7/10 days starting point)
3. Hunter.io pattern inference fallback list
4. Send-failure-mid-promotion edge case (recommended: leave candidate in skipped state with retry button)
5. Maintenance floor rolling window size (20 is starting point, may be too narrow for retainer track)
6. Daily run error recovery mid-flight
7. Multi-sender retrofit path (documented as half-day v1.1 upgrade)

---

## Risks carried forward

1. **Enrichment pipeline is the single largest failure surface.** 9 APIs, each with rate limits, auth, schemas, failure modes. Mitigation: each signal is optional, `viabilityProfile` degrades gracefully, `lead_runs.per_source_errors_json` captures per-source failures.
2. **Warmup discipline must be enforced by code, not trust.** Any new code path bypassing `enforceWarmupCap()` or `isBlockedFromOutreach()` is a compliance + reputation regression. Mitigation: both are named chokepoints with tests asserting they're called from every send path.
3. **Earned autonomy graduation is the cleverest piece of the spec.** Four failure modes (too early, too late, silent circuit, state machine bugs). Mitigation: all four visible on the metrics panel, dedicated Phase 5 test harness session with manufactured scenarios.
4. **Apple Mail Privacy Protection noise.** The 3-sub-60s-in-a-row rule can false-positive. Mitigation: clicks always reset the counter; v1.1 tuning with real data.
5. **Hunter.io cost creep.** Per-lookup billing can bottleneck. Mitigation: lookups happen AFTER scoring + qualification, so budget is only spent on already-qualified candidates.
6. **Resend shared-IP deliverability drift.** Foundations already flags this. Mitigation: dedicated IP upgrade path documented.

---

## What the next session should do

**Recommended next session: `docs/specs/intro-funnel.md`.**

Rationale:
- Pipeline's Trial Shoot stage (Q12 lock in Pipeline) is currently a hole — cards can sit there but nothing feeds them except manual entry.
- Intro Funnel is the smallest remaining spec with high downstream value: landing page, $297 Stripe purchase, feedback questionnaire form, customer-side trial shoot view.
- It unblocks the retainer sales path end-to-end.
- It's a natural companion to Lead Gen — Lead Gen drops cold candidates at `Lead`, Intro Funnel drops paid candidates at `Trial Shoot` (the default retainer path per Pipeline Q12).

**Alternative orderings worth considering:**
- **Brand DNA Assessment** — the largest remaining spec; tackling it next knocks out the hardest creative work while momentum is high. Counter: burns a full session on question-bank design before Pipeline is fleshed out with more feeding features.
- **Quote Builder** — unblocks the Quoted stage and enables Stripe webhook end-to-end testing. Counter: Stripe test mode + fixture quotes can stand in while we ship more sales-facing specs.
- **Client Context Engine** — paired with Brand DNA; would retroactively simplify Lead Gen's `generateDraft()` into a delegation. Counter: large session, dependency-heavy, best saved until more feeding specs exist.

Andy picks at the start of the next "let's go".

**Read in order:**
1. `CLAUDE.md`
2. `START_HERE.md`
3. `SESSION_TRACKER.md` (for Next Action block)
4. This handoff
5. `sessions/phase-3-sales-pipeline-handoff.md`
6. `SCOPE.md` (especially "Sales pipeline" Trial Shoot mentions + the Intro Funnel paid offer flow)
7. `FOUNDATIONS.md`
8. `docs/specs/design-system-baseline.md`
9. `docs/specs/sales-pipeline.md` (Trial Shoot panel and customer-side portal touchpoints)
10. `docs/specs/lead-generation.md` (for the `createDealFromLead` pattern that Intro Funnel will also use)
11. `MEMORY.md`

**Brainstorm rules unchanged.** One MC question at a time, recommendation + rationale, closed lists for any scarcity decisions, default to splitting if new scope emerges.

**Likely first MC question for Intro Funnel:** landing page architecture — single-page with inline purchase, multi-step page per section, or a dedicated sub-site. Trade-off is conversion optimisation vs build complexity vs marketing-site coupling.

---

## Phase 3 backlog (after this session)

*12 specs remaining, 3 locked.*

1. ~~`docs/specs/lead-generation.md`~~ ✅ **LOCKED (this session)**
2. `docs/specs/intro-funnel.md` — **recommended next**
3. `docs/specs/quote-builder.md`
4. `docs/specs/branded-invoicing.md`
5. `docs/specs/brand-dna-assessment.md`
6. `docs/specs/onboarding-and-segmentation.md`
7. `docs/specs/client-context-engine.md`
8. `docs/specs/client-management.md`
9. `docs/specs/saas-subscription-billing.md`
10. `docs/specs/content-engine.md`
11. `docs/specs/unified-inbox.md`
12. `docs/specs/daily-cockpit.md`
13. `docs/specs/setup-wizards.md`
14. `docs/specs/hiring-pipeline.md`

---

## Honest reality check on Lead Gen itself

**Is this spec actually doable?** Yes — roughly 9–10 Phase 5 sessions, each small and well-scoped. No hidden dependencies. Biggest unknown is enrichment (9 APIs); if any source turns out harder than expected, that session splits.

**What's genuinely hard:**
- Enrichment pipeline's 9-source fan-out with graceful degradation
- The two chokepoint functions being impossible to bypass (discipline, not tech)
- Autonomy graduation state machine has 4 failure modes, all visible on metrics
- Engagement tiering will be noisy until v1.1 tuning

**What's probably fine:**
- Dual-track scoring (pure functions, testable)
- Single DNC enforcement function (textbook good design)
- Single sender identity (simplest possible)
- Runs log as append-only audit (zero downside)

**What's out of scope and tempting:** scoring rules UI, dry-run mode, "why did this score 74" debug surface. All deferred or built-in as DB-only debug data.

**Verdict:** green light. Architecture is sound, disciplines are clear, failure modes are named.
