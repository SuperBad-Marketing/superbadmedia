# FD-1 Handoff — Finance Dashboard: Data Model + Manual Expense Entry

**Date:** 2026-04-20
**Wave:** 19
**Status:** COMPLETE

## What was built

### 4 new Drizzle schema files

- `lib/db/schema/expenses.ts` — `expenses` table with 9 closed-list categories, 4 source types, 2 statuses, unique `(source, source_ref)` index for rollup idempotency, `candidate_id` FK for contractor payment tracking.
- `lib/db/schema/recurring-expenses.ts` — `recurring_expenses` table with frequency enum (monthly/quarterly/annual), status (active/paused), `next_fire_date`.
- `lib/db/schema/finance-snapshots.ts` — `finance_snapshots` table with PK on `snapshot_date`, JSON columns for metrics/projection/callouts/stale_flags, nullable narrative. Includes `FinanceMetrics` and `FinanceProjection` TypeScript interfaces.
- `lib/db/schema/compliance-milestones.ts` — `compliance_milestones` table for BAS/EOFY filed markers.

### Migration

- `lib/db/migrations/0061_fd1_finance_dashboard.sql` — creates all 4 tables with indexes. Breakpoint-separated per Drizzle convention.
- Journal entry added to `meta/_journal.json` (idx 61).

### Server actions

- `lib/finance/actions.ts` — `createExpenseAction`, `updateExpenseAction`, `confirmExpenseAction`, `bulkConfirmExpensesAction`, `getRecentExpenses`, `getExpensesByDateRange`, `getVendorSuggestions`. All auth-gated. Manual override flag auto-set when editing rollup rows. All mutations log to `activity_log`.

### UI components

- `components/lite/finance/expense-modal.tsx` — Dialog-based add/edit expense form. Amount (AUD inc GST), date, category select, vendor with autocomplete datalist, GST auto-calculation by category, description. Payment processing category shows block nudge with override flow per spec §3.4.
- `components/lite/finance/finance-dashboard-client.tsx` — Client component with expenses table (date, vendor, category, amount, GST, source badge, status badge), pending-review banner, persistent FAB for quick-add. Framer Motion transitions with house spring.

### Page

- `app/lite/finance/page.tsx` — Admin-gated server component. Three empty states: no Stripe + no data (connect Stripe CTA), Stripe connected + no data, has data (full table + Export link). Loads recent 50 expenses, pending-review count, vendor suggestions.

### Schema index

- `lib/db/schema/index.ts` — 4 new re-exports added.

## New files

- `lib/db/schema/expenses.ts`
- `lib/db/schema/recurring-expenses.ts`
- `lib/db/schema/finance-snapshots.ts`
- `lib/db/schema/compliance-milestones.ts`
- `lib/db/migrations/0061_fd1_finance_dashboard.sql`
- `lib/finance/actions.ts`
- `components/lite/finance/expense-modal.tsx`
- `components/lite/finance/finance-dashboard-client.tsx`
- `app/lite/finance/page.tsx`
- `tests/fd1-expenses.test.ts`

## Edited files

- `lib/db/schema/index.ts` — 4 new exports
- `lib/db/migrations/meta/_journal.json` — migration 61 entry

## Verification

- `npx tsc --noEmit` — zero new errors (2 pre-existing in hp19 test file)
- `npx vitest run` — 255 files, 2416 passed, 1 skipped
- Browser check: page is server-rendered; verified via typecheck + pattern matching with existing admin pages

## Rollback

- Git-revertable: all new files additive, two edits are index additions only

## Key decisions

- **Amounts stored in cents** — consistent with invoices, quotes, deals across the codebase.
- **`expense_date` as text (YYYY-MM-DD)** — matches spec's date-level granularity; no timestamp needed for expense date.
- **GST auto-calculation per category** — Australian domestic categories default to 10/(1+10) of amount; foreign API costs default to null (no GST); manual override always available.
- **Payment processing block nudge** — spec §3.4's two-step flow: block first, "I know, let me override" button reveals the form. On edit of existing expense, no block (already committed).
- **Vendor autocomplete via HTML datalist** — lightweight, no dependency. Pulls distinct vendors from existing expenses.

## Settings keys consumed

All 11 `finance.*` keys from `docs/settings-registry.md` are already seeded. This session's code doesn't read them yet — Sessions B/C/D consume them for crons, projection, and banners.

## Next session should know

- **FD-2 (Session B)** — Projection logic + roll-up crons + recurring expense booking + Stripe Balance API. This session creates the `finance_snapshot_take` cron and the projection calculation module.
- **Pre-existing hp19 test TS errors** — 2 `TS2345` errors in `tests/hp19-briefing-signals.test.ts`. Tests still pass at runtime; cosmetic type issue with mock DB function signatures.
- **No nav link yet** — `/lite/finance` exists but isn't wired into the admin shell nav. That typically happens when the first full UI session (FD-3/Session C) lands the dashboard layout.
