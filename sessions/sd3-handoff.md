# SD-3 Handoff — Surprise & Delight: Remaining Public Triggers + Ambient Copy Cache Builder

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### 3 remaining public trigger functions

| Trigger file | Egg ID | Signal |
|---|---|---|
| `melbourne-public-holiday.ts` | `melbourne_public_holiday` | `holidayName` present in context (pre-resolved from `/data/au-holidays.json`) |
| `melbourne-rain.ts` | `melbourne_rain` | Melbourne timezone + `weatherPrecipitationMm > 0` (pre-fetched from Open-Meteo) |
| `public-crt-turn-off.ts` | `public_crt_turn_off` | Melbourne hour 01:00–04:59 + 3min+ dwell + no `late_night_visitor` in session |

All three require external/async data that can't be resolved from the pure browser context alone. The solution: extend `TriggerContext` with optional pre-populated fields that the orchestration layer fills before calling `evaluateAllTriggers()`.

### TriggerContext extensions (`lib/eggs/trigger-evaluator.ts`)

5 new optional fields added:
- `melbourneDateISO` — YYYY-MM-DD in Melbourne time
- `melbourneHour` — 0-23 Melbourne local hour
- `holidayName` — holiday name or null
- `weatherPrecipitationMm` — current precipitation mm/h from Open-Meteo
- `firedEggIdsInSession` — egg IDs already fired in this session (cross-egg suppression)

### Melbourne helpers (`lib/eggs/melbourne-holidays.ts`, `lib/eggs/melbourne-weather.ts`)

- `getHolidayName(dateISO)` — reads `/data/au-holidays.json`, lazy-loaded and cached
- `getMelbourneDateISO(nowMs)` — resolves current Melbourne date
- `getMelbourneHour(nowMs)` — resolves current Melbourne hour
- `getMelbournePrecipitation()` — calls Open-Meteo API with 15-minute in-memory cache, logs to `external_call_log`

### Ambient copy cache builder handler (`lib/scheduled-tasks/handlers/ambient-copy-generate.ts`)

Scheduled task handler for `ambient_copy_generate`:
1. Kill-switch gated on `llm_calls_enabled`
2. Iterates all 6 ambient slots (or a subset if `payload.slots` is provided)
3. Skips slots that have a fresh cache entry (within `surprise.ambient_copy_refresh_interval_days`)
4. Calls `generateInVoice()` per slot and writes result to `ambient_copy_cache`
5. Registered in handler index

## New files

- `lib/eggs/triggers/melbourne-public-holiday.ts`
- `lib/eggs/triggers/melbourne-rain.ts`
- `lib/eggs/triggers/public-crt-turn-off.ts`
- `lib/eggs/melbourne-holidays.ts`
- `lib/eggs/melbourne-weather.ts`
- `lib/scheduled-tasks/handlers/ambient-copy-generate.ts`
- `tests/sd3-remaining-triggers-ambient.test.ts`

## Edited files

- `lib/eggs/trigger-evaluator.ts` — 5 new optional context fields
- `lib/eggs/triggers/index.ts` — 3 new trigger imports
- `lib/scheduled-tasks/handlers/index.ts` — `AMBIENT_COPY_GENERATE_HANDLERS` import + spread

## Verification

- `npx tsc --noEmit` — zero new errors (2 pre-existing in hp19 test file)
- `npx vitest run` — 261 files, 2537 passed, 1 skipped (19 new tests)
- No browser check needed — pure library/engine code

## Rollback

- All new files additive; git-revertable
- TriggerContext extensions are optional fields — backward compatible
- Handler registry entry removable by removing import + spread

## Key decisions

- **Optional context fields over async triggers** — rather than making the trigger framework async (which would ripple into every existing pure trigger), the orchestration layer pre-populates optional fields on TriggerContext. Triggers remain pure synchronous functions. The orchestration layer (built in a later session when the public marketing shell wires the egg evaluator) calls the helpers before `evaluateAllTriggers()`.
- **Melbourne timezone matching is permissive** — includes Sydney/Hobart/ACT since they share AEST/AEDT and weather conditions. The spec says "timezoned to Australia/Melbourne" but the rain check uses Open-Meteo Melbourne data regardless — a Sydney visitor in Melbourne rain is close enough.
- **External call logging for Open-Meteo** — writes to `external_call_log` per the cost observatory discipline, even though the API is free. Cost is $0 but call volume should still be visible.

## Settings keys consumed

- `surprise.ambient_copy_refresh_interval_days` (consumed by ambient copy cache builder)
- `surprise.hidden_eggs_enabled` (consumed by cadence, not directly by these triggers)

## Next session should know

- **Admin egg triggers** (CRT turn-off, milestone spotter, three wons) still need implementation — they require `activity_log` queries and are distinct from these public browser-context triggers.
- **The orchestration layer** (the code that actually calls `getMelbournePrecipitation()`, `getHolidayName()`, `getMelbourneHour()` and populates the TriggerContext before evaluation) hasn't been built yet — it lives in whatever session builds the public marketing shell or the egg evaluator API route.
- **The Three Wons migration** from SP-9's `three-wons-egg.ts` to the `hidden_egg_fires` table is still tracked in PATCHES_OWED.md.
- **Content mini-session SD-15** for ambient copy seed content is still outstanding per the build plan.
