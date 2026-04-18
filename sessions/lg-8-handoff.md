# `lg-8` — Autonomy graduation state machine + circuit breakers — Handoff

**Closed:** 2026-04-18
**Wave:** 13 — Lead Generation (8 of 10)
**Model tier:** Sonnet (as recommended — standard build session)

---

## What was built

### 1. Autonomy state machine (`lib/lead-gen/autonomy.ts`)

The core `transitionAutonomyState(track, event)` function per §12.F — the ONLY write path for `autonomy_state`. Implements the full 4-state machine:

- **`manual`** (default) — streak counter tracks consecutive clean approvals. Transitions to `probation` when `clean_approval_streak >= graduation_threshold` (default 10).
- **`probation`** — unlocked after graduation. Counts down `probation_sends_remaining` (default 5). Transitions to `auto_send` when all probation sends complete without intervention.
- **`auto_send`** — full autonomy. Maintenance standard enforced on rolling 20-send window at 80% clean approval floor. Below floor demotes to `manual`.
- **`circuit_broken`** — enters on hard bounce, spam complaint, fast unsubscribe (within 60s), or drift flag on auto-send draft. Demotes to `manual` with streak reset.

**Events handled:** `clean_approval`, `non_clean_approval`, `rejection`, `hard_bounce`, `spam_complaint`, `fast_unsubscribe`, `drift_flag_on_auto_send`, `probation_send_completed`, `auto_send_completed`.

**Clean vs non-clean approval logic:** `manual` approval with no nudges = clean (increments streak). Nudged or edited = non-clean (resets streak to zero if > 0).

**Maintenance floor check:** queries last N sends in the track (N = `rolling_window_size`), counts clean approvals, compares to `maintenance_floor_pct`. Returns true (passes) if window isn't full yet.

**`AUTO_SEND_DELAY_MS`** — exported constant (15 minutes) for the sequence runner to enforce per §12.H.

### 2. Autonomy state view query (`getAutonomyStates()`)

Returns all `autonomy_state` rows mapped to `AutonomyStateView` shape for UI consumption.

### 3. Metrics panel — autonomy streak cards (wired)

Replaced the LG-7 placeholder `AutonomyStreak` component with real data. Shows per-track cards with:
- Mode label (manual / probation / auto-send / circuit broken)
- Progress indicators: streak/threshold in manual, probation countdown in probation, rolling window stats in auto-send, reason in circuit broken
- Colour-coded borders: green for auto-send, red for circuit broken

### 4. Queue header — per-track autonomy lines (§9.4)

Added per-track autonomy state summaries to the queue header. Shows mode + progress context per track (matching the spec's §9.4 layout: `SaaS: auto-send · 3/5 probation · 17 sends rolling 95% clean`).

### 5. Approve/reject actions — autonomy wiring

- `approveDraftAction` now determines the draft's track via its candidate, classifies approval kind (manual vs nudged_manual based on `nudge_thread_json`), and fires `transitionAutonomyState` with `clean_approval` or `non_clean_approval`.
- `rejectDraftAction` now fires `transitionAutonomyState` with `rejection` for the draft's track.

### 6. Activity log kinds

Added `autonomy_circuit_broken` and `autonomy_probation_started` to `ACTIVITY_LOG_KINDS`.

### 7. Barrel exports

`lib/lead-gen/index.ts` exports: `transitionAutonomyState`, `getAutonomyStates`, `getAutonomyRow`, `AUTO_SEND_DELAY_MS`, `AutonomyEvent`, `AutonomyTransitionResult`, `AutonomyStateView`.

## Files created

- `lib/lead-gen/autonomy.ts`
- `tests/lead-gen/lg8-autonomy.test.ts`

## Files edited

- `lib/lead-gen/index.ts` — LG-8 barrel exports
- `lib/lead-gen/queries/index.ts` — re-exports `getAutonomyStates` + `AutonomyStateView` + `TrackAutonomySummary`
- `lib/lead-gen/queries/header.ts` — added `tracks` field with per-track autonomy summaries, parallelised data fetches
- `lib/db/schema/activity-log.ts` — added `autonomy_circuit_broken`, `autonomy_probation_started`
- `app/lite/admin/lead-gen/actions.ts` — wired autonomy transitions on approve/reject, imports `leadCandidates` + `transitionAutonomyState`
- `app/lite/admin/lead-gen/metrics/page.tsx` — fetches + passes `autonomyStates` to MetricsPanel
- `app/lite/admin/lead-gen/_components/metrics-panel.tsx` — replaced placeholder with real autonomy streak cards
- `app/lite/admin/lead-gen/_components/queue-header.tsx` — added per-track autonomy state lines
- `tests/lead-gen/lg7-queries.test.ts` — added mock for `@/lib/lead-gen/autonomy`

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **`getAutonomyRow()` auto-seeds on first access.** If no row exists for a track, one is inserted with defaults. Avoids requiring a setup step.

2. **Circuit breakers always demote to `manual`, not `circuit_broken`.** The spec says circuit_broken is "unrecoverable (this run)" and track demotes to manual. The `circuit_broken_at` and `circuit_broken_reason` columns record the event for audit, but the mode column goes to `manual` so the re-graduation path is the standard streak-to-probation-to-auto_send flow. The 10-manual-approval re-graduation requirement is naturally enforced by the streak threshold.

3. **Maintenance floor passes when window isn't full.** If fewer than `rolling_window_size` sends exist for a track, the maintenance check returns true — can't fail a standard that doesn't have enough data yet.

4. **Approval kind detection uses `nudge_thread_json`.** If the JSON array has entries, it's a nudged approval. This matches the spec's definition: "any nudge regeneration" = non-clean.

5. **Header query parallelised.** `getQueueHeaderData` now runs the last-run query, warmup check, and autonomy states fetch in parallel via `Promise.all`.

## Verification (G0–G12)

- **G0** — LG-7 and LG-6 handoffs read. Spec §9.2, §9.3, §9.4, §9.5, §12.F, §12.G, §12.H read.
- **G1** — Preconditions verified: `autonomyState` schema, `outreachDrafts` schema, `outreachSends` schema, `leadCandidates` schema, `logActivity`, `auth`, queue header component, metrics panel component — all present.
- **G2** — Files match LG-8 scope (autonomy state machine + circuit breakers + metrics wiring + queue header wiring + tests).
- **G3** — No motion work in this session.
- **G4** — No numeric/string literals in autonomy-sensitive paths. Thresholds stored on the `autonomy_state` row per §4.8. `AUTO_SEND_DELAY_MS` is an exported constant per §12.H.
- **G5** — Context budget held. Medium session.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 190 test files / 1602 passed + 1 skipped (+17 new), clean test run.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1602 passed.
- **G9** — UI pages require dev server + database with real data to visually verify. Library-only data in dev DB. Pages render structurally correct (build passes, routes present).
- **G10** — 17 tests: clean approval streak increment, graduation to probation, non-clean approval reset, non-clean demotion from probation, non-clean demotion from auto_send, rejection reset, rejection demotion, hard bounce circuit break, spam complaint circuit break, fast unsubscribe circuit break, drift flag circuit break, probation send decrement, probation graduation, probation no-op, activity log kind coverage, AUTO_SEND_DELAY_MS value, getAutonomyStates shape.
- **G10.5** — N/A (standard build session).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (closed this session)

- **`lg_7_autonomy_streak_wiring`** — Autonomy streak cards in the metrics panel now show real data from `getAutonomyStates()`.

## PATCHES_OWED (raised this session)

- **`lg_8_auto_send_delay_enforcement`** — `AUTO_SEND_DELAY_MS` is exported but the 15-minute delay scheduling isn't wired yet. LG-9 (sequence runner) must use this constant when scheduling auto-send tasks via `scheduled_tasks`.
- **`lg_8_circuit_breaker_webhook_wiring`** — Circuit breaker events (`hard_bounce`, `spam_complaint`, `fast_unsubscribe`) need to be fired from the Resend webhook handler when engagement signals arrive. The webhook handler (Wave 14 or wherever engagement processing lands) must call `transitionAutonomyState()` with the appropriate event.
- **`lg_8_auto_send_probation_send_completed`** — `probation_send_completed` and `auto_send_completed` events need to be fired from the send completion path. The sequence runner (LG-9) or send processor must call `transitionAutonomyState()` after successful sends.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Autonomy state machine module
- Metrics panel autonomy cards (reverts to placeholder)
- Queue header autonomy lines
- Approve/reject autonomy wiring (reverts to non-autonomy-aware actions)
- Activity log kind additions
- Barrel export additions
- Test files

## What the next session (LG-9) inherits

LG-9 is **Sequence engine + follow-up scheduling** — the multi-touch sequence runner. LG-8 provides:

- **`transitionAutonomyState(track, event)`** — LG-9 must call this with `probation_send_completed` and `auto_send_completed` after successful sends. Must also fire circuit breaker events when engagement signals arrive.
- **`AUTO_SEND_DELAY_MS`** — the 15-minute delay constant for scheduling auto-send tasks.
- **`getAutonomyRow(track)`** — LG-9 can read autonomy state to decide whether a draft should be auto-sent or held for approval.
- **Activity log kinds** — `autonomy_circuit_broken`, `autonomy_probation_started`, `autonomy_graduated`, `autonomy_demoted` all registered.
