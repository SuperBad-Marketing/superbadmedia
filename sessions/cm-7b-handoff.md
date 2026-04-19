# `CM-7b` — Portal deliverables page — Handoff

**Closed:** 2026-04-18
**Type:** UI (small)
**Model tier:** Sonnet

---

## What was built

### 1. Task type definitions (`lib/tasks/types.ts`)

- `TaskKind` union (5 values), `TaskStatus` union (7 values), `ChecklistItem`, `PortalTask` — matches Task Manager spec schema exactly.
- Exported `TASK_KINDS` and `TASK_STATUSES` const arrays for runtime use.
- Stub until TM-1 builds the `tasks` Drizzle schema.

### 2. Portal task query stubs (`lib/tasks/portal.ts`)

- `getTasksForClientPortal(companyId, options?)` — returns empty array. TM-1 replaces with real queries.
- `approveDeliverable(taskId, contactId)` — returns `{ ok: false }` stub.
- `rejectDeliverable(taskId, contactId, feedback)` — returns `{ ok: false }` stub.

### 3. Deliverables header (`components/lite/portal/deliverables-header.tsx`)

- Animated header matching mockup: Righteous eyebrow (dynamic: "X of Y complete" or "your room"), Black Han Sans "Deliverables" heading, Playfair italic subtitle.
- Reduced-motion support.

### 4. Deliverables list (`components/lite/portal/deliverables-list.tsx`)

- Full deliverables UI matching `mockup-client-portal.html`:
  - Expandable cards with houseSpring animation (click to expand/collapse).
  - Status badges: awaiting (orange), in-progress (pink), delivered (green), blocked (red).
  - Checklist progress bar (animated fill).
  - Expanded panel: checklist items with done/pending icons, approve/reject actions, download button.
  - Reject flow: toggle "Request changes" → textarea → "Send feedback".
  - In-progress message in Playfair italic.
  - Empty state: "nothing here yet. when there is, you'll know."
- Tasks grouped into three sections: "Awaiting your approval" → "In progress" → "Delivered".
- Staggered entrance animation per section.
- All actions route through server actions with `useTransition`.

### 5. Server actions (`app/lite/portal/[token]/deliverables/actions.ts`)

- `handleApprove(taskId)` — portal-session-gated, calls `approveDeliverable`.
- `handleReject(taskId, feedback)` — portal-session-gated, validates non-empty feedback, calls `rejectDeliverable`.

### 6. Page update (`app/lite/portal/[token]/deliverables/page.tsx`)

- Replaced placeholder with real page: queries tasks via `getTasksForClientPortal`, renders header + list.
- Logs `deliverables_viewed` activity on page load.
- Accessible in both pre-retainer and retainer modes (per spec §10.9).

### New files (5)

| File | Purpose |
|---|---|
| `lib/tasks/types.ts` | Task type definitions matching TM spec |
| `lib/tasks/portal.ts` | Portal query + action stubs |
| `components/lite/portal/deliverables-header.tsx` | Animated page header |
| `components/lite/portal/deliverables-list.tsx` | Full deliverables list + cards |
| `app/lite/portal/[token]/deliverables/actions.ts` | Server actions for approve/reject |
| `tests/cm7b-deliverables.test.ts` | 11 tests |

### Edited files (1)

| File | Change |
|---|---|
| `app/lite/portal/[token]/deliverables/page.tsx` | Replaced placeholder with real deliverables page |

## Key decisions

1. **Stub functions, not stub tables.** The `tasks` table is Wave 17 (TM-1). Rather than creating the table early, the type definitions and query functions are defined as typed stubs that return empty results. TM-1 replaces the stub implementations with real Drizzle queries — the interface stays the same.

2. **No download implementation.** Download buttons are present in the UI but have no handler — deliverable file storage is not yet built. The buttons exist for structural completeness.

3. **Three-section grouping.** Tasks are grouped by status: "Awaiting your approval" (orange, action-oriented) → "In progress" (informational) → "Delivered" (green, download-oriented). This matches the mockup's visual hierarchy.

4. **No mode gating.** The spec says deliverables are accessible in both pre-retainer and retainer modes. The `getPortalMode` call was removed from the page.

## What the next session should know

- **CM-8** builds the retainer-mode kickoff. Should check `bundled_hub_seen_at_ms` when deciding tour vs kickoff (per CM-7 handoff).
- **TM-1** (Wave 17) replaces `lib/tasks/portal.ts` stubs with real queries against the `tasks` table. The `PortalTask` type in `lib/tasks/types.ts` should match or extend the Drizzle schema.
- **TM-7** (Wave 17) implements the real `approveDeliverable()` and `rejectDeliverable()` functions.
- The download button in the deliverables list has no handler — file storage + download URLs are a TM concern.
- No migration, no schema changes, no new settings keys.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 205 files, 1730 passed, 0 failures, 1 skipped
- `npm run build` — clean, `/lite/portal/[token]/deliverables` in build output
- No browser check (portal requires live auth session + tasks data; structural correctness validated via typecheck + tests + component review against mockup)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable.** No migrations, no data shape changes. All changes are new files (types, stubs, components, actions, tests) plus one page replacement. Reverting the commit restores the placeholder page.
