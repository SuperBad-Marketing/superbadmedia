# TM-2 Handoff — Task Manager: Task List UI + Task Detail Drawer

**Date:** 2026-04-20
**Wave:** 17
**Status:** COMPLETE

## What was built

### Page — `/lite/tasks` (`app/lite/tasks/page.tsx`)
- Server component fetches all tasks via `listTasks()`
- Computes open/overdue counts for header
- Header follows standard admin pattern: breadcrumb → display title → narrative copy with dry italic callout → summary stats
- Copy variants: "no tasks. go outside." / "all current. rare." / "{n} overdue. you know what to do."

### Layout (`app/lite/tasks/layout.tsx`)
- Wraps in `AdminShellWithNav` + `AdminEventToasts`, matching `/lite/content/` pattern
- Route lives at `/lite/tasks` per spec (not `/lite/admin/tasks`)

### Server actions (`app/lite/tasks/actions.ts`)
- `createTaskAction` — creates task + logs `task_created` activity
- `updateTaskAction` — partial update + logs `task_updated`
- `transitionTaskAction` — status transition via state machine, uses `markTaskDone` for terminal states (handles recurrence spawning)
- `updateChecklistAction` — checklist update with auto-complete detection, logs `task_checklist_auto_completed`
- `deleteTaskAction` — single delete + logs `task_deleted`
- `bulkDeleteTasksAction` — multi-delete + logs `task_bulk_deleted`
- `searchEntitiesAction` — searches contacts + companies by name for entity link autocomplete
- All actions gated on `auth()` admin check, return `{ ok, error }` tuple, revalidate `/lite/tasks`

### Task list client component (`components/lite/admin/tasks/tasks-page-client.tsx`)
- Client-side filtering: status (open/done/cancelled/all), kind, priority, due (today/week/overdue/none), full-text search
- Default filter: "open" (not done/cancelled)
- Sort: due date asc, priority desc (inherited from `listTasks` query)
- Table with columns: checkbox, Task (title + checklist progress), Kind (colour-coded), Status, Priority (! indicator), Due (orange if overdue)
- Select-all checkbox + bulk delete bar (animated in/out with houseSpring)
- Row click opens edit drawer; checkbox click doesn't propagate
- Empty state for zero tasks vs zero matching filters (different copy)
- "New task" button top-right opens create drawer

### Task detail drawer (`components/lite/admin/tasks/task-detail-drawer.tsx`)
- Right-side slide drawer (Framer Motion, 520px max, houseSpring transition)
- Overlay at 40% opacity keeps list visible for quick context switching
- All fields editable: title, notes (textarea), kind, priority, due date, recurrence, entity link, checklist
- **Status section** (edit mode only): shows current status highlighted + clickable buttons for each legal transition, sourced from `getLegalTransitions()` — kind-aware (non-deliverables never see awaiting_approval/delivered)
- **Due date with natural-language parsing**: "tomorrow", "friday", "next week", "in 3 days", day names, ISO dates — parsed on blur/Enter, displayed as formatted date
- **Entity link with autocomplete**: searches contacts + companies via `searchEntitiesAction`, dropdown results with type labels, clear button
- **Checklist editor**: toggle items, add new, reorder up/down arrows, remove. Auto-complete triggers via `updateChecklistAction`
- **Rejection feedback**: read-only block if present (orange-tinted)
- **Metadata**: created, updated, completed timestamps + braindump/recurrence source indicators
- Footer: Delete (left), Cancel + Save/Create (right)
- Escape key closes drawer
- Reduced-motion support (skips spring animations)

### Nav update (`components/lite/admin-shell-nav.tsx`)
- Added "Tasks" nav item with `ListTodo` icon between Clients and Lead Gen
- `matchPrefix: "/lite/tasks"` for active state resolution

## New files
- `app/lite/tasks/layout.tsx`
- `app/lite/tasks/page.tsx`
- `app/lite/tasks/actions.ts`
- `components/lite/admin/tasks/tasks-page-client.tsx`
- `components/lite/admin/tasks/task-detail-drawer.tsx`

## Edited files
- `components/lite/admin-shell-nav.tsx` — added Tasks nav item + ListTodo import

## Verification
- `npx tsc --noEmit` — zero source errors
- `npx vitest run` — 229 files, 1971 passed, 1 skipped
- Manual browser check — all features verified end-to-end: empty state, create, list, edit, status transition, natural-language date parsing, kind-aware state machine

## Key decisions
- Route at `/lite/tasks` (not `/lite/admin/tasks`) per spec, with own layout.tsx wrapping AdminShellWithNav — matches `/lite/content/` pattern
- Drawer is custom Framer Motion (not Vaul) for wider width (520px) and consistent animation with DraftDrawer pattern
- Natural-language date parsing is client-side only — handles common inputs (tomorrow, day names, "in N days", ISO). Not exhaustive; covers spec's explicit examples
- Entity search queries contacts + companies (not deals/clients separately) — covers the primary use case; deals are entity-linked via company
- Status transitions fire immediately via `transitionTaskAction` — no optimistic UI needed since the drawer stays open and refreshes
- Checklist toggle fires `updateChecklistAction` immediately (not batched with Save) — matches the "tick and move on" interaction pattern

## Rollback
- Git-revertable: no migrations, no data shape changes
- All files are additive — removing nav item + deleting route/component files restores prior state

## Settings keys consumed
- None in TM-2 (settings keys for digest, approval TTL are TM-8/TM-7)

## Next session should know
- TM-3 builds the Braindump modal (floating button, Cmd+Shift+D, parse → edit → commit flow)
- TM-4 builds the `parseBraindump()` Claude primitive
- The drawer component is reusable — TM-3 can import field sub-components if needed
- Entity search currently covers contacts + companies; if deals need separate search, extend `searchEntitiesAction`
- `createTaskAction` and `updateTaskAction` are ready for braindump consumption (TM-3 calls `createTaskAction` per parsed task)
