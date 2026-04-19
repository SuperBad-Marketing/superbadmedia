# SWP-9 Handoff — Post-Regen Active Strategy Sync

**Date:** 2026-04-20
**Wave:** 15
**Status:** COMPLETE

## What was built

- **Post-regen active_strategy sync hook** (`lib/six-week-plan/actions.ts`):
  - `maybeSyncActiveStrategy(planId)` — called at end of `approveDetail()`
  - When a plan is approved that is the `source_id` of an `active_strategies` row in `pending_refresh_review` status, copies the updated `{intro, weeks_json, chosen_primitives, theme_arc}` payload into the active_strategy row
  - Logs `active_strategy_updated` activity with `trigger: 'post_regen_approval'`
  - Closes the gap identified in SWP-6 handoff: "post-regen hook to update active_strategy payload isn't wired yet"

## Scope reduction

SWP-9 was originally scoped for the full migrate-on-Won flow. SWP-6 already built:
- `active_strategies` table + migration
- `migratePlanOnWon()` handler
- `six_week_plan_migrate_on_won` scheduled task handler
- Deal-won hook in `finaliseDealAsWon`
- Refresh-review admin surface
- Portal plan-view retainer state

SWP-9 reduced to the one missing piece: syncing the active_strategy payload after a retainer-scope regen is approved through the normal two-tier review.

## Edited files

- `lib/six-week-plan/actions.ts` — added `active_strategies` import, `maybeSyncActiveStrategy()` helper, call from `approveDetail()`

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 224 files, 1851 passed, 1 skipped (unchanged)

## Key decisions

- Hook fires on `approveDetail` (not on generation completion) — the active_strategy should only update with content Andy has approved
- Active_strategy stays in `pending_refresh_review` after payload sync — Andy still explicitly approves/goes-live via the refresh-review surface
- Same payload shape as `migratePlanOnWon()` for consistency

## Rollback

- Git-revertable: no data shape changes, no migration, no settings keys
- The hook is additive — removing it just means active_strategy keeps the pre-regen payload until Andy manually re-migrates

## Next session should know

- SWP-10 remains: non-converter expiry (day-53 email + day-60 archive) + E2E tests + settings audit
- Wave 15 is nearly complete — SWP-10 is the last substantive session
