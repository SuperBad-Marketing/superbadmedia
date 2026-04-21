# COB-5 Handoff — Cost & Usage Observatory: Rate Detector

**Date:** 2026-04-21
**Wave:** 21
**Status:** COMPLETE

## What was built

### 1. Rate detector module

`lib/observatory/rate-detector.ts` — spec §3.2 detector (b). Single entry point:

- **`sweepRateDetector()`** — 1-min cadence via scheduled tasks. For each `{job, actor_id}` pair with activity in the last 5 minutes, counts calls. If count >= 20 (min-calls gate) AND count > 10× trailing-hour median rate, fires a `cost_anomaly` with tier `severe`.

**Trailing-hour median:** splits the 60 minutes before the detection window into 5-min buckets (12 total), counts calls per bucket, takes the median. Zero trailing history → median 0 → min-calls gate is the only defense (correct: 20 calls in 5 min with no precedent is suspicious).

**Actor scoping:** detection and dedupe are both per `{job, actor_id}`. Two actors looping on the same job produce two independent anomalies. The `actor_scope` column on `cost_anomalies` stores `{actor_type, actor_id}` for rate anomalies (null for null-actor calls).

**`rate_override`:** per-job override on the job registry. When set, replaces the default 5-min detection window (in minutes). Changes both the current-window count and the trailing-hour bucket size. All registry entries currently have `rate_override: null`.

### 2. Scheduled task handler

`lib/scheduled-tasks/handlers/cost-anomaly-detector-rate.ts` — registered as `cost_anomaly_detector_rate` in the handler index. Delegates to `sweepRateDetector()`.

### 3. Activity logging

First fire in a dedupe window logs `cost_anomaly_fired` to `activity_log` with full meta (detector, job, actor_scope, tier, observed value, expected band including trailing-hour median). Subsequent fires within the same 24h window update the anomaly row silently.

### 4. Barrel export updated

`lib/observatory/index.ts` — exports `sweepRateDetector`.

## New files

- `lib/observatory/rate-detector.ts`
- `lib/scheduled-tasks/handlers/cost-anomaly-detector-rate.ts`
- `tests/cob5-rate-detector.test.ts`

## Edited files

- `lib/scheduled-tasks/handlers/index.ts` — imported + registered rate handler
- `lib/observatory/index.ts` — added rate detector export

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/cob5-rate-detector.test.ts` — 14 passed
- Full suite run — no regressions

## Rollback

- All changes are additive — git-revertable
- Kill switch `observatory_detectors_enabled` (added in COB-4) gates this detector
- No schema changes, no migrations

## Key decisions

- **Dedupe scoped per `{detector, job, actor_scope}`** — not just `{detector, job}` like hard threshold. The rate detector fires per-actor, so job-only dedupe would let actor A's anomaly suppress detection of actor B's loop on the same job. Actor-scoped dedupe prevents this.
- **`actor_scope` comparison uses stringified JSON equality** — Drizzle serializes JSON columns consistently with `JSON.stringify()`, so text comparison is safe as long as key order is stable. We always construct `{actor_type, actor_id}` in that order.
- **Null actor_id treated as its own scope** — internal system calls with no specific actor are grouped and monitored as a single cohort. 20+ internal calls in 5 min with no history will fire.
- **Severe email alert** still NOT wired — same as COB-4, deferred to COB-9 when dashboard URL exists.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)
- **COB severe-alert email** — wiring deferred to COB-9 when dashboard URL exists

## Next session should know

- **COB-6** builds the learned-band detector (spec §3.2 detector c). It follows the same pattern: detector module in `lib/observatory/`, scheduled task handler, kill-switched by `observatory_detectors_enabled`. The learned-band detector has different scoping (job-wide, not per-actor) and a warmup gate (7 days + 50 calls before it activates). Its `learned_band_multiplier` comes from the job registry (default 3).
- **`cost_anomaly_detector_learned` task type** is already registered in `lib/db/schema/scheduled-tasks.ts`.
- **The `upsertAnomaly` helper in `hard-threshold-detector.ts` and `upsertRateAnomaly` in `rate-detector.ts` are structurally similar** but differ in dedupe scoping (job-only vs job+actor). COB-6 can extract a shared helper if the pattern repeats, or implement its own — the learned-band detector dedupes per `{detector, job}` like hard threshold.
