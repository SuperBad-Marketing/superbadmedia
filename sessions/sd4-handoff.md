# SD-4 Handoff — Surprise & Delight: Admin Egg Triggers

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### 3 admin egg trigger functions

| Trigger file | Egg ID | Signal |
|---|---|---|
| `crt-turn-off.ts` | `crt_turn_off` | 3+ distinct late-night admin sessions (after 01:30 Melbourne) within last 7 days; 30-day cooldown via `hidden_egg_fires` |
| `milestone-spotter.ts` | `milestone_spotter` | Activity log notes containing date-bearing milestones within 14-day upcoming window or 3-day past grace period; per-contact 60-day cooldown; lost-deal exclusion; Claude extraction (Haiku) + draft generation (Opus) |
| `three-wons.ts` | `three_wons` | Migrated from `app/lite/admin/pipeline/three-wons-egg.ts` — now writes to `hidden_egg_fires` via `fireEgg()` instead of stamping `pipeline.sd_three_wons_last_fired_ms` settings key |

All three live at `lib/eggs/admin-triggers/` as async server-side functions, separate from the pure synchronous public trigger evaluator framework.

### Milestone spotter scheduled task handler

`lib/scheduled-tasks/handlers/milestone-spotter-scan.ts` — daily scan handler (`milestone_spotter_daily_scan`) that calls `scanForMilestones()` + `generateMilestoneDraft()`, fires egg, and logs activity with draft in meta.

### Model registry additions

- `sd-milestone-extract`: Haiku — extracts milestone type + date from note text
- `sd-milestone-draft`: Opus — generates warm personal draft message for detected milestones

### Three-wons migration (PATCHES_OWED closed)

- `sp9_three_wons_migrate_to_hidden_egg_fires` marked as APPLIED
- Old `app/lite/admin/pipeline/three-wons-egg.ts` now re-exports from the new location
- `pipeline-board.tsx` import updated to point directly at `lib/eggs/admin-triggers/three-wons`
- Old test file (`tests/three-wons-egg.test.ts`) updated to verify `hidden_egg_fires` rows instead of settings key

## New files

- `lib/eggs/admin-triggers/crt-turn-off.ts`
- `lib/eggs/admin-triggers/milestone-spotter.ts`
- `lib/eggs/admin-triggers/three-wons.ts`
- `lib/eggs/admin-triggers/index.ts`
- `lib/scheduled-tasks/handlers/milestone-spotter-scan.ts`
- `tests/sd4-admin-egg-triggers.test.ts`

## Edited files

- `lib/db/schema/scheduled-tasks.ts` — added `milestone_spotter_daily_scan`
- `lib/ai/models.ts` — added `sd-milestone-extract` + `sd-milestone-draft`
- `lib/scheduled-tasks/handlers/index.ts` — added `MILESTONE_SPOTTER_SCAN_HANDLERS`
- `lib/eggs/index.ts` — barrel exports for admin triggers
- `components/lite/sales-pipeline/pipeline-board.tsx` — import path updated
- `app/lite/admin/pipeline/three-wons-egg.ts` — replaced with re-export
- `tests/three-wons-egg.test.ts` — updated for `hidden_egg_fires` verification
- `PATCHES_OWED.md` — marked `sp9_three_wons_migrate_to_hidden_egg_fires` as APPLIED

## Verification

- `npx tsc --noEmit` — zero new errors (2 pre-existing in hp19 test file)
- `npx vitest run` — 262 files, 2552 passed, 1 skipped (15 new tests)
- No browser check needed — pure library/engine code

## Rollback

- All new files additive; git-revertable
- `milestone_spotter_daily_scan` task type additive to enum
- Three-wons re-export preserves backward compat; old path still works
- Model registry entries removable by deleting lines

## Key decisions

- **Admin triggers as async functions, not the synchronous TriggerFn pattern** — admin eggs require DB queries (activity_log, hidden_egg_fires, contacts, deals), which the pure synchronous `TriggerContext -> evidence | null` framework can't support. Rather than making the whole framework async, admin triggers live in their own `admin-triggers/` directory as standalone async functions.
- **Milestone extraction via Haiku, draft via Opus** — extraction is a classification task (Haiku is sufficient); the draft message needs warmth and personality (Opus).
- **Per-contact 60-day cooldown for milestones** — dedup is per-contact via `hidden_egg_fires` trigger_evidence.contactId, not global. Multiple contacts can have milestones in the same week.
- **Lost deal exclusion** — milestones for contacts at companies with a lost deal are silently skipped per spec ("Sending a birthday note to someone who ghosted you is not warm, it's uncomfortable").
- **CRT uses Melbourne local time resolution** — `getMelbourneHour()` + minute parsing for the 01:30 threshold. Permissive on AEST/AEDT boundary (same as SD-3's approach).

## Settings keys consumed

- `pipeline.sd_three_wons_last_fired_ms` — no longer written; superseded by `hidden_egg_fires` rows

## Next session should know

- **SD-5** should build the riddle loop (tables, resolver, `/say/[answer]` route, wrong-answer branching). Check BUILD_PLAN for exact scope.
- **The orchestration layer** that calls `evaluateCrtTurnOff()` on admin sessions hasn't been built yet — it needs to be wired into whatever session-start hook or cockpit load triggers admin egg evaluation.
- **Milestone spotter event-driven path** (scan on note write, not just daily) is described in the spec but not wired — the `scanForMilestones()` function supports a lookback parameter that an `activity_log` write hook could call with a narrow window.
- **Content mini-session CMS-6** still owes admin egg catalogue copy (ambient copy pools + egg trigger content).
