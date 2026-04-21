# COB-8 Handoff — Cost & Usage Observatory: Diagnosis Prompt + Task Handler

**Date:** 2026-04-21
**Wave:** 21
**Status:** COMPLETE

## What was built

### 1. Diagnosis module

`lib/observatory/diagnose-anomaly.ts` — core `diagnoseAnomaly()` function per spec §3.3 + §7 prompt 1. On invocation:

- Validates kill switch + per-hour cap (10 diagnoses/hour max, prevents recursive loops per spec §14 scenario 10)
- Skips if anomaly already has `diagnosis_json` (idempotent)
- Assembles context: anomaly row, last 100 calls for the job, registry entry snapshot, deploy events (trailing 24h), prompt version history (distinct hashes with first/last seen + call count)
- Builds the Opus prompt with structured JSON output instructions — dry-calm house voice, no hedging
- Parses response with validation: confidence must be high/med/low, action must be acknowledge/investigate/kill_switch
- Caches `diagnosis_json` and `diagnosis_cost_aud` on the anomaly row
- Logs to `activity_log` on success and parse failure

### 2. Enqueue helper

`lib/observatory/enqueue-diagnosis.ts` — `enqueueDiagnosis(anomalyId)` enqueues a `cost_anomaly_diagnose` scheduled task with idempotency key `diagnose:{anomalyId}`.

### 3. Detector wiring

All three detectors now call `enqueueDiagnosis(id).catch(() => {})` when a new anomaly is created (`created: true`). Fire-and-forget — never blocks the detector sweep.

### 4. Scheduled task handler

`lib/scheduled-tasks/handlers/cost-anomaly-diagnose.ts` — registered as `cost_anomaly_diagnose` in the handler index. Reads `anomaly_id` from task payload and delegates to `diagnoseAnomaly()`.

### 5. Barrel exports updated

`lib/observatory/index.ts` — exports `diagnoseAnomaly`, `DiagnosisResult`, `DiagnoseAnomalyResult`, `enqueueDiagnosis`.

## New files

- `lib/observatory/diagnose-anomaly.ts`
- `lib/observatory/enqueue-diagnosis.ts`
- `lib/scheduled-tasks/handlers/cost-anomaly-diagnose.ts`
- `tests/cob8-diagnose-anomaly.test.ts`

## Edited files

- `lib/scheduled-tasks/handlers/index.ts` — imported + registered diagnose handler
- `lib/observatory/index.ts` — added diagnose-anomaly + enqueue-diagnosis exports
- `lib/observatory/hard-threshold-detector.ts` — added `enqueueDiagnosis` call on new anomaly
- `lib/observatory/rate-detector.ts` — added `enqueueDiagnosis` call on new anomaly
- `lib/observatory/learned-band-detector.ts` — added `enqueueDiagnosis` call on new anomaly
- `tests/cob4-hard-threshold-detector.test.ts` — added enqueue-diagnosis mock
- `tests/cob5-rate-detector.test.ts` — added enqueue-diagnosis mock
- `tests/cob6-learned-band-detector.test.ts` — added enqueue-diagnosis mock

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/cob8-diagnose-anomaly.test.ts` — 12 passed
- Full suite run — 279 files, 2835 tests, zero regressions

## Rollback

- All changes are additive — git-revertable
- Kill switch `observatory_detectors_enabled` gates the diagnoser
- Per-hour cap (10/hour) prevents runaway diagnosis costs
- Idempotency key on enqueue prevents duplicate diagnosis tasks per anomaly

## Key decisions

- **Per-hour cap as a constant (10)** rather than a settings key — the cap is a safety valve, not a tunable. If it needs changing, it's a code change with a deliberate review. Keeps it out of the settings registry where it could be accidentally relaxed.
- **Fire-and-forget enqueue** — `enqueueDiagnosis().catch(() => {})` ensures a failed enqueue never blocks or breaks a detector sweep. The diagnosis is a bonus, not a gate.
- **Prompt strips markdown fences** — the parser handles `\`\`\`json ... \`\`\`` wrapping since Opus sometimes adds fences despite instructions not to.
- **Separate enqueue-diagnosis module** rather than inlining in each detector — three detectors all need the same one-liner, and it avoids a circular dependency between `diagnose-anomaly.ts` and the detectors.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)
- **COB severe-alert email** — wiring deferred to COB-9 when dashboard URL exists

## Next session should know

- The diagnosis prompt is calibrated against the 10 scenarios in `docs/content/cost-usage-observatory/diagnosis-scenarios.md` by design (the prompt structure matches the scenario expectations). Live calibration against real anomalies happens post-launch.
- The `diagnosis_json` field on `cost_anomalies` is now populated by the diagnoser — the anomaly detail view (COB-C dashboard session) should render it as the Claude diagnosis card per spec §3.3.
- `diagnosis_cost_aud` tracks the self-referential cost of each diagnosis call — useful for the diagnoser-self-trigger scenario (scenario 10).
