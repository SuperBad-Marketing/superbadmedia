# Phase 3.5 Step 11 — Stage 3 handoff

**Date:** 2026-04-13
**Phase:** 3.5 — Spec Review (exit gate), Step 11 (end-to-end flow walkthrough)
**Stage:** 3 of 4 — Six-Week Plan flow (post-approval portal receipt → PDF takeaway → revision → 60-day lifecycle → retainer migration)

## Scope of Stage 3

Walked the Six-Week Plan's prospect-side arc and retainer migration: first-visit-after-bundle portal arrival → plan-page render → PDF takeaway stance → revision flow + prospect-side reply experience → day-60 wind-down → Deal → Won migration + refresh-review + Week 1 activation. Six friction flags surfaced and resolved.

## Flags resolved

### F3.a — First-visit-after-bundle deliverables hub

**Resolution: Option A — one-shot deliverables hub as portal home override for first visit after bundled `deliverables_ready`. Tiles: gallery + plan, equal weight, Tier-2 `motion:bundle_reveal`. Dismisses to the chosen tile; subsequent visits land on standard chat-home. Sticky server-side via `intro_funnel_submissions.bundled_hub_seen_at`.**

Reconciled against existing Client Management §10.2 chat-home-first philosophy: hub is a pre-chat-home override, not a replacement. Chat-first remains canonical after the bundled moment passes.

APPLIED INLINE:
- `docs/specs/client-management.md` §10.2 + §10.2.1 (new: bundled hub) + §10.2.2 (renamed: standard portal home / chat).
- `docs/specs/intro-funnel.md` §4.1 — `bundled_hub_seen_at` column on `intro_funnel_submissions`.
- `docs/specs/intro-funnel.md` §15.1 — hub handoff block (bundled email → `/portal/[token]` → hub → chat-home after dismiss).
- `docs/specs/intro-funnel.md` §24 — hub copy item in content mini-session.
- `docs/specs/six-week-plan-generator.md` §6.1 — plan page is not first-visit entry; hub precedes.
- `docs/specs/six-week-plan-generator.md` §6.6 + §13.4 — `motion:plan_reveal` rescoped to plan-section-only; `motion:bundle_reveal` added as new Tier-2 candidate owned by Client Management.

LOGGED (gated):
- Client Management content mini-session — bartender post-hub opening-line direction.
- design-system-baseline revisit — Tier-2 `motion:bundle_reveal` registration.
- Daily Cockpit — optional `intro_funnel_hub_seen { picked: 'gallery' | 'plan' }` quiet entry (low priority).

### F3.b — PDF as brand-forward take-away artefact (override of my recommendation)

**Resolution: Option B — brand-forward, marketing-collateral weight.** Filename `SuperBad-Six-Week-Plan-[business-slug]-[YYYY-MM-DD].pdf`, full-bleed cover page, per-page footer (mark + page number), closing sign-off spread with sprinkle in larger type, branded render overlay on first download, supersede-prompt modal when prospect holds a lower `generation_version`, day-60 email attachment always fresh-rendered.

My initial recommendation (Option A — quiet, `your-plan.pdf`, no cover) cited `feedback_individual_feel` + `feedback_felt_experience_wins`. Andy overrode: take-away artefacts that leave the platform earn brand-forward presentation (90%+ of prospects don't convert — PDF is their only persistent artefact + functions as social proof when shared).

Saved new feedback memory: `feedback_takeaway_artefacts_brand_forward.md` — in-platform stays individual; artefacts crossing the platform wall are SuperBad-marked.

APPLIED INLINE:
- `docs/specs/six-week-plan-generator.md` §6.5 — full PDF stance rewrite.
- `docs/specs/six-week-plan-generator.md` §13.3 — sprinkle placement moved to closing sign-off page, single occurrence.
- `docs/specs/six-week-plan-generator.md` §10.3 — `six_week_plan_pdf_downloaded` carries `{ plan_id, generation_version }` payload.
- `docs/specs/six-week-plan-generator.md` §17 — PDF layout direction content item.

LOGGED (gated):
- `docs/specs/surprise-and-delight.md` — update sprinkle bank row for closing-page placement.
- `docs/specs/design-system-baseline.md` revisit — `motion:pdf_render_overlay` as Tier-1 token.
- `docs/specs/client-management.md` §10.3 bartender safe actions — "surface the PDF download" extension.
- `BUILD_PLAN.md` Phase 5 — Puppeteer precondition ordering confirmed.

### F3.c — Revision-resolution prospect-side UX

**Resolution: Option A — email-first delivery + quiet dismissible portal inline card.** Regenerate path fires `six_week_plan_revision_regenerated` email on new-plan approval + inline card pointing to the revised plan. Explain and hand-reject paths share a single Haiku-drafted review screen with send-before-review lock; fire `six_week_plan_revision_explained` email (Andy's reply IS the body) + inline card that expands to show the reply text. Bartender reads revision resolution as chat context.

APPLIED INLINE:
- `docs/specs/six-week-plan-generator.md` §7.2 — Andy's three actions clarified, review-before-send lock on all paths.
- `docs/specs/six-week-plan-generator.md` §7.3 (new) — prospect-side notification arc.
- `docs/specs/six-week-plan-generator.md` §7.4 + §7.5 (renumbered) — one-revision enforcement retained; activity log clarified.
- `docs/specs/six-week-plan-generator.md` §10.1 — `revision_reply_sent_at`, `revision_reply_body`, `revision_reply_dismissed_at` columns.
- `docs/specs/six-week-plan-generator.md` §10.5 — `six_week_plan_revision_resolved` split into `_regenerated` + `_explained`.
- `docs/specs/six-week-plan-generator.md` §6.1 — revision reply inline card UI state (two variants).
- `docs/specs/six-week-plan-generator.md` §17 — inline card copy + revision email bodies.

LOGGED (gated):
- `FOUNDATIONS.md` §11.2 — replace `six_week_plan_revision_resolved` with the two new classifications.
- `docs/specs/client-management.md` §10.3 — bartender safe-action extension for surfacing revision reply.
- `docs/specs/daily-cockpit.md` — acknowledge `six_week_plan_revision_request` source kind.
- `lib/ai/prompts/six-week-plan-revision-reply.ts` content authoring.

### F3.d — Day-60 wind-down: two-beat expiry with soft CTA (override of my recommendation)

**Resolution: Option C — warm sign-off with soft retainer CTA.** Two scheduled beats: day-53 expiry email (PDF attached, `mailto:` soft CTA with subject prefill `"Coming back about my plan — {business_name}"`, warm proportional tone — no pitch, no form) + day-60 archive-only job. New `plan.expiry_email_days_before_archive` settings key (default 7).

My initial recommendation (Option A — no CTA on the archive email) cited `feedback_primary_action_focus`. Andy overrode: that memory is about mid-arc clutter; transition moments (wind-down, archive, lights-out) warrant a proportional CTA earned by time.

Saved new feedback memory: `feedback_earned_ctas_at_transition_moments.md` — primary-action focus bans clutter mid-arc, NOT soft CTAs at closing beats where the prospect has already received the value they paid for.

APPLIED INLINE:
- `docs/specs/six-week-plan-generator.md` §8.4 — full non-converter expiry rewrite (two-beat schedule, body structure, signposting).
- `docs/specs/six-week-plan-generator.md` §9 — `plan.expiry_email_days_before_archive` key.
- `docs/specs/six-week-plan-generator.md` §10.1 — `portal_expiry_email_sent_at` column.
- `docs/specs/six-week-plan-generator.md` §10.3 — `six_week_plan_expiry_email_sent` activity_log entry.
- `docs/specs/six-week-plan-generator.md` §10.4 — scheduled_tasks split (new `six_week_plan_expiry_email` day-53 sender; `six_week_plan_non_converter_expiry` reduced to archive-only).
- `docs/specs/six-week-plan-generator.md` §17 — expiry email body + archived-portal microcopy items.
- `docs/settings-registry.md` — key added; Plan total 8 → 9; overall 56 → 57.

LOGGED (gated):
- `FOUNDATIONS.md` §11.2 — add `six_week_plan_expiry_email` classification; confirm/retire `six_week_plan_non_converter_expiry`.
- `docs/specs/daily-cockpit.md` — optional "wind-down sent" pipeline-panel signal.
- `docs/specs/client-management.md` §10 — confirm archived mode exposes PDF re-download + soft mailto.

### F3.e — Plan view during retainer migration window

**Resolution: Option A — single surface, evolving source.** `/portal/[token]/plan` is the one plan surface across lifecycle. Read-source evolves: `six_week_plans` pre-retainer → Client Context `active_strategy` on Won. During `pending_refresh_review` window, quiet band renders above intro ("Andy's doing a pass on this before we kick off — live version lands on first payment"); "Start Week 1" suppressed (activation is now first retainer payment). Label stays "Your plan" through pending window; flips to "Your strategy" on live + first payment.

Matches `feedback_felt_experience_wins` — prospect POV stays "my plan" full stop; migration is an implementation detail.

APPLIED INLINE:
- `docs/specs/six-week-plan-generator.md` §6 intro — "Single surface, evolving source" lock block.
- `docs/specs/six-week-plan-generator.md` §8.1 — step 5: portal read-source swap on Won.
- `docs/specs/six-week-plan-generator.md` §8.3 — Week 1 trigger clears band, activates tracker, flips label.
- `docs/specs/six-week-plan-generator.md` §17 — pending-refresh-review band copy item.

LOGGED (gated):
- `docs/specs/client-management.md` §10 retainer mode — lock: retainer mode does NOT add its own strategy surface; consumes this spec's `/portal/[token]/plan`.
- `docs/specs/client-context-engine.md` — confirm `active_strategy` carries `status` enum (`pending_refresh_review` | `live`).

### F3.f — Daily Cockpit contract verification (silent cleanup)

Mechanical cross-spec alignment, no product question.

APPLIED INLINE:
- `docs/specs/six-week-plan-generator.md` §12.2 — fixed "3 new source kinds" → "4" (count mismatch with list).
- `docs/specs/daily-cockpit.md` §363 — added Six-Week Plan Generator to the `getWaitingItems()` spec roster with 4 emitted kinds named inline.
- `docs/specs/daily-cockpit.md` §398 — added Six-Week Plan Generator to the banner-contributing spec roster with `six_week_plan_retainer_payment_without_refresh_review` named inline.

## New feedback memories saved

- `feedback_takeaway_artefacts_brand_forward.md` — exports/PDFs leaving the platform earn brand-forward presentation; in-platform stays individual.
- `feedback_earned_ctas_at_transition_moments.md` — soft proportional CTAs at wind-down/archive/lights-out are earned by time; `feedback_primary_action_focus` is about mid-arc clutter, not closing beats.

Both pointers added to `MEMORY.md`.

## What Stage 4 needs to know

**Stage 4 scope** — retainer conversion: Quote Builder handoff → Stripe Checkout (reusing Stripe Customer from F1.c lock) → Client Management portal migration from pre-retainer → retainer mode → Onboarding + Brand DNA unlock sequencing. **Stage 4 closure also folds in F1.a** portal-guard primitive + magic-link-in-every-email patches (whole-arc concerns deferred from Stage 1).

**Anticipated frictions for Stage 4 (from Stage 3 resolutions + carry-forwards):**
- **Quote-to-Checkout handoff** — quote approved → Stripe Checkout session → first retainer charge → webhook fires `six_week_plan_retainer_week_1_start` (per F3.e resolution). Verify the sequence has no ordering gap: what if webhook fires before Andy has done refresh-review? (Spec says high-priority cockpit alert — confirm content + UX.)
- **Portal mode transition UX** — the instant Deal → Won fires, portal flips from pre-retainer → retainer mode. F3.e already locked the plan surface (stays at `/portal/[token]/plan`, evolves source). Stage 4 must confirm the OTHER retainer-mode surfaces don't create duplicate-view issues (gallery page, invoices, bookings, etc.) and that the `bundled_hub_seen_at` state doesn't re-fire the F3.a hub on retainer mode.
- **Brand DNA unlock timing** — at Deal Won? First payment? First onboarding login? Per `project_brand_dna_after_trial_shoot` memory, consider unlocking during deliverable wait period (pre-conversion); for converters, Brand DNA is already a hard requirement via First-Login Brand DNA Gate (F2.b). Confirm the gate doesn't lock Andy's admin surfaces vs. the client's Brand DNA profile on first retainer login.
- **Onboarding flow branching** — `feedback_onboarding_multiple_entry_paths` memory: trial-shoot graduate vs. direct/referral entry paths converge on same output. Stage 4 must confirm both paths work without code fork.
- **F1.a closure** — portal session durability + magic-link-in-every-email, deferred from Stage 1. Portal guard primitive spec location + token lifecycle.

**Carry-forward hygiene:**
- Stage 3 changes to Intro Funnel / Six-Week Plan / Client Management should not require Stage 4 rework. Stage 4 should treat F3.a (hub), F3.b (PDF), F3.c (revision reply), F3.d (day-60 two-beat), F3.e (single plan surface) as locked.
- Settings registry now at 57 keys (Plan: 9, bumped from 8).
- `getWaitingItems()` roster now includes Six-Week Plan Generator with 4 emitted kinds + 1 banner kind.

**Carry-forward content mini-session items** (Six-Week Plan Generator §17 now):
- Stage 1 + Stage 2 + self-review prompts (original).
- Revision-reply Haiku prompt (original + F3.c tightened).
- Portal copy — intro, "Start Week 1", revision modal (original).
- Revision reply inline card copy (F3.c).
- Revision-resolution email bodies (F3.c).
- Non-converter expiry email body (F3.d).
- Archived-portal microcopy (F3.d).
- Pending-refresh-review band copy (F3.e).
- PDF layout direction (F3.b).
- Browser tab title rotation pool + review-UI microcopy (original).

## Stop gates remaining in Step 11

- **Stage 4** — Hiring pipeline end-to-end. Not yet started.
- **Batch C** (steps 12, 13, 15) — to follow after Stage 4.
- **Stop 14** (motion token audit) + **Stop 16** (final exit-gate sign-off) — end of Phase 3.5.

## Auto-commit

Clean stopping point — Stage 3 complete, handoff written, SESSION_TRACKER Next Action updated. Commit authorised by CLAUDE.md `auto-commit at the end of every clean stopping point` rule.
