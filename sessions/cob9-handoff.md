# COB-9 Handoff — Cost & Usage Observatory: Banner Contract + Severe Email + Kill-Switch Toggle

**Date:** 2026-04-21
**Wave:** 21
**Status:** COMPLETE

## What was built

### 1. Observatory health banners

`lib/observatory/health-banners.ts` — `getObservatoryHealthBanners()` returns an array of `HealthBanner` objects for the Daily Cockpit's banner strip. Emits banners for:

- **Open cost anomalies** (unresolved, not suppressed) — tier mapped to severity (`severe` → `critical`, `low`/`mid` → `warning`), copy follows `docs/content/cost-usage-observatory/banners.md` patterns
- **Monthly threshold crossings** — when MTD spend exceeds any of the three Andy-set thresholds
- **Projection threshold crossings** — when linear run-rate projection crosses a threshold that MTD hasn't yet (only fires after day 3 of the month for stability)

Gated by `observatory_detectors_enabled` kill switch — returns `[]` when off.

### 2. Severe-tier immediate email

`lib/observatory/severe-alert-email.ts` — `sendSevereAlertEmail(anomaly)` sends a transactional email to Andy via `sendEmail({ classification: 'transactional' })`. Subject line distinguishes rate-detector vs hard-ceiling breaches. HTML body includes the job name, observed value, band, Melbourne timestamp, and a red "Investigate" button linking to the anomaly detail view.

`lib/observatory/enqueue-severe-alert.ts` — `maybeSendSevereAlert(anomalyId)` fire-and-forget helper. Reads the anomaly row from DB, checks tier is severe, and delegates to `sendSevereAlertEmail`. Called by detectors alongside `enqueueDiagnosis`.

Uses dynamic import for `@/lib/channels/email/send` to avoid eagerly instantiating the Resend client at module load (prevents test failures in files that don't mock email).

### 3. Kill-switch toggle

`lib/observatory/kill-switch-toggle.ts` — `toggleJobKillSwitch({ job, action, anomalyId? })`. On disable: sets `jobDisabledUntil` on the registry entry (runtime mutation, checked by every external-call wrapper before invoking the vendor SDK), stamps `kill_switch_triggered_at_ms` on the anomaly row if an anomalyId is provided, logs `kill_switch_triggered` to `activity_log`. On enable: clears `jobDisabledUntil`, logs `kill_switch_released`.

### 4. Kill-switch API route

`app/api/admin/observatory/kill-switch/route.ts` — admin-only POST endpoint. Zod-validated input: `{ job, action: 'disable' | 'enable', anomaly_id? }`. Returns the toggle result.

### 5. Detector wiring

All three detectors (hard-threshold, rate, learned-band) now call `maybeSendSevereAlert(id).catch(() => {})` after `enqueueDiagnosis` when creating a new anomaly with a severe tier.

## New files

- `lib/observatory/health-banners.ts`
- `lib/observatory/severe-alert-email.ts`
- `lib/observatory/enqueue-severe-alert.ts`
- `lib/observatory/kill-switch-toggle.ts`
- `app/api/admin/observatory/kill-switch/route.ts`
- `tests/cob9-health-banners-killswitch.test.ts`

## Edited files

- `lib/observatory/index.ts` — added exports for all new modules
- `lib/observatory/hard-threshold-detector.ts` — added `maybeSendSevereAlert` import + call
- `lib/observatory/rate-detector.ts` — added `maybeSendSevereAlert` import + call
- `lib/observatory/learned-band-detector.ts` — added `maybeSendSevereAlert` import + call
- `tests/cob4-hard-threshold-detector.test.ts` — added enqueue-severe-alert mock
- `tests/cob5-rate-detector.test.ts` — added enqueue-severe-alert mock
- `tests/cob6-learned-band-detector.test.ts` — added enqueue-severe-alert mock

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/cob9-health-banners-killswitch.test.ts` — 15 passed
- Full suite run — 280 files, 2850 tests, zero regressions (up from 2835)

## Rollback

- All changes are additive — git-revertable
- Kill switch `observatory_detectors_enabled` gates the banner provider
- Kill-switch toggle mutates the in-memory registry only — no persistent state change to the registry (anomaly row stamp is the only DB write, harmless if reverted)

## Key decisions

- **Dynamic import for sendEmail** — `severe-alert-email.ts` lazily imports `@/lib/channels/email/send` to avoid instantiating the Resend client at module load time. This prevents test failures in any file that imports a detector without mocking the email chain.
- **`maybeSendSevereAlert` as a separate module** rather than inlining in each detector — same pattern as `enqueueDiagnosis`, keeps the fire-and-forget callsite clean. Reads the row from DB to avoid needing a full `CostAnomalyRow` in the detector scope.
- **Projection banners only after day 3** — linear projection from 1-2 days of data is too noisy; spec says "linear run-rate" which is meaningless on day 1.
- **Kill-switch disables for 1 year** — `jobDisabledUntil` is set to `now + 365 days` rather than infinity, keeping it a real timestamp the registry can handle. Andy re-enables explicitly via the dashboard or API.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)

## Next session should know

- `getObservatoryHealthBanners()` is the observatory's contribution to the Daily Cockpit — the DC-5 aggregation session needs to call it alongside `getSaasHealthBanners()`, `getFinanceHealthBanners()`, `getHiringHealthBanners()`, and other sources.
- The kill-switch toggle route is at `POST /api/admin/observatory/kill-switch` — the COB-C dashboard session should wire it to the severe banner's kill-switch CTA and the `/lite/observatory` kill-switch resume buttons.
- The `HealthBanner` type imported from `lib/tasks/cockpit.ts` does not include `first_fired_at` — the SaaS implementation defines its own type with it. The observatory follows the canonical type without it.
- Tier-health banners and unknown-job banners are NOT yet emitted by `getObservatoryHealthBanners()` — those require the tier-health panel data (COB-C) and will be wired in that session.
