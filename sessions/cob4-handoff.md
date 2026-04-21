# COB-4 Handoff — Cost & Usage Observatory: Hard-Threshold Detector

**Date:** 2026-04-21
**Wave:** 21
**Status:** COMPLETE

## What was built

### 1. Hard-threshold detector module

`lib/observatory/hard-threshold-detector.ts` — spec §3.2 detector (a). Two modes:

- **`checkPerCallThreshold()`** — sync check on every `logExternalCall()`. Compares single-call cost against the job's `per_call_ceiling_aud` from the registry.
- **`sweepDailyThresholds()`** — periodic sweep (5-min cadence via scheduled tasks). Aggregates trailing-24h spend per job, compares against each job's `daily_ceiling_aud`.

**Tier assignment logic:**
- Ratio >= 5x ceiling → `severe`
- Ratio >= 2x ceiling → `mid`
- Ratio > 1x ceiling → `low`

**Dedupe:** Per `{detector='hard_threshold', job}` per 24h window. Subsequent fires update the existing `cost_anomaly` row (fire_count++, last_fired_at updated, observed_value overwritten with latest) rather than creating new rows.

### 2. Kill switch added

`lib/kill-switches.ts` — added `observatory_detectors_enabled` (default: `false`). Gates all three detectors (COB-4/5/6) and the diagnosis task (COB-8). Both `checkPerCallThreshold()` and `sweepDailyThresholds()` exit early when off.

### 3. Sync-on-insert wiring

`lib/observatory/log-external-call.ts` — `logExternalCall()` now fire-and-forgets `checkPerCallThreshold()` after every insert. Async, non-blocking (`.catch(() => {})`), same pattern as the existing unknown-job trap.

### 4. Scheduled task handler

`lib/scheduled-tasks/handlers/cost-anomaly-detector-hard.ts` — registered as `cost_anomaly_detector_hard` in the handler index. Delegates to `sweepDailyThresholds()`.

### 5. Activity logging

First fire in a dedupe window logs `cost_anomaly_fired` to `activity_log` with full meta (detector, job, tier, observed value, expected band). Subsequent fires within the same window update the anomaly row silently.

### 6. Barrel export updated

`lib/observatory/index.ts` — exports `checkPerCallThreshold` and `sweepDailyThresholds`.

## New files

- `lib/observatory/hard-threshold-detector.ts`
- `lib/scheduled-tasks/handlers/cost-anomaly-detector-hard.ts`
- `tests/cob4-hard-threshold-detector.test.ts`

## Edited files

- `lib/kill-switches.ts` — added `observatory_detectors_enabled`
- `lib/observatory/log-external-call.ts` — wired sync-on-insert check
- `lib/observatory/index.ts` — added detector exports
- `lib/scheduled-tasks/handlers/index.ts` — registered handler

## Verification

- `npx tsc --noEmit` �� 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/cob4-hard-threshold-detector.test.ts` — 11 passed
- Full suite run — no regressions

## Rollback

- All changes are additive — git-revertable
- Kill switch defaults to `false` — detector is inert until explicitly enabled
- No schema changes, no migrations

## Key decisions

- **Tier assignment uses ratio-based thresholds** (5x=severe, 2x=mid, >1x=low) rather than absolute dollar amounts. Matches spec intent of severity-proportional alerting.
- **Sync check is fire-and-forget** — per spec's "synchronous check" intent balanced against the "latency overhead <5ms" target. The check runs async after the insert succeeds so a detector failure never blocks the calling feature.
- **Expected band snapshot** includes `check: 'per_call' | 'daily'` so the anomaly detail view (COB-9) can distinguish which ceiling was breached without re-deriving from the numbers.
- **Severe email alert** (spec §3.3: "Severe anomalies also trigger an immediate email to Andy") is NOT wired in this session. Reason: the email body needs CMS-6 banner copy + the anomaly detail URL pattern from COB-9's dashboard. Email send belongs in COB-9 or a post-detector session when the dashboard URL and banner copy are available. The anomaly row, activity log entry, and Cockpit banner integration point are all in place for the email to be added cleanly.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)
- **COB severe-alert email** — wiring deferred to COB-9 when dashboard URL exists

## Next session should know

- **COB-5** builds the rate detector (spec §3.2 detector b). It follows the same pattern: a detector module in `lib/observatory/`, a scheduled task handler, kill-switched by the same `observatory_detectors_enabled` flag. The dedupe pattern and `upsertAnomaly` helper in `hard-threshold-detector.ts` can be extracted into a shared module if COB-5 needs it — or COB-5 can implement its own since the rate detector has different scoping (per `{job, actor_id}` instead of per `{job}`).
- **`cost_anomaly_detector_hard` task type** is already registered in `lib/db/schema/scheduled-tasks.ts`. COB-5's type `cost_anomaly_detector_rate` and COB-6's `cost_anomaly_detector_learned` are also pre-registered.
- **Daily sweep aggregation** uses `sum(estimated_cost_aud)` grouped by job. It does not filter by actor — job-wide spend is the detection surface for hard thresholds.
