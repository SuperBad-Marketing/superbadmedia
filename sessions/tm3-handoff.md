# TM-3 Handoff — Task Manager: Braindump Modal UI

**Date:** 2026-04-20
**Wave:** 17
**Status:** COMPLETE

## What was built

### Stub parser — `lib/ai/parse-braindump.ts`
- Types: `ParsedTask`, `ParsedBraindump`, `SurfaceContext`, `EntityCandidate`
- Stub `parseBraindump()` splits text by newlines, each line becomes a task with default kind=admin, priority=normal, low confidence scores
- TM-4 replaces this stub with a real Haiku call via `invokeLlmText`

### Server actions — `app/lite/tasks/braindump-actions.ts`
- `parseBraindumpAction(rawText, surfaceContext)` — calls parseBraindump, returns parsed result
- `commitBraindumpAction(rawText, surfaceContext, tasks)` — creates braindump row, creates tasks with `source_braindump_id` FK, marks braindump committed, logs `braindump_committed` activity
- Both gated on `auth()` admin check

### Braindump FAB — `components/lite/braindump/braindump-fab.tsx`
- Fixed bottom-right floating button (z-40, rounded-full, surface-2 bg)
- PenSquare icon from lucide-react
- Opens braindump modal on click
- Registers global `Cmd+Shift+D` keyboard shortcut
- Pulses once per day on first session (tracked via localStorage)
- Reduced-motion aware (skips pulse animation)

### Braindump modal — `components/lite/braindump/braindump-modal.tsx`
- Four-phase flow: input → parsing → review → committing
- **Input phase:** textarea with italic placeholder "dump it. we'll file it.", Parse button (disabled when empty), Cmd+Enter triggers parse, keyboard shortcut hint in footer
- **Parsing phase:** textarea locks, shimmer loading state (3 skeleton cards with CSS shimmer animation)
- **Review phase:** stack of proto-task cards, each with:
  - Editable title with confidence dot
  - Kind dropdown (colour-coded per existing KIND_COLORS map)
  - Priority dropdown
  - Due date with natural-language parsing (reused from task-detail-drawer)
  - Entity link with autocomplete search (reuses `searchEntitiesAction`)
  - Entity swap affordance (⇄) for alternatives from parser
  - Delete card (✗)
  - All fields have confidence indicator dots (green/orange/grey)
- Back button returns to input; Re-parse button re-triggers parse
- **Commit:** creates tasks silently (no toast per spec), closes modal
- Framer Motion: houseSpring for panel enter/exit, card layout animations, AnimatePresence for card removal
- Escape key closes modal
- Overlay click closes modal
- Reduced-motion support throughout
- ARIA: `role="dialog"`, `aria-modal="true"`, `aria-label="Braindump"`

### Admin shell mount — `components/lite/admin-shell-with-nav.tsx`
- Added `BraindumpFab` as sibling to `AdminShell` inside the density wrapper
- Available on every admin surface that uses `AdminShellWithNav`

## New files
- `lib/ai/parse-braindump.ts`
- `app/lite/tasks/braindump-actions.ts`
- `components/lite/braindump/braindump-fab.tsx`
- `components/lite/braindump/braindump-modal.tsx`

## Edited files
- `components/lite/admin-shell-with-nav.tsx` — import + mount BraindumpFab

## Verification
- `npx tsc --noEmit` — zero source errors
- `npx vitest run` — 229 files, 1971 passed, 1 skipped
- Manual browser check — full flow verified: FAB visible, modal opens, text entry, Cmd+Enter parse, proto-task cards render, commit creates tasks in DB, modal closes silently, tasks appear in list. FAB also confirmed on `/lite/content` (cross-surface availability)

## Key decisions
- Stub parser (TM-4 replaces): splits by newlines, low confidence scores, admin kind default
- Custom Framer Motion modal (not Dialog primitive) for animation consistency with drawer pattern
- Natural-language date parsing duplicated from task-detail-drawer rather than extracting a shared util (both are small, extraction is TM cleanup scope)
- Entity search reuses existing `searchEntitiesAction` from tasks actions
- SurfaceContext prop flows from FAB → modal → server action, ready for per-surface context injection when other specs mount the braindump

## Rollback
- Git-revertable: no migrations, no data shape changes
- All files are additive — removing FAB from admin-shell-with-nav + deleting new files restores prior state

## Settings keys consumed
- None in TM-3

## Next session should know
- TM-4 builds `parseBraindump()` real Claude call — replace the stub in `lib/ai/parse-braindump.ts`
- The modal already handles alternatives, confidence indicators, and entity swap — TM-4 just needs to return rich `ParsedBraindump` data and the UI renders it
- SurfaceContext plumbing is in place but no surface currently passes context — future specs that mount braindump from entity profiles should pass `{ entityType, entityId }`
- The braindump FAB does NOT appear on surfaces that don't use `AdminShellWithNav` (e.g., inbox has its own layout) — if braindump is wanted on inbox, the FAB needs to be mounted there separately
- `commitBraindumpAction` logs `braindump_committed` — the `braindump_parsed` activity kind is TM-4's responsibility (logged when parse returns)
