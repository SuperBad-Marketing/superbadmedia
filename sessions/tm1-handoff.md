# TM-1 Handoff — Task Manager: Data model + schema + core CRUD functions

**Date:** 2026-04-20
**Wave:** 17
**Status:** COMPLETE

## What was built

### Drizzle schema — `tasks` table (`lib/db/schema/tasks.ts`)
- All 26 columns per spec: id, title, body, kind (5-value enum), status (7-value enum), priority (3-value enum), due_at_ms, entity_type/entity_id (polymorphic), checklist (JSON), checklist_auto_complete, recurrence (6-value enum), recurrence_day, parent_recurrence_id, source_braindump_id, approval columns (requested/viewed/approved/rejected timestamps, token, contact, feedback), created_at_ms, updated_at_ms, created_by, completed_at_ms
- 6 indexes: status+due, entity, kind+status, approval_token, parent_recurrence, source_braindump

### Drizzle schema — `braindumps` table (`lib/db/schema/braindumps.ts`)
- 8 columns per spec: id, raw_text, surface_context (JSON), parsed_at_ms, committed_at_ms, task_count, created_by, created_at_ms

### Migration (`lib/db/migrations/0056_tm1_task_manager.sql`)
- Both tables + all indexes in a single migration
- Journal entry added

### State machine (`lib/tasks/transitions.ts`)
- `validateTransition(from, to, kind)` — enforces legal transitions per spec
- `getLegalTransitions(from, kind)` — returns valid next states, filtering deliverable-only statuses for non-deliverables
- `isTerminal(status)` — done/cancelled are terminal
- `InvalidTransitionError` — typed error for invalid transitions
- Kind-aware gating: `awaiting_approval` and `delivered` only valid for `client_deliverable`

### Core CRUD (`lib/tasks/queries.ts`)
- `createTask(input)` — full task creation with all fields
- `getTaskById(id)` — single task lookup
- `listTasks(filter)` — filtered list with status, kind, priority, entity, due range, overdue, braindump source, full-text search
- `getTasksByEntity(type, id)` — convenience wrapper
- `updateTask(id, input)` — partial update, auto-stamps updated_at_ms
- `transitionTaskStatus(id, to)` — validates via state machine, sets completed_at_ms on terminal
- `updateChecklist(id, checklist)` — with auto-complete logic (all checked → done/delivered)
- `spawnNextRecurrence(task)` — computes next due date, creates new task with reset checklist
- `markTaskDone(id, targetStatus?)` — canonical "mark done" path: transitions + spawns recurrence
- `deleteTask(id)` / `deleteTasks(ids)` — single and bulk delete
- `createBraindump(input)` — braindump creation
- `markBraindumpCommitted(id, taskCount)` — marks braindump as committed
- `getBraindumpById(id)` — braindump lookup
- `getTasksForClientPortal(companyId, options)` — portal query filtered to client_deliverable/client_task
- `getTaskByApprovalToken(token)` — approval token lookup

### Activity log kinds
- 12 new kinds added to `lib/db/schema/activity-log.ts`: task_created, task_updated, task_status_changed, task_deleted, task_bulk_deleted, task_approval_requested, task_approved, task_rejected, task_recurrence_spawned, task_checklist_auto_completed, braindump_parsed, braindump_committed

### Portal stubs replaced (`lib/tasks/portal.ts`)
- `getTasksForClientPortal` — now queries real DB
- `approveDeliverable` — transitions to delivered via state machine
- `rejectDeliverable` — transitions to in_progress, stores rejection feedback

### Barrel export (`lib/tasks/index.ts`)
- Re-exports queries, transitions, types

### Types updated (`lib/tasks/types.ts`)
- Re-exports from schema, keeps `ChecklistItem` and `PortalTask` types

## New files
- `lib/db/schema/tasks.ts`
- `lib/db/schema/braindumps.ts`
- `lib/db/migrations/0056_tm1_task_manager.sql`
- `lib/tasks/transitions.ts`
- `lib/tasks/queries.ts`
- `lib/tasks/index.ts`
- `tests/tm1-task-manager.test.ts` (37 tests)

## Edited files
- `lib/db/schema/index.ts` — added tasks + braindumps exports
- `lib/db/schema/activity-log.ts` — 12 new task manager kinds
- `lib/db/migrations/meta/_journal.json` — added 0056 entry
- `lib/tasks/types.ts` — re-exports from schema
- `lib/tasks/portal.ts` — stubs → real DB queries
- `tests/cm7b-deliverables.test.ts` — updated to use own test DB (stubs are gone)

## Verification
- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 229 files, 1971 passed, 1 skipped (37 new tests)

## Key decisions
- Timestamps are `integer` (ms since epoch) matching all other tables in the codebase
- Entity linking follows the polymorphic-by-convention pattern from `activity_log`
- Recurrence spawns on completion (`markTaskDone`), not on calendar cron per spec
- `checklist_auto_complete` default true per spec — ticking last checkbox auto-transitions
- Portal.ts functions now query real DB; CM-7b test updated to use its own test DB fixture
- No `server-only` import in queries.ts — test imports need it; portal.ts (imported by server actions) inherits server-only via `@/lib/db`

## Rollback
- Migration reversible: drop `tasks` and `braindumps` tables
- Activity log kinds are additive (no migration needed to remove)
- Code is additive — removing schema exports + reverting portal.ts stubs restores prior state

## Settings keys consumed
- None in TM-1 (settings keys `tasks.morning_digest_enabled`, `tasks.morning_digest_time`, `tasks.deliverable_approval_token_ttl_days` are wired in later TM sessions)

## Next session should know
- TM-2 builds the Task List UI (`/lite/tasks` page) + task detail drawer
- All core data operations are ready — TM-2 can import from `lib/tasks/queries.ts`
- The `parseBraindump()` Claude primitive is TM-4's job
- The `approveDeliverable()` full primitive (with token validation, activity logging, inbox message creation) is TM-7's job — current portal.ts has a basic version
- Braindump modal UI is TM-3
- Notifications + digest is TM-8
- Cockpit integration is TM-9
