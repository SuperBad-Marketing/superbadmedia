# `lg-9` — Sequence engine + follow-up scheduling + engagement tier evaluator — Handoff

**Closed:** 2026-04-18
**Wave:** 13 — Lead Generation (9 of 10)
**Model tier:** Sonnet (as recommended — standard build session)

---

## What was built

### 1. Sequence engine (`lib/lead-gen/sequence-engine.ts`)

The core orchestrator for processing active sequences. Implements:

- **`runSequenceScheduler()`** — finds active sequences with `next_touch_due_at ≤ now`, enforces warmup cap → quiet window → DNC gates, generates follow-up drafts via `generateDraft()`, and routes through autonomy (auto-send for graduated/probation tracks, hold for manual in manual mode).
- **`executeSend()`** — the actual send path for approved/auto-send drafts. Creates `outreach_sends` row, updates sequence state (`touches_sent`, `last_touch_at`, `next_touch_due_at`), records warmup send, promotes candidate to deal on first send via `createDealFromLead()`, and fires autonomy events.
- **`getNextTouchDueMs()`** — cadence calculator per §11.3: 4 days (touch 2), 7 days (touch 3), 10 days (touch 4+).

**Auto-send delay:** uses `AUTO_SEND_DELAY_MS` (15 min) from LG-8 when scheduling auto-send tasks. Closes `lg_8_auto_send_delay_enforcement` patch.

**Autonomy event wiring:** fires `probation_send_completed` and `auto_send_completed` after successful sends. Closes `lg_8_auto_send_probation_send_completed` patch.

**Deal promotion (§13.1):** on first-touch send, calls `createDealFromLead()` to promote candidate to a deal. Updates `promoted_to_deal_id` and `promoted_at` on the candidate, and back-fills `deal_id` on the sequence and draft.

**Unsubscribe compliance:** every send includes visible footer link + `List-Unsubscribe` + `List-Unsubscribe-Post` headers per §12.3 / RFC 8058.

### 2. Engagement tier evaluator (`lib/lead-gen/engagement-evaluator.ts`)

- **`classifyEngagementTier()`** — pure function implementing the 4-tier model per §11.1: click (1) > full open (2) > sub-60s open (3) > none (4). Click always trumps opens. Multiple opens = tier 2 regardless of dwell.
- **`evaluateEngagementTiers()`** — finds all `outreach_sends` past the 24h cooloff window with no `engagement_tier` set, classifies them, updates the send row, rolls the sequence cutoff counter (non-engagement = +1, engagement = reset to 0), stops sequences at the cutoff threshold, and triggers reactive rescoring via `rescoreCandidate()`.

**Reactive scoring wiring (§16.8):** after computing engagement tiers, calls `rescoreCandidate()` on the candidate. Updates candidate scores, handles track changes (updating `outreach_sequences.track`), and logs all rescore/track-change/below-floor events to activity log.

### 3. Scheduled task handlers (`lib/scheduled-tasks/handlers/lead-gen-sequence.ts`)

Three handlers registered in `HANDLER_REGISTRY`:
- **`sequence_scheduler`** — self-perpetuating at 30-minute intervals. Calls `runSequenceScheduler()`.
- **`engagement_tier_evaluator`** — self-perpetuating at 1-hour intervals. Calls `evaluateEngagementTiers()`.
- **`auto_send_execute`** — one-shot, triggered by the sequence engine after the 15-minute delay. Reads payload `{ draft_id, sequence_id, candidate_id, autonomy_mode }` and calls `executeSend()`.

### 4. Barrel exports

`lib/lead-gen/index.ts` exports: `runSequenceScheduler`, `executeSend`, `getNextTouchDueMs`, `SequenceRunResult`, `SendDraftResult`, `evaluateEngagementTiers`, `classifyEngagementTier`, `EvaluateEngagementResult`, `EngagementTier`.

## Files created

- `lib/lead-gen/sequence-engine.ts`
- `lib/lead-gen/engagement-evaluator.ts`
- `lib/scheduled-tasks/handlers/lead-gen-sequence.ts`
- `tests/lead-gen/lg9-sequence-engine.test.ts`

## Files edited

- `lib/lead-gen/index.ts` — LG-9 barrel exports
- `lib/scheduled-tasks/handlers/index.ts` — registered `LEAD_GEN_SEQUENCE_HANDLERS`
- `tests/lead-gen/lg1-dnc.test.ts` — added `@/lib/channels/email/send` mock to prevent Resend constructor error on barrel import

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Sequence scheduler runs every 30 minutes, engagement evaluator every hour.** Both self-perpetuate via `enqueueTask()` with idempotency keys. Cadence is generous enough to avoid stampedes while keeping follow-ups timely.

2. **Auto-send uses the scheduled_tasks system.** When autonomy mode is `probation` or `auto_send`, the sequence engine enqueues an `auto_send_execute` task with the 15-minute delay from `AUTO_SEND_DELAY_MS`. This gives Andy a cancel window — rejecting the draft before the task fires prevents the send.

3. **Reactive rescore wired at engagement evaluation, not at send.** The spec says rescore fires "after computing/updating an engagement tier" (§16.8). The evaluator handles this — every tier classification triggers a rescore on the candidate.

4. **Prior touches for follow-up context pulled from sent drafts.** The sequence engine gathers all `outreach_sends` for the sequence, resolves their draft content, and passes as `priorTouches` to the draft generator for thread-aware follow-ups.

5. **DNC-blocked sequences transition to stopped_unsubscribe or stopped_bounce.** Matches the spec's terminal states in §11.4.

## Verification (G0–G12)

- **G0** — LG-8 and LG-7 handoffs read. Spec §11.1–§11.4, §13.1, §16.8 read.
- **G1** — Preconditions verified: `outreachSequences` schema, `outreachSends` schema, `outreachDrafts` schema, `leadCandidates` schema, `enforceWarmupCap`, `recordWarmupSend`, `isWithinQuietWindow`, `isBlockedFromOutreach`, `generateDraft`, `sendEmail`, `createDealFromLead`, `getAutonomyRow`, `transitionAutonomyState`, `AUTO_SEND_DELAY_MS`, `enqueueTask`, `logActivity`, `rescoreCandidate`, `SAAS_FLOOR`, `RETAINER_FLOOR` — all present.
- **G2** — Files match LG-9 scope (sequence engine + engagement evaluator + scheduled handlers + tests).
- **G3** — No motion work in this session.
- **G4** — No numeric/string literals in autonomy-sensitive paths. Cadence values are module-level constants. `AUTO_SEND_DELAY_MS` imported from LG-8. Thresholds read from autonomy state row.
- **G5** — Context budget held. Medium session.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 191 test files / 1617 passed + 1 skipped (+15 new), clean test run.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1617 passed.
- **G9** — Library-only session, no UI pages. No dev server check needed.
- **G10** — 15 tests: cadence 4d/7d/10d, kill switch skips scheduler, tier 1 click, tier 2 full open, tier 2 multiple opens, tier 3 sub-60s, tier 3 null dwell, tier 4 none, click trumps opens, handler export shape, handler registry integration, barrel exports, AUTO_SEND_DELAY_MS value.
- **G10.5** — N/A (standard build session).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (closed this session)

- **`lg_8_auto_send_delay_enforcement`** — `AUTO_SEND_DELAY_MS` used by the sequence engine when scheduling auto-send tasks.
- **`lg_8_auto_send_probation_send_completed`** — `probation_send_completed` and `auto_send_completed` events fired from `executeSend()` after successful sends.

## PATCHES_OWED (raised this session)

- **`lg_9_circuit_breaker_from_webhooks`** — The engagement evaluator handles tier-based cutoff, but circuit breaker events (`hard_bounce`, `spam_complaint`, `fast_unsubscribe`) still need to be fired from Resend webhook handlers. The webhook handler (SP-8 or wherever engagement signal processing lands) must call `transitionAutonomyState()` with the appropriate event. Inherits from `lg_8_circuit_breaker_webhook_wiring`.
- **`lg_9_reply_classification_rescore`** — Reactive scoring currently rescores on engagement tier only. Reply-classification-triggered rescoring needs the reply-intelligence classifier (§13.0) to be built. The evaluator has the plumbing; the call site just needs to invoke `rescoreCandidate()` after a reply is classified.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Sequence engine module
- Engagement tier evaluator module
- Scheduled task handlers (sequence_scheduler, engagement_tier_evaluator, auto_send_execute)
- Barrel export additions
- Test files

## What the next session (LG-10) inherits

LG-10 is the final Lead Gen session. LG-9 provides:

- **`runSequenceScheduler()`** — the full follow-up pipeline, ready to be triggered by scheduled tasks.
- **`evaluateEngagementTiers()`** — tier classification + cutoff + rescore wiring.
- **`executeSend()`** — the approved/auto-send execution path, including deal promotion and autonomy events.
- **Three scheduled task handlers** — registered and ready for the worker to dispatch.
- **Cadence logic** — `getNextTouchDueMs()` for computing when the next touch is due.
