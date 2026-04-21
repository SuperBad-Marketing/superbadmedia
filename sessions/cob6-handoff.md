# COB-6 Handoff — Cost & Usage Observatory: Learned-Band Detector

**Date:** 2026-04-21
**Wave:** 21
**Status:** COMPLETE

## What was built

### 1. Learned-band detector module

`lib/observatory/learned-band-detector.ts` — spec §3.2 detector (c). Single entry point:

- **`sweepLearnedBandDetector()`** — 15-min cadence via scheduled tasks. For each registered job, checks warmup conditions (7+ days of history AND 50+ calls in the trailing 14 days). Once warmed up, computes rolling p95 of per-call cost over the trailing 14 days. Any call in the last 15-minute window exceeding `p95 × learned_band_multiplier` (default 3) creates a `cost_anomaly`.

**Warmup gate:** both conditions must be met — at least one call older than 7 days AND at least 50 total calls in the 14-day window. Prevents false positives on newly registered jobs.

**Tier assignment:** ratio of observed to threshold. ≥5× = `mid`, below that = `low`. Learned-band anomalies are never `severe` — hard-threshold and rate detectors own that tier.

**Scoping:** job-wide (not per-actor). Dedupe per `{detector, job}` per 24h window, same pattern as hard-threshold detector. `actor_scope` is null on all learned-band anomalies.

**One anomaly per sweep per job:** even if multiple calls in the 15-min window breach, only the first breaching call fires the anomaly (or updates the dedupe). Prevents noise.

### 2. Scheduled task handler

`lib/scheduled-tasks/handlers/cost-anomaly-detector-learned.ts` — registered as `cost_anomaly_detector_learned` in the handler index. Delegates to `sweepLearnedBandDetector()`.

### 3. Activity logging

First fire in a dedupe window logs `cost_anomaly_fired` to `activity_log` with full meta (detector, job, tier, observed value, expected band including p95, multiplier, threshold, trailing days, total calls). Subsequent fires within the same 24h window update the anomaly row silently.

### 4. Barrel export updated

`lib/observatory/index.ts` — exports `sweepLearnedBandDetector`.

## New files

- `lib/observatory/learned-band-detector.ts`
- `lib/scheduled-tasks/handlers/cost-anomaly-detector-learned.ts`
- `tests/cob6-learned-band-detector.test.ts`

## Edited files

- `lib/scheduled-tasks/handlers/index.ts` — imported + registered learned handler
- `lib/observatory/index.ts` — added learned-band detector export

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/cob6-learned-band-detector.test.ts` — 14 passed
- Full suite run — 277 files, 2814 tests, zero regressions

## Rollback

- All changes are additive — git-revertable
- Kill switch `observatory_detectors_enabled` (added in COB-4) gates this detector
- No schema changes, no migrations

## Key decisions

- **Trailing 14 days for p95 computation** — per spec. Gives enough history for a stable baseline while still adapting to gradual cost shifts.
- **Only checks calls in the last 15-min window** — the sweep runs every 15 minutes, so it only looks at calls since the last sweep. Calls outside the window were already checked by the previous sweep.
- **Severe email alert** still NOT wired — same as COB-4/5, deferred to COB-9 when dashboard URL exists. Learned-band anomalies are never severe anyway.
- **Iterates REGISTERED_JOB_KEYS** — walks the full registry rather than querying distinct jobs from the log. This is correct because we only want to check jobs that have bands configured.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)
- **COB severe-alert email** — wiring deferred to COB-9 when dashboard URL exists

## Next session should know

- **All three detectors are now complete** (COB-4 hard-threshold, COB-5 rate, COB-6 learned-band). All gated by `observatory_detectors_enabled` kill switch.
- **COB-7** is the next session in the wave — check SESSION_TRACKER.md for its scope.
- The upsert pattern was implemented per-detector (not extracted to a shared helper) since each has slightly different dedupe scoping. Hard-threshold and learned-band both dedupe per `{detector, job}`; rate dedupes per `{detector, job, actor_scope}`. A shared helper could be extracted in a future cleanup pass but the duplication is minor.
