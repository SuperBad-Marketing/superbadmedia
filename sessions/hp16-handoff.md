# HP-16 Handoff — Hiring Pipeline: Sounds + Motion

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

Per spec §16, all sound + motion for the Hiring Pipeline inherits from existing design system primitives. No new sound slots or Tier 2 choreographies — wiring only.

### Sound wiring — trial-review-client.tsx

- Replaced bare `toast` (sonner) with `useToastWithSound` throughout.
- "Ship it" (shipped) → `deliverable-complete` sound.
- "Archive" → `error` sound.
- "Request revision" (redelivered) → `kanban-drop` sound.
- Mark delivered → `deliverable-complete` sound.
- All error toasts → `error` sound.

### Sound wiring — hiring-board.tsx

- Archive confirmation toast now plays `kanban-drop` (was silent before).
- Other sounds (kanban-drop on drag, quote-accepted on bench entry) were already wired.

### Tier 2 choreography + sound — contractor-onboarding-flow.tsx

- Final step (step 3 "Complete onboarding") now triggers:
  - `quote-accepted` sound on successful completion.
  - `wizard-complete` Tier 2 choreography (scale pulse → resolve) with "You're in." message.
  - 1.2s delay before redirect to `/bench` — lets the choreography play.
- Imports added: `tier2` from choreographies, `useSound` from sound-provider.

### Sound wiring — bench sub-pages (4 surfaces)

All four contractor portal sub-pages from HP-14 wired with `useSound`:

- **assignments-list.tsx** — `deliverable-complete` on successful deliverable submission.
- **invoices-surface.tsx** — `deliverable-complete` on successful invoice submission.
- **availability-surface.tsx** — `kanban-drop` on pause toggle (both directions) + capacity save.
- **profile-surface.tsx** — `kanban-drop` on profile edit request submission + portfolio URL save.

## Sound mapping summary (spec §16 inheritance)

| Interaction | Sound key | Inherits from |
|---|---|---|
| Kanban drag/drop | `kanban-drop` | Sales Pipeline |
| Bench entry | `quote-accepted` | Positive commitment |
| Archive (kanban) | `kanban-drop` | State transition |
| Trial "Ship it" | `deliverable-complete` | Approval |
| Trial "Archive" | `error` | Negative outcome |
| Trial "Revision" | `kanban-drop` | State transition |
| Wizard completion | `quote-accepted` | Positive commitment |
| Deliverable submit | `deliverable-complete` | Completion |
| Invoice submit | `deliverable-complete` | Completion |
| Pause/resume toggle | `kanban-drop` | State transition |
| Capacity save | `kanban-drop` | Confirmation |
| Profile edit request | `kanban-drop` | Confirmation |
| Portfolio save | `kanban-drop` | Confirmation |

## New files

- `tests/hp16-sounds-motion.test.ts` (12 tests)

## Edited files

- `components/lite/hiring-pipeline/trial-review-client.tsx` — replaced `toast` with `useToastWithSound`, added sound keys
- `components/lite/hiring-pipeline/hiring-board.tsx` — added `kanban-drop` sound to archive toast
- `components/lite/bench/contractor-onboarding-flow.tsx` — added Tier 2 wizard-complete choreography + quote-accepted sound on completion
- `components/lite/bench/assignments-list.tsx` — added `useSound` + deliverable-complete on submit
- `components/lite/bench/invoices-surface.tsx` — added `useSound` + deliverable-complete on submit
- `components/lite/bench/availability-surface.tsx` — added `useSound` + kanban-drop on toggle/save
- `components/lite/bench/profile-surface.tsx` — added `useSound` + kanban-drop on edit/save

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 251 files, 2381 passed, 1 skipped (pre-existing)
- Browser check: not applicable (sound files not yet sourced; validated via typecheck + 12 new tests)

## Key decisions

- **Apply form left untouched** — already has full motion (form entrance, submit button hover/tap, error AnimatePresence). Adding sound to a public-facing form would be unusual and the spec says "inherit Tier-1" which it already does.
- **`kanban-drop` for state-transition confirmations** — used across bench sub-pages for pause/resume, saves, and edit requests. It's the project-wide "something moved" sound.
- **`deliverable-complete` for submission confirmations** — used for deliverable delivery, invoice submission, and trial review "shipped". More positive than kanban-drop, appropriate for completion actions.
- **1.2s completion delay in onboarding** — lets the Tier 2 wizard-complete choreography (900ms) play before redirecting. The "You're in." message shows during this window.

## Rollback

- Git-revertable: all changes are additive import additions and function calls. No existing function signatures changed. No schema changes.

## Settings keys consumed

- None new.

## Next session should know

- **HP-17** — bench pause ending cron + availability helpers. The `hiring_bench_pause_ending` scheduled task handler needs building.
- **Sound files still not sourced** — `play()` silently no-ops until MP3s land in `/public/sounds/approved/`. This is expected; sourcing is a separate admin session.
- **Apply form confirmation page** — `/apply/confirmation` could benefit from a subtle sound, but that page wasn't in HP-16 scope.
