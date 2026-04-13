# Phase 3.5 Step 11 — Stage 4 handoff

**Date:** 2026-04-13
**Phase:** 3.5 — Spec Review (exit gate), Step 11 (end-to-end flow walkthrough)
**Stage:** 4 of 4 — Retainer conversion + F1.a closure (portal-guard primitive + magic-link-in-every-email)

## Scope of Stage 4

Walked the retainer conversion arc: Quote accepted → Stripe Checkout → first retainer charge → portal migration → Brand DNA gate → bartender-led kickoff → onboarding entry-path branch. Folded in F1.a closure (portal-guard recovery flow + magic-link-in-every-email, deferred from Stage 1). Four frictions resolved inline.

## Flags resolved

### F4.a — First retainer payment arrives before Andy's finished refresh-review

**Resolution: Option A — payment queues Week 1 activation until refresh-review publishes.** Stripe retainer-payment webhook branches on `active_strategy.status`: if `live`, Week 1 fires immediately; if `pending_refresh_review`, the handler stamps `six_week_plans.retainer_payment_received_at` and logs `six_week_plan_retainer_payment_queued_pending_refresh_review`. Cockpit banner renders amber, escalates to red at `settings.get('plan.refresh_review_block_escalation_hours')` (default 24h). On refresh-review publish, Week 1 fires retroactively in the same transaction — band clears, tracker activates, label flips. Client-side band copy shifts from pre-payment ("Andy's doing a pass on this for the retainer — live version lands when your first payment fires.") to post-payment ("Kicking off Week 1 shortly — Andy's finalising the refreshed plan.").

Rationale: preserves F3.e's `active_strategy`-as-canonical lock (no firing Week 1 against a stale plan), keeps client's commitment moment frictionless, puts the operational pressure on Andy's cockpit where it belongs.

APPLIED INLINE:
- `docs/specs/six-week-plan-generator.md` §8.3 — full rewrite (branching handler, retroactive fire, band-copy shift).
- `docs/specs/six-week-plan-generator.md` §9 + `docs/settings-registry.md` — new `plan.refresh_review_block_escalation_hours` key (default 24). Plan count 9 → 10.
- `docs/specs/six-week-plan-generator.md` §10.1 — new `retainer_payment_received_at` column on `six_week_plans`.
- `docs/specs/six-week-plan-generator.md` §10.3 — two new activity_log kinds (`..._queued_pending_refresh_review`, `..._week_1_activated` with `trigger` enum payload).
- `docs/specs/six-week-plan-generator.md` §12.2 + `docs/specs/daily-cockpit.md` §399 — richer `getHealthBanners()` payload (`{ plan_id, client_id, payment_received_at, hours_since_payment, escalation_threshold_hours, severity: 'amber'|'red' }`).
- `docs/specs/six-week-plan-generator.md` §17 — pending-refresh-review band copy extended with pre-payment + post-payment variants.

### F4.b — First retainer-mode login experience (Brand DNA gate-first, bartender-led kickoff on gate-clear)

**Resolution: Andy's direct call (override of my recommended Option A).** On first retainer-mode login, if Brand DNA is incomplete, the portal is **hard-locked** to the Brand DNA Assessment flow (per `docs/specs/brand-dna-assessment.md` §10.6 portal gate). All other retainer surfaces render as blurred/outlined previews. On Brand DNA completion (either just-now on this login, or pre-conversion during the pre-retainer wait period per `project_brand_dna_after_trial_shoot` memory), the portal unlocks and the three-step first-visit tour is **suppressed** for retainer-converters. A retainer-kickoff-variant bartender opening line fires once (stamped by new `contacts.retainer_kickoff_bartender_said_at`), surfacing first-shoot scheduling as the single primary next action with an "once your first invoice clears" modifier when applicable.

This resolution also folds in what had been the separate anticipated F4.c (Brand DNA unlock timing): optional pre-retainer, hard-gated at first retainer login.

APPLIED INLINE:
- `docs/specs/client-management.md` §10 — new "Retainer kickoff transition" paragraph after the three-mode table (gate + bartender kickoff, motion on gate-clear, activity log entries).
- `docs/specs/client-management.md` §15.2 — new `contacts.retainer_kickoff_bartender_said_at` column.
- `docs/specs/client-management.md` §15.5 — 2 new activity_log kinds (`retainer_mode_brand_dna_gate_entered`, `retainer_kickoff_bartender_message_sent` with `gate_bypassed_pre_retainer` payload). Count 8 → 10.
- `docs/specs/client-management.md` §18 — content mini-session item for the kickoff-variant bartender line (prompt at `lib/ai/prompts/portal-bartender-opening.ts`, kickoff-variant branch).

LOGGED (no change needed):
- `docs/specs/brand-dna-assessment.md` §10.6 + §11.1 — existing Portal gate + First-Login Brand DNA Gate specs already cover the hard-lock behaviour. No patch owed.
- `docs/specs/six-week-plan-generator.md` §19 out-of-scope — existing line "Plan generation for direct/referral/legacy onboarding entries" confirms the Brand DNA gate is the only onboarding artefact required on retainer entry regardless of path.

### F4.c — Onboarding welcome screen branch by entry path

**Resolution: Option B — branch.** Trial-shoot graduates (an `intro_funnel_submissions` row exists) bypass Onboarding §8.1 welcome screen entirely; their retainer transition is fully carried by F4.b (gate → bartender kickoff). Direct/referral entrants (no `intro_funnel_submissions` row) route through §8.1 welcome screen first ("what we already know about you" summary, step preview, CTA into Brand DNA), then converge on the same Brand DNA gate + kickoff sequence. The §8.1 summary prompt reads direct/referral context sources only (deal notes, quote context, outreach research) — not trial-shoot artefacts (shoot-day notes, six-week plan, reflection), because trial-shoot graduates never reach that surface.

Rationale: trial-shoot graduates have been continuously in the portal for weeks; a fresh welcome interstitial breaks `feedback_felt_experience_wins`. Direct/referral clients are discontinuous — §8.1 is precisely designed for their arrival moment.

APPLIED INLINE:
- `docs/specs/onboarding-and-segmentation.md` §8.1 — entry-path branch block (detection, trial-shoot bypass, direct/referral render path); content now explicitly scopes the "what we already know" prompt to direct/referral inputs; new one-shot column.
- `docs/specs/onboarding-and-segmentation.md` §9.1 — new `contacts.onboarding_welcome_seen_at` column.
- `docs/specs/client-management.md` §10 Retainer kickoff transition paragraph — extended with entry-path branch lock (direct/referral route via §8.1 first; trial-shoot graduates land directly on the gate).

### F1.a closure — Portal session durability to a paid surface

Deferred from Stage 1 (shape locked Option A: session cookie primary + recovery form + magic link in every journey-beat email). Applied inline at Stage 4 closure per the original gate in PATCHES_OWED.

APPLIED INLINE:
- `docs/specs/intro-funnel.md` §10.1 — new dedicated block for portal-guard primitive contract, recovery-form UX, magic-link-in-every-email rule with explicit send-point list (§11.4 / §12.3 / §12.4 / §12.5 / §13.1 / §15 / §17.x), token lifecycle defaults, new `portal_magic_links` table, new activity_log kinds, out-of-scope items.
- `docs/specs/client-management.md` §10.1 — new bullet naming the `portal-guard` primitive + contract reference to Intro Funnel §10.1 + retainer-mode journey-email OTT embedding.
- `docs/settings-registry.md` — 2 new Portal keys (`portal.magic_link_ttl_hours` 168, `portal.session_cookie_ttl_days` 90). Portal count 3 → 5.

LOGGED (gated):
- `FOUNDATIONS.md` §11 — `portal-guard` primitive formal definition + code landing (gate: Phase 4 foundation session).
- `FOUNDATIONS.md` §11.2 — new classification `portal_magic_link_recovery` (gate: Phase 5 Session A).
- `docs/specs/intro-funnel.md` §4.1 data model — `portal_magic_links` table formal placement; Phase 4 foundation generalises with nullable `submission_id` + new `client_id` for Client Management reuse.

All four PATCHES_OWED rows for F1.a resolved (two struck through as APPLIED inline; Foundations rows remain gated and re-filed under their phase gates).

## Settings registry status

- Plan: 10 (was 9; +1 for `plan.refresh_review_block_escalation_hours`).
- Portal: 5 (was 3; +2 for `portal.magic_link_ttl_hours` + `portal.session_cookie_ttl_days`).
- **Total: 60 keys at v1.0 seed** (was 57).

## New cross-spec contracts introduced in Stage 4

- `six_week_plans.retainer_payment_received_at` (Six-Week Plan Generator §10.1) — consumed by cockpit banner severity calc + refresh-review publish retroactive-fire logic.
- `contacts.retainer_kickoff_bartender_said_at` + `contacts.onboarding_welcome_seen_at` (Client Management §15.2 / Onboarding §9.1) — one-shot stamps for retainer-entry surfaces.
- `portal_magic_links` table (Intro Funnel §10.1 / §4.1 patch-owed) — shared primitive; Phase 4 generalises for Client Management reuse.
- `portal-guard` primitive (FOUNDATIONS §11 — gate) — contract authoritative in Intro Funnel §10.1.
- `getHealthBanners()` `six_week_plan_retainer_payment_without_refresh_review` kind — payload shape extended with severity + escalation threshold.

## What Batch C needs to know

**Batch C scope** — steps 8 (glossary pass), 9 (LLM job inventory vs model registry), 12 (GHL cutover ack), 13 (legal/compliance sweep), 15 (success metrics per spec).

**Carry-forwards from Stage 4:**
- **Step 8 glossary pass** — must canonicalise `stripe.Customer` ≠ **Client** (per Stage 2 F1.c lock) AND confirm "trial-shoot graduate" vs "direct/referral entrant" terminology is consistent across Onboarding + Client Management + Intro Funnel (now that F4.c has introduced the detection condition).
- **Step 9 LLM job inventory** — new prompt owed: `lib/ai/prompts/portal-bartender-opening.ts` kickoff-variant branch (Client Management §18 content mini-session). Add to Observatory registered-jobs list.
- **Step 15 success metrics** — consider adding retainer-transition metrics (time-from-Won-to-Brand-DNA-complete, % trial-shoot graduates who bypass §8.1 cleanly, % of first retainer payments that queue vs. fire immediately).

**Stop 14 (motion token audit)** — new Tier-1/Tier-2 candidates surfaced in Stage 4:
- Gate-clear → unlocked portal transition (Client Management §10 Retainer kickoff) — nav items + blurred sections fade in under house spring. Likely Tier-1 inheritance, no new token needed.
- Cockpit banner amber → red escalation transition (six_week_plan §12.2) — likely Tier-1 inheritance.

**Stop 16 (exit approval)** — all 4 Step 11 stages complete. Phase 3.5 exit gate approval pending from Andy.

## Carry-forward content mini-session items

Added or extended in Stage 4:
- Client Management §18 — retainer-kickoff-variant bartender opener (new).
- Six-Week Plan Generator §17 — pending-refresh-review band pre-payment + post-payment variants (F4.a extension).
- Onboarding §8.1 — direct/referral "what we already know" summary prompt (existing, now scoped explicitly to direct/referral context sources).

## Auto-commit

Clean stopping point — Stage 4 complete, handoff written, SESSION_TRACKER Next Action update pending, no half-finished work. Commit authorised per CLAUDE.md auto-commit rule.
