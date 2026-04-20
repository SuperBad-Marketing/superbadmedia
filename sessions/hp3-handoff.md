# HP-3 Handoff — Hiring Pipeline: Admin Kanban Surface

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Admin kanban page — `app/lite/admin/hiring/page.tsx`

Server component at `/lite/admin/hiring`. Auth-gated (admin only). Loads all candidates, role briefs, trial tasks, and activity timestamps. Computes staleness per spec §13.1 thresholds via `settings.get()`. Builds `HiringCardCandidate` shape for the client board. Header with candidate count, stage count, stale count, admin-roommate voice.

### Server actions — `app/lite/admin/hiring/actions.ts`

- `transitionCandidateAction()` — auth-gated wrapper around `transitionCandidateStage()`, revalidates `/lite/admin/hiring`.
- `archiveCandidateAction()` — creates `candidate_archives` row + transitions to `archived`, all in one action.
- `skipTrialAction()` — wraps `transitionCandidateStage()` with skip-trial reason in meta, transitions Screened → Bench.

### Hiring board — `components/lite/hiring-pipeline/hiring-board.tsx`

Client-side board using `KanbanBoard` primitive. 7 columns. Pessimistic transitions (card moves only after server returns ok). Features:
- **Role Brief filter chips** — multi-select, shows open/paused briefs. Clear button when active.
- **Drag to Archived** → opens Archive modal.
- **Drag to Bench** → opens Bench confirm modal (compliance gate check).
- **All other drags** → direct transition via `transitionCandidateAction`.
- **Un-archive** → simple drag-out, no confirm needed (per spec §4.4).

### Candidate card — `components/lite/hiring-pipeline/candidate-card.tsx`

Two-tier card following Sales Pipeline pattern:
- **Tier 1 (always visible):** name, role, portfolio platform icons, rate, location, match-score chip (colour-coded), source chip.
- **Tier 2 (hover-expanded):** follow-up Q+A, compliance gate status (for Screened+), trial task summary with due date and disposition, last activity timestamp, Skip Trial button (Screened only).
- Stale-card treatment with dashed border + halo animation per design system.

### Archive modal — `components/lite/hiring-pipeline/archive-modal.tsx`

Full spec §4.5 taxonomy. Per-stage closed-list reasons (chip selector). Other requires ≥10 chars free-text. Disposition direction (we_archived / they_withdrew / mutual) with reason-based defaults. Optional reflection field (≤500 chars) for Role Brief feedback.

### Bench confirm modal — `components/lite/hiring-pipeline/bench-confirm-modal.tsx`

Uses `DestructiveConfirmModal` primitive. Two modes:
- **Compliance gate fails:** shows missing fields, no confirm, "Got it" dismisses.
- **Compliance gate passes:** type-to-confirm with candidate name.

### Skip trial modal — `components/lite/hiring-pipeline/skip-trial-modal.tsx`

Type candidate name + pick reason from 3-item closed list (Prior relationship / Strong referral / Immediate need). Logs `trial_skipped` via meta on the `transitionCandidateStage` call.

### Stage config — `components/lite/hiring-pipeline/stage-config.ts`

7-column config with tint tokens per stage. Bench column gets the warm gradient treatment (matching Won in Sales Pipeline). Archived gets muted.

### Empty states — `lib/copy/empty-states.ts`

7 new keys registered (`hiring.column.*`). Admin-roommate voice. No exclamation marks, no cheerleading.

## New files

- `app/lite/admin/hiring/page.tsx`
- `app/lite/admin/hiring/actions.ts`
- `components/lite/hiring-pipeline/stage-config.ts`
- `components/lite/hiring-pipeline/candidate-card.tsx`
- `components/lite/hiring-pipeline/hiring-board.tsx`
- `components/lite/hiring-pipeline/archive-modal.tsx`
- `components/lite/hiring-pipeline/bench-confirm-modal.tsx`
- `components/lite/hiring-pipeline/skip-trial-modal.tsx`
- `tests/hp3-hiring-kanban.test.ts` (16 tests)

## Edited files

- `lib/copy/empty-states.ts` — 7 new hiring column keys
- `tests/empty-states.test.ts` — updated count assertion (10 → 17)

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 238 files, 2144 passed, 1 skipped (pre-existing)
- Browser check: not applicable in this session (no dev server running; visual verification via browser deferred to next session with server running)

## Key decisions

- **Quick-Add deferred.** The spec lists Quick-Add (§13.6 / §5.3) as a separate component on the kanban page, but it involves LLM scoring + invite drafting. Left for HP-4 or whichever session owns the Quick-Add primitive.
- **Activity log lookup uses meta field.** The activity_log doesn't have a direct `candidate_id` column — candidate transitions log the id inside the `meta` JSON. The page extracts candidate_id from meta for last-activity lookup.
- **No `canDrop` restrictions.** Per spec §4.4 "Andy can drag any card to any stage" — all transitions are allowed. Guards live in the modals (Bench compliance gate) and in `validateCandidate()` on the server side.
- **Pessimistic updates only.** Cards don't move until the server action returns `{ok: true}`, matching the Sales Pipeline's discipline.
- **Archive → transition ordering.** `archiveCandidateAction` creates the archive row first, then transitions. If the transition fails, the archive row is still created but the candidate isn't moved — acceptable because the archive is a timeline entry, not a state mutation.

## Rollback

- Git-revertable: all new files are additive. Empty-state additions are additive. Test updates are backward-compatible.

## Settings keys consumed

- `hiring.staleness.sourced_days` (14)
- `hiring.staleness.invited_days` (10)
- `hiring.staleness.applied_days` (7)
- `hiring.staleness.screened_days` (5)
- `hiring.trial.delivery_grace_days` (3)

## Next session should know

- HP-4 should build Quick-Add (§5.3 / §13.6) — the persistent URL input bar on `/lite/hiring` that calls `ingestPortfolioUrl()` + scoring + invite drafting.
- The Role Brief filter only shows open/paused briefs. If all briefs are draft/filled, no filter chips render.
- The kanban currently loads ALL candidates in a single query. If candidate volume grows, pagination or virtualization may be needed — acceptable for v1.
- `archiveCandidateAction` doesn't fire the `hiring-archive-reflection-ingest` LLM call — that lands with the LLM wiring session (HP-15 or similar).
