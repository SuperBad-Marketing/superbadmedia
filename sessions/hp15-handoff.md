# HP-15 Handoff — Hiring Pipeline: Role Brief Regeneration Cycle

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Core regeneration function — `lib/hiring/regenerate-brief.ts`

`regenerateRoleBrief(roleBriefId, trigger)` — full LLM-driven re-synthesis of a Role Brief. Reads the brief's current state, all bench members, all archive reflections with text, original reference signals, and Andy's manual overrides. Sends a comprehensive regeneration prompt to `hiring-brief-synthesize` (Sonnet). Updates `style_summary`, `extracted_tags_json`, `style_do_list_json`, `style_avoid_list_json`, `discovery_search_hints_json`, and `last_regenerated_at_ms`. Logs `role_brief_regenerated` with trigger metadata. Only runs on `open` or `paused` briefs.

### Debounced enqueue helper — `lib/hiring/maybe-regenerate-brief.ts`

`maybeRegenerateRoleBrief(roleBriefId, trigger)` — the `maybeRegenerateBrief` pattern from spec §6.3. Checks preconditions before enqueuing:

- **bench_entry**: gated by `hiring.brief.regen_on_bench_entry` setting
- **archive_threshold**: counts archive reflections since last regen, compares against `hiring.brief.archive_retune_threshold` (default 10)
- **archive_reflection**: enqueues unconditionally (debounce handles dedup)
- **manual_retune**: immediate (2s delay), unique idempotency key (no debounce)

10-minute debounce window for non-manual triggers via idempotency key bucketing.

### Scheduled task handler — `lib/scheduled-tasks/handlers/hiring-role-brief-regenerate.ts`

Registered as `hiring_role_brief_regenerate` in handler index. Kill-switch gated (`llm_calls_enabled`).

### Trigger wiring — `app/lite/admin/hiring/actions.ts`

Three trigger points:

1. **`archiveCandidateAction`** — fires `archive_reflection` (if reflection text present) + `archive_threshold` (always, checks count internally)
2. **`transitionCandidateAction`** — fires `bench_entry` when toStage is `bench`
3. **`skipTrialAction`** — fires `bench_entry` on direct bench transition
4. **`retuneRoleBriefAction`** (new) — fires `manual_retune` for admin "Retune" button on Brief detail page

## New files

- `lib/hiring/regenerate-brief.ts`
- `lib/hiring/maybe-regenerate-brief.ts`
- `lib/scheduled-tasks/handlers/hiring-role-brief-regenerate.ts`
- `tests/hp15-role-brief-regeneration.test.ts` (11 tests)

## Edited files

- `lib/db/schema/scheduled-tasks.ts` — added `hiring_role_brief_regenerate` to task types enum
- `lib/scheduled-tasks/handlers/index.ts` — registered handler
- `app/lite/admin/hiring/actions.ts` — added import + trigger calls in 3 actions + new `retuneRoleBriefAction`

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 250 files, 2369 passed, 1 skipped (pre-existing)
- Browser check: not applicable (LLM-driven background task; validated via typecheck + 11 new tests)

## Key decisions

- **10-minute debounce** — matches Cockpit's `material_event_debounce_minutes` pattern. Non-manual triggers within the same 10-minute window share an idempotency key; the first enqueue wins, the rest are silently dropped.
- **Manual retune bypasses debounce** — uses a unique idempotency key per invocation so Andy can always force a regen.
- **Regen prompt includes full accumulated signal** — original reference signals, current brief state, all archive reflections (capped at last 20), bench count, Andy's overrides. The LLM sees the complete picture, not just the delta.
- **Archive threshold checked per-action** — `archive_threshold` trigger is fired after every archive, but `maybeRegenerateRoleBrief` internally counts reflections since last regen and compares against the setting. This means the threshold check runs cheaply (a DB query) and only enqueues the LLM call when the threshold is actually met.

## Rollback

- Git-revertable: all new files are additive. Edits to existing files add imports and function calls; no existing signatures changed. The new scheduled task type enum value is additive.

## Settings keys consumed

- `hiring.brief.regen_on_bench_entry` — gates bench-entry trigger
- `hiring.brief.archive_retune_threshold` — cumulative archive count before auto-retune

## Next session should know

- **Admin "Retune" button UI** — `retuneRoleBriefAction` exists but there's no UI button on the Brief detail page yet. The briefs admin surface (§13.2) is likely HP-16 or later scope. The action is ready to wire.
- **Remaining HP sessions:** HP-16 (sounds + motion), HP-17 (bench pause ending cron + availability helpers), HP-18/HP-19 TBD. Plus §14 Daily Cockpit integration.
- **Cockpit `maybeRegenerateBrief` contract** — the Daily Cockpit spec references a generic `maybeRegenerateBrief(eventKey, payload)` helper. The hiring-specific `maybeRegenerateRoleBrief` is a separate function with the same debounce pattern but scoped to role briefs. When the Cockpit build lands (Wave 22), it will need its own `maybeRegenerateBrief` for cockpit briefs — not the same function.
