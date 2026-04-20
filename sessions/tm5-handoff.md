# TM-5 Handoff — Task Manager: Entity-Profile Task Embedding

**Date:** 2026-04-20
**Wave:** 17
**Status:** COMPLETE

## What was built

### Reusable `EntityTasksPanel` — `components/lite/admin/tasks/entity-tasks-panel.tsx`
- Server component that takes a `TaskRow[]` and renders a task list split into Open/Closed sections
- Each task row links to `/lite/tasks?open={taskId}` for opening in the task manager drawer
- Shows: title, kind (colour-coded label), status chip (colour-coded), priority indicator (!), due date (orange if overdue), checklist progress (done/total)
- Summary strip at top: "{n} open", "{n} overdue" (orange, only if >0), "{n} closed"
- Empty state with configurable hero + mutter copy
- "Open task manager →" link at bottom
- Uses existing `getTasksByEntity()` query from `lib/tasks/queries.ts`
- Matches existing design system patterns: `PanelShell` chrome, font families, colour vars, spacing

### Contact profile — Tasks tab added
- New "Tasks" tab in tab strip between Overview and Comms
- Queries `getTasksByEntity("contact", contactId)` only when tab is active
- Empty state: "No tasks for this contact. *nothing on the list. yet.*"

### Company profile — Tasks tab + Deliverables tab wired
- New "Tasks" tab in tab strip between Overview and Deliverables
- Queries `getTasksByEntity("company", companyId)` only when tab is active
- Empty state: "No tasks for this company. *clean slate. for now.*"
- **Deliverables tab** replaced from placeholder to real data: filters `getTasksByEntity()` results to `kind === 'client_deliverable'`
- Empty state: "No deliverables yet. *nothing owed. nothing pending.*"

### Tests — `tests/tm5-entity-tasks-panel.test.ts`
- 6 tests covering: entity query delegation, empty return, company entity filter, contact data contract, company data contract, deliverables kind filter

## New files
- `components/lite/admin/tasks/entity-tasks-panel.tsx`
- `tests/tm5-entity-tasks-panel.test.ts`

## Edited files
- `components/lite/admin/contacts/contact-tab-strip.tsx` — added "tasks" tab type + entry
- `app/lite/admin/contacts/[id]/page.tsx` — added tasks import, data load, tab rendering
- `components/lite/admin/companies/company-tab-strip.tsx` — added "tasks" tab type + entry
- `app/lite/admin/companies/[id]/page.tsx` — added tasks import, data load, tasks + deliverables tab rendering, removed placeholder `DeliverablesTab` import

## Verification
- `npx tsc --noEmit` — zero source errors (only `.next/dev/types` stale route cache, pre-existing from TM-2)
- `npx vitest run` — 231 files, 1988 passed, 1 skipped
- Browser check: contact profile Tasks tab renders empty state correctly, company profile Tasks + Deliverables tabs render correctly

## Key decisions
- Task rows in the panel link to `/lite/tasks?open={taskId}` — the task manager handles opening the detail drawer via query param. This keeps entity profiles as read-only views of tasks, not editing surfaces.
- Deliverables tab now uses the same `EntityTasksPanel` with a `kind === 'client_deliverable'` filter rather than a separate component — single rendering path, no drift
- Tasks appear split into Open/Closed sections (not a flat list) for quick scanning on profiles
- Panel is a server component (no client-side filtering) — profile pages are already server-rendered, and entity-scoped task lists are small enough not to need client-side filter controls

## Pre-existing issue noted
- Contact profile overview tab crashes with `SqliteError: no such column: "preferred_channel"` — this is a CCE-3 schema addition that hasn't been migrated in the dev database. Fixed locally via `ALTER TABLE` for testing. Not caused by TM-5.

## Rollback
- Git-revertable: no migrations, no data shape changes
- All files are additive (new component + test) or minor edits (tab additions)
- Removing the new tab entries + reverting page edits + deleting new files restores prior state

## Settings keys consumed
- None

## Next session should know
- TM-6 builds approval workflow (`approveDeliverable()` primitive)
- TM-7 builds morning digest email
- TM-8 builds the morning digest cron handler
- The `EntityTasksPanel` is reusable — any future entity profile (deal cards, client portal) can import it
- The link format `/lite/tasks?open={taskId}` for deep-linking into the task drawer is not yet implemented on the tasks page — TM-2's `tasks-page-client.tsx` doesn't read an `open` query param. A polish session can wire this up. Currently the link navigates to `/lite/tasks` (the task list) without auto-opening the drawer.
