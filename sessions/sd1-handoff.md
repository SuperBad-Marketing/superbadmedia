# SD-1 Handoff — Surprise & Delight: Data Model + Schema + Core Engine

**Date:** 2026-04-20
**Wave:** 20
**Status:** COMPLETE

## What was built

### Schema — 4 new tables

- **`hidden_egg_fires`** — append-only log of every hidden egg that fires. Fields: egg_id, actor_type (public/admin/customer), user_id (nullable), visitor_id (nullable), fired_at_ms, trigger_evidence (JSON, non-null), session_id, outcome. Indexed on egg+user, egg+visitor, fired_at.
- **`ambient_copy_cache`** — cached Claude-generated ambient lines per slot. Fields: slot (6-value closed enum), context_hash, generated_text, drift_check_score, generated_at_ms, expires_at_ms. Indexed on slot+hash.
- **`riddles`** — source of truth for each active riddle. Fields: slug (unique), salt, answer_hash, public/loggedin reward content, common_wrong_answers (JSON), catch_all_wrong_content, created_at_ms, retired_at_ms.
- **`riddle_resolutions`** — append-only log of every resolver call. Fields: riddle_id (cascade), actor_type, user_id, input_hash, resolved_at_ms, outcome (6-value enum). Indexed on riddle, user.

### User table extensions (3 new columns)

- `last_hidden_egg_fired_at_ms` — UTC timestamp of last egg fire
- `hidden_egg_tricks_enabled` — boolean, default true ("No tricks" toggle)
- `fired_egg_ids_recent` — JSON array, max 50 entries, FIFO

### Egg registry — `lib/eggs/registry.ts`

Closed catalogue of 15 eggs: 3 admin-roommate (CRT turn-off, milestone spotter, three wons) + 12 public-bartender. Each with id, name, register, cooldownDays, exemptFromBudget flag.

### Suppression logic — `lib/eggs/suppression.ts`

Hard gate: 7 suppression conditions (payment, email compose, quote acceptance, error page, onboarding wizard, first-ever login, first 30 seconds). All fail-closed.

### Cadence model — `lib/eggs/cadence.ts`

`canFireAuthenticatedEgg()` — cadence-window check + tricks-enabled + per-egg cooldown.
`canFirePublicEgg()` — first-egg-always + rolling 2-per-14-day budget + exempt bypass + tricks check.
`updateFiredEggIds()` — FIFO capped at 50 entries.

### Trigger evaluator framework — `lib/eggs/trigger-evaluator.ts`

`registerTrigger(eggId, fn)` + `evaluateAllTriggers(ctx)`. Pure function framework — each trigger returns evidence object or null. SD-2+ will register individual egg triggers.

### Fire egg — `lib/eggs/fire-egg.ts`

`fireEgg(params)` — writes to `hidden_egg_fires`, updates user's `last_hidden_egg_fired_at_ms` + `fired_egg_ids_recent`, logs activity.

### generateInVoice stub — `lib/eggs/generate-in-voice.ts`

Placeholder returning `[voice placeholder: {slot}]`. SD-2 wires the full LLM + drift check pipeline.

### Riddle resolver — `lib/riddles/resolve.ts`

`resolveRiddleAnswer(input, context)` — normalises input, hashes with per-riddle salt, checks correct → common wrong → catch-all. Logs every resolution. SD-10 adds the live Claude fallback for novel wrongs.

### Scheduled task types

3 new types registered: `ambient_copy_generate`, `hidden_egg_fire_cleanup`, `riddle_answer_fallback_budget_monitor`.

### Settings keys (5)

- `surprise.hidden_eggs_enabled` (true)
- `surprise.public_egg_cadence_per_days` (14)
- `surprise.admin_egg_cadence_per_days` (7)
- `surprise.ambient_copy_refresh_interval_days` (30)
- `surprise.riddle_wrong_answer_fallback_budget_per_riddle` (100)

### Activity log kinds (6)

`hidden_egg_fired`, `hidden_egg_dismissed`, `ambient_copy_generated`, `ambient_copy_refresh_requested`, `riddle_resolved`, `riddle_wrong_answered`.

## New files

- `lib/db/schema/hidden-egg-fires.ts`
- `lib/db/schema/ambient-copy-cache.ts`
- `lib/db/schema/riddles.ts`
- `lib/db/migrations/0063_sd1_surprise_delight_tables.sql`
- `lib/eggs/registry.ts`
- `lib/eggs/suppression.ts`
- `lib/eggs/cadence.ts`
- `lib/eggs/trigger-evaluator.ts`
- `lib/eggs/fire-egg.ts`
- `lib/eggs/generate-in-voice.ts`
- `lib/eggs/index.ts`
- `lib/riddles/resolve.ts`
- `tests/sd1-schema-engine.test.ts`

## Edited files

- `lib/db/schema/user.ts` — 3 new S&D columns
- `lib/db/schema/index.ts` — 3 new schema exports
- `lib/db/schema/scheduled-tasks.ts` — 3 new task types
- `lib/db/schema/activity-log.ts` — 6 new activity kinds
- `lib/settings.ts` — 5 new surprise.* keys
- `lib/db/migrations/meta/_journal.json` — migration 0063 entry
- `tests/settings.test.ts` — updated seed count 152 → 157

## Verification

- `npx tsc --noEmit` — zero new errors (2 pre-existing in hp19 test file)
- `npx vitest run` — 259 files, 2492 passed, 1 skipped (33 new tests)
- No browser check needed — this session is pure data model + engine primitives with no UI

## Rollback

- Migration: DROP TABLE for hidden_egg_fires, ambient_copy_cache, riddles, riddle_resolutions. ALTER TABLE user DROP COLUMN for the 3 new columns.
- All new files additive; edited files git-revertable
- Handler registry + settings keys removable by removing entries

## Key decisions

- **Trigger evaluator as registry pattern** — pure functions registered by egg ID, evaluated in bulk. Keeps each trigger isolated and testable. Individual triggers register in SD-2+.
- **generateInVoice as a stub** — full LLM + drift check wiring is SD-2 scope. Stub returns placeholder for type safety.
- **Riddle resolver does normalisation + hashing inline** — no separate normalisation module. Keeps the resolver self-contained per spec discipline #22.
- **User columns over separate table** — egg state per user (tricks toggle, recent fires, last fired) lives on the user row. Simpler than a join table for 3 columns. fired_egg_ids_recent is JSON with FIFO cap at 50.

## Settings keys consumed

All 5 surprise.* keys defined above (consumed by cadence model, trigger evaluator, ambient copy generator).

## Next session should know

- **SD-2 should wire `generateInVoice()`** with the real Haiku LLM call + drift check pipeline. The stub is in place.
- **SD-2+ should register individual trigger functions** via `registerTrigger()` in `lib/eggs/triggers/*.ts` per the spec's data-access audit discipline.
- **The Three Wons egg has cross-spec coupling** with SP-9 (`app/lite/admin/pipeline/three-wons-egg.ts`). When `hidden_egg_fires` table lands (this session), the egg should migrate to writing a row there. Tracked in PATCHES_OWED.md.
- **Pre-existing hp19 test TS errors** — still 2 cosmetic `TS2345` errors in `tests/hp19-briefing-signals.test.ts`.
