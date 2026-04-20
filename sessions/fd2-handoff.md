# FD-2 Handoff — Finance Dashboard: Projection Logic + Roll-up Crons + Recurring Expense Booking

**Date:** 2026-04-21
**Wave:** 19
**Status:** COMPLETE

## What was built

### Projection calculation module — `lib/finance/projection.ts`

`computeProjection(nowMs)` returns a `FinanceProjection` with three 90-day forward curves:
- **Contracted curve:** active retainers + SaaS subscriptions, time-sliced by commitment tail and billing cadence.
- **Pipeline-weighted curve:** open deals weighted by stage probability (hardcoded defaults: lead 5%, contacted 10%, conversation 20%, trial_shoot 40%, quoted 60%, negotiating 75%, won 100%, lost 0%).
- **Decay-adjusted curve:** same as pipeline-weighted but with stage-age decay — probability halves every `finance.stage_age_decay_halflife_days` (default 30) past expected stage dwell time.

Horizon and decay halflife read from `settings.get()`.

### Snapshot metrics module — `lib/finance/snapshot.ts`

`computeSnapshotMetrics(nowMs)` returns all 9 `FinanceMetrics` fields: revenue MTD, expenses MTD, net, MRR, outstanding invoices, GST owed (this BAS quarter), income tax provisioned (YTD × rate), yours-to-spend (Stripe balance − GST − tax), Stripe balance. Also returns stale flags when Stripe API is unavailable.

Queries: deals (won + active subscription for MRR), invoices (paid for revenue, sent/overdue for outstanding), expenses (date range aggregation), Stripe Balance API. GST and income tax rates from `settings.get()`.

Australian FY (July–June) used for YTD profit calculation.

### 4 scheduled task handlers

- `finance_snapshot_take` — `lib/scheduled-tasks/handlers/finance-snapshot.ts`. Computes metrics + projection, upserts into `finance_snapshots` (idempotent per date), enqueues `finance_narrative_regenerate`.
- `finance_observatory_rollup` — `lib/scheduled-tasks/handlers/finance-observatory-rollup.ts`. Aggregates yesterday's `external_call_log` costs by job, upserts into `expenses` with `source='observatory_rollup'`. Respects `manual_override`.
- `finance_stripe_fee_rollup` — `lib/scheduled-tasks/handlers/finance-stripe-fee-rollup.ts`. Pulls Stripe Balance Transactions API for previous day, aggregates fees by type, upserts into `expenses` with `source='stripe_fees'`. GST calculated at 10% (AU Stripe fees). Respects `manual_override`.
- `recurring_expense_book` — `lib/scheduled-tasks/handlers/finance-recurring-expense-book.ts`. Books all due recurring expenses into `expenses` with `status='pending_review'`, advances `next_fire_date`.

All handlers registered in `lib/scheduled-tasks/handlers/index.ts`.

### Recurring expense server actions — `lib/finance/recurring-actions.ts`

`createRecurringExpenseAction`, `updateRecurringExpenseAction`, `toggleRecurringStatusAction`, `getRecurringExpenses`. All auth-gated, activity-logged.

### Recurring management screen — `/lite/finance/recurring`

Server page + `RecurringExpensesClient` component. Shows table with vendor, category, amount, frequency, next fire date, status (active/paused), edit/pause actions. Empty state with add button. Dialog form for add/edit with all fields (vendor, category, frequency, amount, GST, next fire date).

### Finance index — `lib/finance/index.ts`

Re-exports `computeProjection` and `computeSnapshotMetrics`.

## New files

- `lib/finance/projection.ts`
- `lib/finance/snapshot.ts`
- `lib/finance/recurring-actions.ts`
- `lib/finance/index.ts`
- `lib/scheduled-tasks/handlers/finance-snapshot.ts`
- `lib/scheduled-tasks/handlers/finance-observatory-rollup.ts`
- `lib/scheduled-tasks/handlers/finance-stripe-fee-rollup.ts`
- `lib/scheduled-tasks/handlers/finance-recurring-expense-book.ts`
- `components/lite/finance/recurring-expenses-client.tsx`
- `app/lite/finance/recurring/page.tsx`
- `tests/fd2-projection-crons.test.ts`

## Edited files

- `lib/scheduled-tasks/handlers/index.ts` — 4 new handler imports + spread into registry

## Verification

- `npx tsc --noEmit` — zero new errors (2 pre-existing in hp19 test file)
- `npx vitest run` — 256 files, 2438 passed, 1 skipped
- Browser check: `/lite/finance/recurring` renders, empty state shows, add modal opens with all fields

## Rollback

- Git-revertable: all new files additive. One edit to handlers/index.ts adds imports only.

## Key decisions

- **Stage probabilities hardcoded in projection module** — no `expected_close_date` column on deals, so probability × daily revenue rate used instead. Default probabilities: lead 5% → won 100%. Pipeline deals use `last_stage_change_at_ms` + expected dwell for decay calculation.
- **Australian FY (Jul–Jun) for YTD profit** — income tax provisioning uses financial year, not calendar year.
- **BAS quarter range** — standard calendar quarters (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec) for GST owed calculation.
- **Observatory rollup aggregates by `job` field** — not by a separate vendor field, since `external_call_log.job` is the canonical identifier.
- **Stripe fee GST at 10%** — Stripe AU charges include GST. `gst_amount = Math.round(totalCents / 11)`.
- **Contracted curve: daily revenue = monthly / 30** — simple daily slice for projection chart granularity.
- **Month-to-month subs project flat** — per spec: deals past commitment still project if billing cadence is monthly.

## Settings keys consumed

- `finance.projection_horizon_days` (default 90) — projection module
- `finance.stage_age_decay_halflife_days` (default 30) — projection module
- `finance.gst_rate` (default 0.10) — snapshot metrics
- `finance.income_tax_rate` (default 0.25) — snapshot metrics

## Next session should know

- **FD-3 (Session C)** — Dashboard UI + narrative prompt + drill-downs. This session builds the full `/lite/finance` layout, the Claude Haiku narrative, drill-down routes, tax provision tile, and mobile responsive pass.
- **`finance_narrative_regenerate` handler not yet built** — snapshot handler enqueues it, but the handler itself is Session C scope (needs the prompt + model registry job).
- **No nav link yet** — `/lite/finance/recurring` exists but isn't linked from the admin nav shell. Session C typically adds nav links when the full dashboard layout lands.
- **Pre-existing hp19 test TS errors** — still 2 cosmetic `TS2345` errors in `tests/hp19-briefing-signals.test.ts`.
