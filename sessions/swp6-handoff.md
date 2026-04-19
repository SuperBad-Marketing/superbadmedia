# SWP-6 Handoff — Retainer Migration + Refresh-Review Surface

**Date:** 2026-04-20
**Wave:** 15
**Status:** COMPLETE

## What was built

- **`active_strategies` table** (`lib/db/schema/active-strategies.ts` + migration `0054_swp6_active_strategies.sql`):
  - Forward dependency for CCE-1 (Wave 16). Schema per CCE spec §12.5: id, client_id (unique), origin, source_id, status (pending_refresh_review/live/archived), payload_json, pending_refresh_review flag, timestamps
  - Registered in schema index

- **Migration handler** (`lib/six-week-plan/migration.ts`):
  - `migratePlanOnWon(dealId, companyId)` — finds latest approved/released plan, copies `{intro, weeks_json, chosen_primitives, theme_arc}` into `active_strategies` row, stamps `migrated_to_client_context_at_ms` + `retainer_payment_received_at_ms` on source plan
  - Archives any existing active_strategy for the same client before creating new
  - Logs `six_week_plan_migrated_to_client_context` + `active_strategy_created` activities

- **Scheduled task handler** (`lib/scheduled-tasks/handlers/six-week-plan-migration.ts`):
  - `six_week_plan_migrate_on_won` task type handler, kill-switch gated on `plan_automations_enabled`
  - Registered in handler index

- **Deal-won hook** (`lib/crm/finalise-deal.ts`):
  - After transaction completes, enqueues `six_week_plan_migrate_on_won` task with `deal_id` + `company_id`
  - Fire-and-forget (`.catch(() => {})`) so migration failure doesn't block deal finalization

- **Refresh-review queries** (`lib/six-week-plan/refresh-review-queries.ts`):
  - `getRefreshReviewData(companyId)` — loads active_strategy + source plan + client info for the admin review surface

- **Refresh-review server actions** (`lib/six-week-plan/refresh-review-actions.ts`):
  - `approveRefreshReview(id)` — sets active_strategy to live, clears pending_refresh_review, stamps refresh_reviewed_at_ms, fires retroactive Week 1 if payment was queued
  - `regenerateForRetainer(id, note)` — enqueues regen with retainer context note injected
  - `saveHandEditedStrategy(id, editedWeeks)` — updates payload_json with hand-edited weeks, sets live, fires retroactive Week 1
  - `maybeFireRetroactiveWeek1()` — checks retainer_payment_received_at_ms; if set, activates plan with `activation_path: 'retainer_payment'` and logs `six_week_plan_retainer_week_1_activated` with trigger: `refresh_review_publish`

- **Refresh-review admin route** (`app/lite/admin/clients/[companyId]/strategy/refresh-review/`):
  - Page server component with auth gate + metadata
  - `RefreshReviewShell` client component: two-column layout, left shows migrated plan (read-only or inline edit mode), right shows chosen primitives + three action buttons
  - Three modes: approve as-is, regenerate against retainer scope (textarea for context note), hand-edit weeks (inline inputs in left panel)
  - Done state after any action with link back to company

- **Portal plan-view retainer state** (`components/lite/portal/plan-view.tsx` + `lib/six-week-plan/portal-queries.ts`):
  - `PortalPlanData` extended with `retainerState: { isRetainer, pendingRefreshReview, paymentReceivedBeforeReview, strategyIsLive }`
  - Portal queries now check `active_strategies` table for retainer state
  - Pending-refresh-review band with two copy variants: pre-payment ("Andy's doing a pass on this before we kick off") and post-payment ("Kicking off Week 1 shortly — Andy's finalising the refreshed plan")
  - "Start Week 1" button suppressed for retainer-path plans
  - Title switches from "Your Six-Week Plan" to "Your Strategy" when active_strategy is live
  - Revision request suppressed for retainer-path plans

## New files

- `lib/db/schema/active-strategies.ts`
- `lib/db/migrations/0054_swp6_active_strategies.sql`
- `lib/six-week-plan/migration.ts`
- `lib/six-week-plan/refresh-review-queries.ts`
- `lib/six-week-plan/refresh-review-actions.ts`
- `lib/scheduled-tasks/handlers/six-week-plan-migration.ts`
- `app/lite/admin/clients/[companyId]/strategy/refresh-review/page.tsx`
- `app/lite/admin/clients/[companyId]/strategy/refresh-review/_components/refresh-review-shell.tsx`
- `sessions/swp6-handoff.md`

## Edited files

- `lib/db/schema/index.ts` — added active-strategies export
- `lib/db/migrations/meta/_journal.json` — added migration 0054 entry
- `lib/crm/finalise-deal.ts` — enqueues migration task after deal won
- `lib/scheduled-tasks/handlers/index.ts` — registered migration handler
- `lib/six-week-plan/portal-queries.ts` — added retainerState to PortalPlanData, queries active_strategies
- `components/lite/portal/plan-view.tsx` — retainer band, title switch, activation suppression

## Verification

- `npx tsc --noEmit` — zero source errors
- `npx vitest run` — 223 files, 1846 passed, 1 skipped (unchanged)
- Dev server: refresh-review route compiles (auth-gated 307), portal plan page compiles (token-gated redirect)

## Key decisions

- `active_strategies` table created now as forward dependency for CCE-1 (Wave 16), following CCE spec §12.5 schema exactly
- Migration enqueued as scheduled task (not inline in transaction) since `finaliseDealAsWon` is synchronous SQLite and migration needs async activity logging
- `retainer_payment_received_at_ms` stamped during migration (not separately from Stripe webhook) since the Won transition IS the payment event
- Retroactive Week 1 fires in the same call as refresh-review publish (approve or hand-edit) — no separate scheduled task needed
- Refresh-review route at `/lite/admin/clients/[companyId]/strategy/refresh-review` (under admin prefix, matching existing admin route convention)

## Rollback

- Kill-switch gated: `plan_automations_enabled` (migration handler)
- Feature-flag gated: `features.six_week_plan_enabled` (per spec §19)
- New table only — no existing table modifications (retainer columns on six_week_plans already existed from SWP-1)
- Git-revertable: new table can be dropped, no data shape changes to existing tables

## Next session should know

- SWP-7 through SWP-10 remain: revision-review queue (SWP-7 per BUILD_PLAN cron table), PDF render overlay (SWP-8), migrate-on-Won to CCE active_strategy (SWP-9 — may be reduced scope since migration handler is now built), non-converter expiry (SWP-10), E2E tests, settings audit
- The regen path in refresh-review enqueues `six_week_plan_generate` with a prefixed note — when the regenerated plan finishes, the active_strategy still shows the old payload. A post-regen hook to update the active_strategy payload isn't wired yet — that should be handled in a future session (either SWP-9 or a patch)
- Cockpit health banner for `six_week_plan_retainer_payment_without_refresh_review` (amber → red escalation per F4.a) is not yet implemented — belongs to DC wave (Wave 22) or a patch session
- The hand-edit mode only edits week themes and `why_this_week` — task-level inline editing is deferred (spec §8.2 says "Opens the plan JSON in an edit view for Andy to adjust specific weeks/tasks directly" — tasks can be added in a follow-up)
- Portal plan-view now reads `active_strategies` table — CCE-1 (Wave 16) should treat this table as a producer it consumes, not redefine
