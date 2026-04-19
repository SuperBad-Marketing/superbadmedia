# SWP-1 Handoff — Six-Week Plan Generator: Data Model + Migrations + Helpers + Prompt Stubs

**Date:** 2026-04-19
**Wave:** 15
**Status:** COMPLETE

## What was built

- **3 new schema files:**
  - `lib/db/schema/six-week-plans.ts` — `six_week_plans` table with all columns from spec §10.1 (status lifecycle, stage outputs, revision fields, retainer migration, non-converter expiry)
  - `lib/db/schema/six-week-plan-task-progress.ts` — `six_week_plan_task_progress` table for prospect self-run task check-offs
  - `lib/db/schema/trial-shoot-notes.ts` — `trial_shoot_notes` table for Andy's post-shoot structured form (6 infrastructure fields with enums, goals JSON, 4 shoot-day signals, observations, enrichment audit trail)

- **Migration:** `lib/db/migrations/0053_swp1_six_week_plan.sql` — creates all 3 tables with indexes + FKs + journal entry

- **3 missing activity_log kinds added:** `six_week_plan_retainer_payment_queued_pending_refresh_review`, `six_week_plan_retainer_week_1_activated`, `six_week_plan_expiry_email_sent`

- **4 scheduled task types registered:** `six_week_plan_generate`, `six_week_plan_migrate_on_won`, `six_week_plan_expiry_email`, `six_week_plan_non_converter_expiry`

- **1 email classification added:** `six_week_plan_non_converter_expiry` (+ 5 existing SWP classifications promoted to transactional list)

- **4 prompt file stubs:** `lib/ai/prompts/six-week-plan/{strategy,weeks,review,revision-reply}.ts` — typed input/output interfaces + stub builder functions. Content populated by content mini-session before SWP-2.

- **Context assembly helper:** `lib/six-week-plan/assemble-context.ts` — `assembleSixWeekContext(dealId)` gathers intake questionnaire, enrichment profile, shoot-day notes, Brand DNA (optional), and trial shoot offer constant into a typed `SixWeekContextBundle`.

## Pre-existing registrations confirmed

- Activity log kinds (17 of 20 pre-seeded, 3 added this session)
- Settings keys (10 plan.* keys already in `lib/settings.ts`)
- LLM model registry (4 jobs already in `lib/ai/models.ts`)
- Email classifications (6 SWP classifications already registered, 1 added + 5 promoted to transactional)

## New files

- `lib/db/schema/six-week-plans.ts`
- `lib/db/schema/six-week-plan-task-progress.ts`
- `lib/db/schema/trial-shoot-notes.ts`
- `lib/db/migrations/0053_swp1_six_week_plan.sql`
- `lib/ai/prompts/six-week-plan/strategy.ts`
- `lib/ai/prompts/six-week-plan/weeks.ts`
- `lib/ai/prompts/six-week-plan/review.ts`
- `lib/ai/prompts/six-week-plan/revision-reply.ts`
- `lib/six-week-plan/assemble-context.ts`
- `sessions/swp1-handoff.md`

## Edited files

- `lib/db/schema/index.ts` — +3 exports
- `lib/db/schema/activity-log.ts` — +3 kinds
- `lib/db/schema/scheduled-tasks.ts` — +4 types
- `lib/channels/email/classifications.ts` — +1 classification, +5 to transactional list
- `lib/db/migrations/meta/_journal.json` — +1 entry

## Verification

- `npx tsc --noEmit` — zero source errors
- `npx vitest run` — 223 files, 1846 passed, 1 skipped (unchanged)

## Key decisions

- Prompt stubs use typed interfaces for input/output — content mini-session fills the `build*Prompt()` function bodies
- `assembleSixWeekContext` queries Brand DNA sequentially after deal (needs `company_id`), not in parallel
- Trial shoot notes uses typed enums for all 6 infrastructure radio fields (spec §3.1)
- Drizzle migration written manually due to drizzle-kit snapshot collision — SQL validated by full test suite pass

## Next session should know

- SWP-2 is the content mini-session (prompt content population) — must complete before SWP-3
- SWP-3 builds the generator pipeline (stages 1 + 2 + self-review) consuming these prompt stubs
- The `TRIAL_SHOOT_OFFER` constant is hardcoded in `assemble-context.ts` — if the Intro Funnel trial-shoot-facts memory patch lands a constant elsewhere, wire it through
- Drizzle-kit `generate` has a snapshot collision issue (0012/0052 parent collision) — future migrations should also be written manually until resolved
