# HP-14 Handoff — Hiring Pipeline: Contractor Portal Sub-pages

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Four contractor portal pages — spec §10.3

All four sub-pages that were stubbed in the bench shell nav from HP-13:

- **`/bench/assignments`** — list of active (pending/redelivered) and completed (shipped/archived) tasks. Each active task has a "Submit deliverable" button that expands to a URL input field. Submitting marks the task as `shipped` with `delivered_at_ms` set.
- **`/bench/invoices`** — contractor submits invoices (amount + reference + optional notes). New invoice form expands inline. Invoice list shows status chips (submitted/approved/paid/rejected) with matching icons.
- **`/bench/availability`** — pause/resume toggle with optional `paused_until` date picker. Weekly capacity slider (1–60h) with save button. Both update the `candidates` table directly.
- **`/bench/profile`** — read-only view of name, email, location, rate, ABN, legal name, bank details (masked). Rate/ABN/legal name/bank details edits queue as `candidate_edit_requests` (pending Andy approval). Portfolio URLs editable inline with add/remove; saving clears `portfolio_signal_fetched_at_ms` to trigger re-ingestion.

### New tables

- **`contractor_invoices`** — `id`, `candidate_id` (FK cascade), `amount_aud`, `reference`, `pdf_filename`, `notes`, `status` (submitted/approved/paid/rejected), `submitted_at_ms`, `reviewed_at_ms`, timestamps. Migration: `0060_hp14_bench_portal_subpages.sql`.
- **`candidate_edit_requests`** — `id`, `candidate_id` (FK cascade), `field_name`, `old_value`, `new_value`, `status` (pending/approved/rejected), `created_at_ms`, `reviewed_at_ms`. Same migration.

### Server actions — `app/bench/(authenticated)/actions.ts`

6 server actions, all session-guarded via `getBenchSession()`:
- `submitDeliverableAction(taskId, deliveryUrl)` — marks task shipped
- `submitInvoiceAction(amountAud, reference, notes?)` — creates invoice row
- `togglePauseAction(pause, pausedUntilMs?)` — toggles bench pause status
- `updateCapacityAction(weeklyCapacityHours)` — updates weekly capacity
- `requestProfileEditAction(fieldName, newValue)` — queues edit request
- `updatePortfolioUrlsAction(urls)` — updates portfolio URLs, clears signal cache

### Activity log kinds added (6)

- `contractor_deliverable_submitted`
- `contractor_invoice_submitted`
- `contractor_availability_updated`
- `contractor_pause_toggled`
- `contractor_profile_edit_requested`
- `contractor_portfolio_updated`

## New files

- `lib/db/schema/contractor-invoices.ts`
- `lib/db/schema/candidate-edit-requests.ts`
- `lib/db/migrations/0060_hp14_bench_portal_subpages.sql`
- `app/bench/(authenticated)/actions.ts`
- `app/bench/(authenticated)/assignments/page.tsx`
- `app/bench/(authenticated)/invoices/page.tsx`
- `app/bench/(authenticated)/availability/page.tsx`
- `app/bench/(authenticated)/profile/page.tsx`
- `components/lite/bench/assignments-list.tsx`
- `components/lite/bench/invoices-surface.tsx`
- `components/lite/bench/availability-surface.tsx`
- `components/lite/bench/profile-surface.tsx`
- `tests/hp14-bench-subpages.test.ts` (9 tests)

## Edited files

- `lib/db/schema/index.ts` — added `contractor-invoices` + `candidate-edit-requests` exports
- `lib/db/schema/activity-log.ts` — added 6 contractor portal activity log kinds

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 249 files, 2358 passed, 1 skipped (pre-existing)
- Browser check: not applicable (auth flow requires live magic-link email; validated via typecheck + 9 new tests)

## Key decisions

- **Approval-gated profile edits via `candidate_edit_requests`** — rate, ABN, legal name, and bank detail changes don't take effect immediately. They're queued for Andy's review on the admin side (admin approval UI is not in HP-14 scope).
- **Portfolio URL edits are direct** — unlike compliance fields, portfolio URLs are non-sensitive. Updating clears the signal cache so the portfolio ingestion pipeline re-processes them.
- **No PDF upload for invoices** — the `pdf_filename` column exists in the schema for future use, but the initial contractor-facing form only captures amount + reference + notes. PDF upload attachment is a future enhancement.
- **Deliverable submission sets `disposition = 'shipped'`** — matching the existing trial_tasks workflow. Andy reviews on the admin trial review surface.

## Rollback

- Git-revertable: all new files are additive. Edits to existing files are additive (new enum values, new schema exports). No existing function signatures changed.

## Settings keys consumed

- None new.

## Next session should know

- **Admin-side approval UI** — `candidate_edit_requests` rows are inserted but there's no admin surface to approve/reject them yet. That's likely a follow-up session or part of a Cockpit waiting-item integration.
- **Admin-side invoice review** — `contractor_invoices` rows with `status = 'submitted'` need an admin surface to approve/reject/mark paid. Finance Dashboard (Wave 19) may own this.
- **PDF invoice upload** — schema supports `pdf_filename` but the form doesn't include file upload. Future enhancement.
- **Remaining HP sessions:** HP-15 (Role Brief regeneration cycle), HP-16 (sounds + motion), HP-17 (bench pause ending cron + availability helpers), HP-18/HP-19 TBD. Plus §14 Daily Cockpit integration.
