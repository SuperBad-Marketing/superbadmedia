# Phase 3 — Cost & Usage Observatory — Session Handoff

**Date:** 2026-04-13
**Phase:** 3 — Feature Specs
**Spec produced:** `docs/specs/cost-usage-observatory.md`
**Status:** LOCKED

---

## What was decided

- **Dual primary job:** alarm + attribution co-equal, forensic queryability free.
- **Actor model:** `internal | external | shared | prospect` (4 types). Single row per call; shared calls carry an ephemeral hashed `shared_cohort_id`; prorate at query time (even split in v1).
- **Three detectors in parallel from day one:** hard thresholds (per-call + daily), rate detector (loop-catcher — 10× trailing-hour median, sustained 5min, min 20 calls), learned bands (rolling p95 × 3, 7-day/50-call warmup).
- **Severity-tiered banner voice:** low (dry-calm), mid (neutral-louder), severe (terse-flat-red with kill-switch).
- **Prospect attribution transfers on conversion.** CPA, CPA-by-channel, CPA-by-ICP-segment, payback period all derivable.
- **Attribution reoriented around tier health, not per-subscriber triage.** Small/Medium negative margin = tier-design bug → tier-level alert. Per-subscriber recommendation cards **only for Large-tier** subscribers (only legitimate individual-triage case).
- **Subscriber visibility:** operator-only costs. Subscribers see product-level usage via existing SaaS Billing §5 (sticky bar + soft/hard cap). Two separate ledgers — `usage_records` (subscriber-facing) and `external_call_log` (operator-facing) — never merged.
- **Investigation UX:** Claude diagnosis card on top, raw-data table expandable below. New Opus prompt `diagnose-cost-anomaly.ts`. One-click band editor on anomaly detail view.
- **Platform safety net:** no auto-pause, no hard cap. Andy-set monthly AUD thresholds (up to 3), plus projected-spend alert (linear run-rate extrapolation). Subscriber spend is structurally bounded by tier caps.

---

## Key primitives introduced

- **`external_call_log`** — primary ledger. Every external call logs a cost tuple at the call site. Columns: `job`, `actor_type`, `actor_id`, `shared_cohort_id`, `units` (json), `estimated_cost_aud`, `prompt_version_hash`, `converted_from_candidate_id`, `created_at`.
- **`cost_anomalies`** — detected events. One row per `{detector, job}` per 24h dedupe window, with counter updates on subsequent fires.
- **`deploy_events`** — Vercel webhook target. Feeds diagnosis card's deploy correlation.
- **`observatory_settings`** — single-row table for Andy-editable thresholds + toggles.
- **Model/integration registry** (`lib/ai/models.ts`, `lib/integrations/registry.ts`) — every external call goes through it. Vendor SDK imports live here only; feature code imports named job helpers. Bands are **required** at registration. ESLint rule forbids direct vendor SDK imports from feature code.
- **`job_disabled_until`** on registry entries — the kill-switch state. Manual-only; never auto-triggered.
- **Three Claude prompts new:** `diagnose-cost-anomaly.ts` (Opus), `draft-negative-margin-email.ts` (Opus), `draft-weekly-digest.ts` (Haiku).

---

## FOUNDATIONS.md §11 patch authored by this spec

Rolled in several owed patches:

- **New principle:** every external call routes through the registry. No direct vendor SDK imports in feature code.
- **New principle:** every external call logs a cost tuple at the call site.
- **New principle:** jobs declare bands at registration time (required).
- **New principle:** quarterly model/version review ritual (Phase 6 owned).
- **§11.2 extension:** `sendEmail()` gains a required `classification: 'transactional' | 'outreach'` parameter (previously owed from Task Manager — this spec rolls it in). Transactional bypasses send-gate; outreach passes through.

Patch is authored by Phase 5 Session A of this spec (alongside the logging primitives build).

---

## Cross-spec flags for Phase 3.5

1. **Every locked integration-using spec** (lead-generation, intro-funnel, quote-builder, branded-invoicing, brand-dna-assessment, client-context-engine, client-management, saas-subscription-billing, content-engine, unified-inbox, daily-cockpit, task-manager, onboarding-and-segmentation, surprise-and-delight) — backward pass must verify each external-call site specifies `actor_type` and `actor_id` to pass. Called out by memory `project_llm_model_registry.md`.
2. **Daily Cockpit** — patch `getHealthBanners()` contract to include the `ObservatoryBanner` union (5 kinds: cost_anomaly, monthly_threshold, projection_threshold, tier_health, unknown_job).
3. **SaaS Subscription Billing** — add a note clarifying `usage_records` vs `external_call_log` are separate ledgers, never merged.
4. **Lead Generation** — specify that the conversion handler runs the prospect-rewrite transaction atomically.
5. **Intro Funnel** — specify that trial-shoot Stripe calls log with `actor_type: 'prospect'` until conversion.
6. **Every spec with LLM calls** — declare a `prompt_version_hash` constant convention imported from the registry.
7. **`activity_log.kind`** gains 10 new values: `cost_anomaly_fired`, `cost_anomaly_acknowledged`, `cost_anomaly_resolved`, `kill_switch_triggered`, `kill_switch_released`, `band_adjusted`, `monthly_threshold_crossed`, `projection_threshold_crossed`, `cost_attribution_transferred`, `observatory_settings_changed`.

---

## Content mini-session owed

Small-to-medium creative session with `superbad-brand-voice` + `superbad-visual-identity` skills loaded. Produces:

- Tier-low banner body pool (~10 variants, stratified by job family).
- Tier-mid banner body pool (~8 variants).
- Tier-severe banner body pool (~5 variants — templated around the breached metric, minimal voice).
- Diagnosis prompt calibration against 8–10 synthetic scenarios (prompt regression, loop, model upgrade, data spike, third-party price change, ambiguous drift, warmup false positive, multi-job cascade).
- Dashboard empty-state copy (~6 surfaces).
- Weekly digest email — subject-line pool (sprinkle-claimed — the observatory report), opener pool, section headings, closer pool.
- Threshold-crossed and projection-crossed banner copy.
- Kill-switch confirmation modal copy.
- Resume-from-kill-switch confirmation copy.

Must run before Phase 5 Session B (detectors + banners).

---

## New sprinkle claims

Weekly digest email subject line (dry rotation calibrated to MTD posture: green / amber / red). Marked `[CLAIMED by cost-usage-observatory]` in `docs/candidates/sprinkle-bank.md` during the content mini-session.

---

## New memories saved (this session)

- `feedback_technical_decisions_claude_calls.md` — don't ask Andy to pick between technical options. Silently lock implementation choices; surface only product-judgement questions. Reinforced mid-session when Andy flagged the brainstorm was drifting technical.
- `project_tier_limits_protect_margin.md` — tier limits are the primary margin-protection mechanism. Negative margin at Small/Medium = tier-design bug (surfaced at tier level, not per-subscriber). Only Large-tier power users warrant per-subscriber triage.

---

## Phase 5 sizing

Three sessions, sequenced. Sessions A and B are partially parallelisable; C depends on B.

- **A** (Medium-large) — Logging primitives + registry + every vendor SDK wrapper + FOUNDATIONS patch + `sendEmail()` classification parameter + deploy webhook.
- **B** (Medium) — Three detectors + anomaly dedupe + diagnosis Opus prompt + Cockpit banner wiring + severe-tier email dispatch + kill-switch plumbing + prompt-version-hash tracking.
- **C** (Medium) — Observatory dashboard + anomaly detail + job detail + settings + projection tile + tier-health panel + per-subscriber recommendation cards (Large tier) + weekly digest.

---

## No changes to

- Motion registry (no new slots).
- Sound registry (no new slots).
- Non-new scheduled-tasks `task_type` enum values from this spec (detector workers run as their own scheduled tasks — add `cost_anomaly_detector_hard`, `cost_anomaly_detector_rate`, `cost_anomaly_detector_learned`, `cost_anomaly_diagnose`, `weekly_digest_send` — 5 new task types).

Wait, that's a correction — this spec **does** add 5 new `task_type` values to the scheduled-tasks infrastructure. Flagging for Phase 3.5 alongside the existing Quote Builder / Branded Invoicing / Context Engine / Client Management / SaaS / Content Engine additions. Total after this spec: existing + 5 = verify count in Phase 3.5.

---

## What the next session should know

**Recommended next spec: `docs/specs/setup-wizards.md`.**

Cost & Usage Observatory's sequencing note said it should land before Setup Wizards so the integration wizards can embed observability plumbing in their setup flow. With Observatory now locked, Setup Wizards can be specced with full knowledge of what actor-attribution, band registration, and cost-logging each integration needs to wire up.

After Setup Wizards: Finance Dashboard, then Hiring Pipeline to close Phase 3. Then Phase 3.5 review.

---

## Open questions / honest reality check

- **Band miscalibration during weeks 1–8 is a real risk.** Alert fatigue is the failure mode. Mitigation is aggressive — one-click band editor on every anomaly, tuning history auditable in `activity_log`. Expect active band-tuning work the first two months of production.
- **Call-site discipline is the single biggest operational risk.** If any vendor SDK gets imported directly by feature code, that call silently bypasses the observatory. ESLint rule + Phase 5 Session A sweep + Phase 3.5 spec review are the three lines of defence; all must hold.
- **The diagnosis prompt needs real calibration.** Claude can hallucinate a plausible-sounding wrong diagnosis. Confidence badge + raw-data escape hatch + calibration against 8–10 synthetic scenarios in the content mini-session are the mitigations. If calibration reveals the prompt is unreliable, the whole diagnosis feature degrades to "list of recent calls + deploy timeline" — still useful, less magical.
- **Phase 3.5 load is non-trivial.** This spec mandates review of 14+ other specs for actor attribution at call sites. Phase 3.5 sizing explicitly accounts for it.
