# SWP-3 Handoff — Six-Week Plan Generator: Pipeline + Review UI

**Date:** 2026-04-19
**Wave:** 15
**Status:** COMPLETE

## What was built

- **Generator pipeline** (`lib/six-week-plan/generate.ts`):
  - `generateSixWeekPlan()` — stage 1 strategy outline via Opus
  - `generateWeeksFromStrategy()` — stage 2 per-week elaboration via Opus + self-review via Haiku
  - `runFullPipeline()` — chained stage 1 → stage 2 entry point
  - Self-review retry: one retry with issues injected, configurable via `plan.self_review_retry_on_fail`
  - External call log entries with token counts + estimated AUD cost per stage
  - Activity log entries at each state transition

- **`invokeLlmTextWithMeta()`** added to `lib/ai/invoke.ts` — returns `{ text, inputTokens, outputTokens }` for cost tracking

- **`plan_automations_enabled` kill switch** added to `lib/kill-switches.ts` (ships disabled)

- **Scheduled task handler** (`lib/scheduled-tasks/handlers/six-week-plan-generate.ts`) — gated on kill switch, delegates to `runFullPipeline()`

- **Server actions** (`lib/six-week-plan/actions.ts`):
  - `approveStrategy()` — approves outline, triggers stage 2 inline
  - `regenStrategy()` — enqueues regen with note via scheduled_tasks
  - `approveDetail()` — approves full plan (transitions to `approved`)
  - `regenWeeks()` — regens selected weeks or all, inline
  - `rejectToStrategy()` — clears weeks, reverts to strategy review
  - `pausePlan()` — leaves plan in current state
  - `getRegenWarningStatus()` — checks regen count against threshold

- **Data queries** (`lib/six-week-plan/queries.ts`) — `getPlanForReview()` with prospect/company join

- **Review UI** at `/lite/six-week-plans/[planId]/review`:
  - Strategy review: diagnosis, goal, primitives chips, theme arc, flagged assumptions with confidence badges + "Correct this" inline corrections
  - Detail review: plan intro, expandable week cards with tasks/angles/channels/signals, week selection for targeted regen
  - Self-review flagged warning banner (red, issues listed)
  - Regen soft warning at 4+ regens
  - Tab title rotation pool (3 variants)
  - House spring motion on all expand/collapse/enter transitions

## New files

- `lib/six-week-plan/generate.ts`
- `lib/six-week-plan/actions.ts`
- `lib/six-week-plan/queries.ts`
- `lib/scheduled-tasks/handlers/six-week-plan-generate.ts`
- `app/lite/six-week-plans/[planId]/review/page.tsx`
- `app/lite/six-week-plans/[planId]/review/_components/review-shell.tsx`
- `app/lite/six-week-plans/[planId]/review/_components/strategy-review.tsx`
- `app/lite/six-week-plans/[planId]/review/_components/detail-review.tsx`

## Edited files

- `lib/kill-switches.ts` — +1 switch (`plan_automations_enabled`)
- `lib/ai/invoke.ts` — +1 function (`invokeLlmTextWithMeta`)
- `lib/scheduled-tasks/handlers/index.ts` — +1 handler registration

## Verification

- `npx tsc --noEmit` — zero source errors
- `npx vitest run` — 223 files, 1846 passed, 1 skipped (unchanged)
- Dev server: `/lite/six-week-plans/test/review` returns 307 (auth redirect — correct)

## Key decisions

- `approveStrategy()` triggers stage 2 inline (not via scheduled_tasks) for faster feedback — Andy clicks "Approve & generate weeks" and the detail review loads on refresh
- `regenStrategy()` enqueues via scheduled_tasks since it re-runs the full pipeline from scratch
- `regenWeeks()` runs inline since it only re-runs stage 2
- Cost estimation uses static USD rates × 1.55 AUD conversion — good enough for Observatory v1.0
- Flagged assumption corrections collect into a regen note rather than building a structured corrections payload

## Rollback

- Kill-switch gated: `plan_automations_enabled` disables all generation
- Feature-flag gated: `features.six_week_plan_enabled` (per spec §19)
- Migration reversible (no new migrations in this session)
- Git-revertable: no data shape changes

## Next session should know

- SWP-4 builds the shoot-day notes form on the Trial Shoot panel (Pipeline) + the "Generate plan" button that enqueues `six_week_plan_generate`
- The review UI is functional but has no route to reach it yet — it needs the Pipeline panel to create plan rows and link to the review page
- Revision flow (§7) is SWP-7 scope — the review UI built here does NOT include the revision-review surface
- Portal plan surface is SWP-6 scope — this session only built the admin review side
