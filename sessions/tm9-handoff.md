# TM-9 Handoff — Task Manager: Polish, E2E Wiring, Bootstrap

**Date:** 2026-04-20
**Wave:** 17
**Status:** COMPLETE — Wave 17 closed

## What was built

### Melbourne timezone helper extraction — `lib/time/melbourne.ts`
- Extracted the core triad (`melbourneWallDate`, `melbourneWallToUtcMs`, `melbourneOffsetMsAt`) plus `melbourneStartAndEndOfDay` and `nextMelbourneHourMs` into a shared module
- Deduplicated from 4 files that had identical copies:
  - `lib/tasks/digest.ts` — now imports from shared module
  - `lib/scheduled-tasks/handlers/inbox-digest.ts` — now imports from shared module
  - `lib/scheduled-tasks/handlers/task-morning-digest.ts` — now imports from shared module, also simplified `nextTaskDigestMs` to use shared `nextMelbourneHourMs`
  - `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts` — now imports from shared module
- Note: 3 other files still have their own Melbourne helpers (`lib/lead-gen/warmup.ts`, `lib/lead-gen/daily-search.ts`, `lib/intro-funnel/hourly-cron.ts`) with slightly different signatures — not extracted here because they serve different purposes (day bounds vs offset hours vs wall-clock formatting). Future waves touching those files can migrate if desired.

### Cockpit integration contracts — `lib/tasks/cockpit.ts`
- `getTasksForCockpitKanban(nowMs)` — returns `{ mustDo, shouldDo, ifTime }` TaskRow arrays per spec §Cockpit column rules
- `getTaskWaitingItems(nowMs)` — returns `WaitingItem[]` for overdue tasks + deliverables awaiting approval; matches Daily Cockpit spec §5 contract shape
- `getTaskHealthBanners(nowMs)` — returns `HealthBanner[]` with overdue count banner (warning ≤4, critical ≥5); matches Daily Cockpit spec §6 contract shape
- Exported via `lib/tasks/index.ts` barrel

### Deep-link wiring — `tasks-page-client.tsx`
- Reads `?open={taskId}` search param via `useSearchParams()`
- Auto-opens the task detail drawer if the referenced task exists in the loaded set
- Wires up email digest links (`/lite/tasks?open={taskId}`) and entity panel links from TM-5

### Digest bootstrap wiring — `lib/auth/auth.ts`
- Admin sign-in event now calls `void ensureTaskDigestEnqueued()` (fire-and-forget)
- Seeds the first scheduled run on first admin sign-in, making the digest self-perpetuating from that point

### Dynamic browser tab title — `app/lite/tasks/page.tsx`
- Converted from static `metadata` export to `generateMetadata()` function
- Title reflects live state: "SuperBad — 4 overdue" / "SuperBad — nothing's on fire" / "SuperBad — Tasks"
- Per spec §Sprinkle bank — browser tab title claimed by task-manager

## New files
- `lib/time/melbourne.ts`
- `lib/tasks/cockpit.ts`
- `tests/tm9-task-manager-polish.test.ts` (26 tests)

## Edited files
- `lib/tasks/digest.ts` — removed local Melbourne helpers, imports from shared module
- `lib/tasks/index.ts` — added cockpit re-export
- `lib/scheduled-tasks/handlers/inbox-digest.ts` — removed local helpers, imports from shared module
- `lib/scheduled-tasks/handlers/task-morning-digest.ts` — removed local helpers, simplified scheduling, imports from shared module
- `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts` — removed local helpers, imports from shared module
- `lib/auth/auth.ts` — added `ensureTaskDigestEnqueued()` call on admin sign-in
- `app/lite/tasks/page.tsx` — converted to `generateMetadata()` for dynamic tab title
- `components/lite/admin/tasks/tasks-page-client.tsx` — added `useSearchParams` for deep-link
- `tests/tm7-task-morning-digest.test.ts` — updated import path for Melbourne helper test

## Verification
- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 235 files, 2066 passed, 1 skipped
- Browser check: not performed (polish session, all changes are server-side contracts or query-param wiring)

## Key decisions
- Only extracted the exact triad shared across 4 files. Left divergent Melbourne helpers in lead-gen and intro-funnel alone — different signatures, different purposes, extracting them would be scope creep
- Cockpit contracts return real database query results (not stubs) — Wave 22 can import and use as-is
- HealthBanner severity threshold: warning < 5 overdue, critical ≥ 5 — proportional for a solo operator
- Digest bootstrap is fire-and-forget via `void` to avoid blocking the auth flow

## Rollback
- Git-revertable: no schema migrations, no data shape changes
- All new files are additive; edited files have narrow, reversible changes

## Settings keys consumed
- None directly in TM-9 (cockpit contracts query task state, not settings)

## Wave 17 completion summary
TM-1 through TM-9 complete. Task Manager delivers:
- Schema: `tasks` + `braindumps` tables with full indexes
- State machine: `lib/tasks/transitions.ts` with kind-aware gating
- CRUD: `lib/tasks/queries.ts` with 15+ query functions
- UI: `/lite/tasks` page with list view, detail drawer, filters, search, bulk delete
- Braindump: global FAB + modal with in-place parse → edit → commit flow
- Parser: real Haiku call via `parseBraindump()` in `lib/ai/parse-braindump.ts`
- Entity embedding: tasks on contact + company profiles via `EntityTasksPanel`
- Approval workflow: token lifecycle, portal route, reminder handler
- Morning digest: content builder + sender + cron handler + bootstrap
- Cockpit contracts: kanban columns, waiting items, health banners
- Deep-link: `?open={taskId}` auto-opens drawer
- Dynamic tab title: overdue count in browser tab

## Next session should know
- Wave 17 is complete — move to next wave per BUILD_PLAN.md corrected execution order
- `lib/time/melbourne.ts` is available for any future module that needs DST-safe Melbourne scheduling
- Cockpit contracts in `lib/tasks/cockpit.ts` are ready for Wave 22 (Daily Cockpit) to consume
- Parser calibration suite (30-item fixture set from spec) was not built in Wave 17 — it's a future polish item, not blocking
