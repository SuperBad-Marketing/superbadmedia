# SWP-7 Handoff — Revision-Review Queue Automation

**Date:** 2026-04-20
**Wave:** 15
**Status:** COMPLETE

## What was built

- **`plan_revision_review_queue` scheduled task type** — added to `SCHEDULED_TASK_TYPES` in `lib/db/schema/scheduled-tasks.ts`

- **Revision-queue handler** (`lib/scheduled-tasks/handlers/six-week-plan-revision-queue.ts`):
  - `handlePlanRevisionReviewQueue` — kill-switch gated on `plan_automations_enabled`
  - Loads deal + contact + company context from plan payload
  - Sends admin notification email to `ADMIN_EMAIL` with prospect name, business name, note preview, and direct link to revision-review page
  - Registered in handler index

- **Enqueue from portal** (`app/lite/portal/[token]/plan/actions.ts`):
  - `submitRevisionAction` now enqueues `plan_revision_review_queue` task after logging activity
  - Fire-and-forget (`.catch(() => {})`) so enqueue failure doesn't block the prospect's submission
  - Idempotency key prevents duplicate tasks per plan

- **Revision-regen email on approval** (`lib/six-week-plan/actions.ts`):
  - `approveDetail` now detects revision-triggered regen (plan has `revision_requested_at_ms` set but no `revision_resolution`)
  - On approval of a revision-regen plan: stamps `revision_resolution = 'regenerated'` + `revision_reply_sent_at_ms`, logs `six_week_plan_revision_regenerated` activity, fires `six_week_plan_revision_regenerated` email
  - `sendRevisionRegeneratedEmail()` helper: issues a magic-link portal URL pointing to the plan page, sends email with content per `docs/content/six-week-plan-generator.md` §7.3
  - Fire-and-forget so email failure doesn't break approval

## New files

- `lib/scheduled-tasks/handlers/six-week-plan-revision-queue.ts`
- `sessions/swp7-handoff.md`

## Edited files

- `lib/db/schema/scheduled-tasks.ts` — added `plan_revision_review_queue` task type
- `lib/scheduled-tasks/handlers/index.ts` — registered revision-queue handler
- `app/lite/portal/[token]/plan/actions.ts` — enqueue task from `submitRevisionAction`
- `lib/six-week-plan/actions.ts` — revision-regen detection + email + activity log in `approveDetail`

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 223 files, 1846 passed, 1 skipped (unchanged)
- `next build` — clean production build

## Key decisions

- Admin notification uses `ADMIN_EMAIL` env var (same pattern as inbox digest)
- Revision-regen email fires on `approveDetail` (not on generate completion) — this matches spec §7.3 "Fires when Andy approves the new version via the standard two-tier review"
- Magic-link issued per email for portal access, with callback to `/lite/portal/plan`
- Portal echo cards for revision replies already existed from SWP-5 (`RevisionReplyCard` component handles both regenerated and explained variants)

## Rollback

- Kill-switch gated: `plan_automations_enabled` (handler)
- No new migrations — uses existing schema columns
- Git-revertable: no data shape changes

## Next session should know

- SWP-8 through SWP-10 remain: PDF render overlay (SWP-8), migrate-on-Won to CCE active_strategy (SWP-9 — may be reduced scope since migration handler is built in SWP-6), non-converter expiry (SWP-10), E2E tests, settings audit
- The `six_week_plan_revision_regenerated` email body is plain text. If a rich HTML template is needed later, it can be swapped in the `sendRevisionRegeneratedEmail` helper
- Cockpit waiting-item integration (`six_week_plan_revision_request` as a waiting-item kind) is deferred to DC wave — the activity log entry + scheduled task data is there for the cockpit to query when it's built
- The post-regen hook to update `active_strategy` payload (noted in SWP-6 handoff) is still not wired — SWP-9 or a patch session should handle it
