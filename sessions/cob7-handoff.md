# COB-7 Handoff — Cost & Usage Observatory: Band Editor

**Date:** 2026-04-21
**Wave:** 21
**Status:** COMPLETE

## What was built

### 1. Band overrides table + migration

`lib/db/schema/band-overrides.ts` + `lib/db/migrations/0066_cob7_band_overrides.sql` — runtime storage for band adjustments. PK: `job`. Nullable columns for each band field — null falls through to the registry default.

### 2. `getEffectiveBands()` in job-registry.ts

Async function that merges code-time registry defaults with any runtime override from `band_overrides`. Returns the same `JobBands` shape. Partial overrides (e.g. only per-call ceiling changed) merge field-by-field.

### 3. Detector migration to `getEffectiveBands()`

All three detectors (hard-threshold, rate, learned-band) now call `getEffectiveBands()` instead of `getJobBands()`. This means band adjustments take effect on the next detector sweep without code changes or restarts.

### 4. `adjustBands()` in band-editor.ts

Core backend function: validates job exists in registry, upserts `band_overrides`, logs `band_adjusted` to `activity_log` with previous/current values in meta.

### 5. API route

`app/api/admin/observatory/bands/route.ts` — admin-only POST endpoint. Zod-validated input: `{ job, per_call_ceiling_aud?, daily_ceiling_aud?, learned_band_multiplier? }`. Returns `{ previous, current }`.

### 6. BandEditor React component

`components/lite/observatory/band-editor.tsx` — client component with three number inputs (per-call ceiling, daily ceiling, learned-band multiplier), save/reset buttons, inline validation, success/error feedback. Shows registry defaults below each field. Ready to mount on anomaly detail view and observatory settings page.

### 7. Barrel export updated

`lib/observatory/index.ts` — exports `getEffectiveBands`, `adjustBands`, `AdjustBandsInput`, `AdjustBandsResult`.

## New files

- `lib/db/schema/band-overrides.ts`
- `lib/db/migrations/0066_cob7_band_overrides.sql`
- `lib/observatory/band-editor.ts`
- `app/api/admin/observatory/bands/route.ts`
- `components/lite/observatory/band-editor.tsx`
- `tests/cob7-band-editor.test.ts`

## Edited files

- `lib/db/schema/index.ts` — added band-overrides export
- `lib/db/migrations/meta/_journal.json` — added migration 0066
- `lib/observatory/job-registry.ts` — added `getEffectiveBands()`, added db imports
- `lib/observatory/index.ts` — added band-editor + getEffectiveBands exports
- `lib/observatory/hard-threshold-detector.ts` — `getJobBands` → `getEffectiveBands`
- `lib/observatory/rate-detector.ts` — `getJobBands` → `getEffectiveBands`
- `lib/observatory/learned-band-detector.ts` — `getJobBands` → `getEffectiveBands`
- `tests/cob4-hard-threshold-detector.test.ts` — added `@/lib/db` mock for band_overrides table access
- `tests/cob5-rate-detector.test.ts` — added `@/lib/db` mock
- `tests/cob6-learned-band-detector.test.ts` — added `@/lib/db` mock

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/cob7-band-editor.test.ts` — 9 passed
- Full suite run — 278 files, 2823 tests, zero regressions

## Rollback

- All changes are additive — git-revertable
- New table `band_overrides` has no FK dependencies
- No data in the table at launch — detectors fall back to registry defaults transparently

## Key decisions

- **Separate `band_overrides` table** rather than settings keys — band values are per-job (60+ jobs × 3 fields each), so a table is cleaner than 180+ settings keys. The `settings` table is for scalar platform-wide config.
- **`getJobBands()` still exists** — sync lookup for code that only needs registry defaults (tests, static analysis). `getEffectiveBands()` is the async runtime-aware lookup.
- **Null override fields fall through** — passing `null` for a field reverts it to the registry default. This means Andy can selectively adjust one band value without having to specify all three.
- **`rate_override` is NOT editable** via the band editor — it controls detector window sizing and should only change via code. `getEffectiveBands()` always returns the registry value.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)
- **COB severe-alert email** — wiring deferred to COB-9 when dashboard URL exists

## Next session should know

- **COB-8** is next in the wave — check SESSION_TRACKER.md for its scope.
- The `BandEditor` component is ready to mount but has no page yet — the anomaly detail view (`/lite/observatory/anomalies/[id]`) and settings page (`/lite/observatory/settings`) are built in the dashboard session (COB-C per build plan).
- `getEffectiveBands()` does a DB query per call. For the dashboard session that renders a list of all jobs with bands, consider batching with a single `SELECT * FROM band_overrides` rather than N calls. A `getAllEffectiveBands()` helper could be added in that session.
