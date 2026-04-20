# FD-3 Handoff — Finance Dashboard: Dashboard UI + Narrative Prompt + Drill-downs + Tax Provision + Mobile

**Date:** 2026-04-20
**Wave:** 19
**Status:** COMPLETE

## What was built

### Narrative prompt builder — `lib/finance/narrative-prompt.ts`

`buildNarrativePrompt(input)` produces the full prompt string for the `finance-draft-narrative` Haiku job. Takes current snapshot + optional 30-day-prior comparison + range label + callout signals. Outputs structured JSON spec (`paragraph_text`, `number_references` with drill-down links, `callout_used`).

Callout types: `tax_tight`, `projection_cliff`, `overdue_heavy`, `first_profitable_month`.

### Narrative regenerate handler — `lib/scheduled-tasks/handlers/finance-narrative.ts`

`finance_narrative_regenerate` scheduled task handler. Loads today's snapshot + 30-day-prior comparison, detects callouts from metrics, calls `invokeLlmText({ job: "finance-draft-narrative" })`, validates structured JSON output, writes narrative back to `finance_snapshots.narrative_text`. On parse failure or validation failure, writes a fallback marker so the UI renders gracefully.

Registered in `lib/scheduled-tasks/handlers/index.ts`.

### Dashboard data module — `lib/finance/dashboard-data.ts`

`getDashboardData(rangeStart, rangeEnd)` returns everything the full dashboard UI needs in a single call: snapshot metrics, projection, parsed narrative, stale flags, previous metrics for MoM comparison, recent transactions (mixed income + expenses sorted by date), outstanding/overdue invoice counts, top 5 expense categories, MRR runway date.

### Full dashboard UI — `components/lite/finance/finance-full-dashboard.tsx`

Complete spec §8.1 layout:
- **P&L tile** (revenue, expenses, net with MoM delta badge)
- **90-day projection chart** (SVG: contracted area + pipeline dashed + decay faded)
- **Narrative card** with clickable number references linking to drill-downs
- **4-tile metric row** (MRR, Outstanding, Top Expenses, Tax Provision with GST/tax/yours-to-spend breakdown)
- **Pending review banner** with link to expenses?status=pending_review
- **Recent transactions feed** (income/expense mixed, color-coded dots, click-through links)
- **FAB** for quick-add expense (preserved from FD-1)
- Full mobile responsive: stacks on small, 2x2 grid on medium, 4-col on large

### Overhauled main page — `app/lite/finance/page.tsx`

- Global time-range picker: This Month (default), Last Month, This Quarter, Last Quarter, This FY, Last FY — URL-encoded via `?range=` param
- Navigation links to Recurring, All Expenses, Export
- Three empty states: no Stripe + no data, Stripe connected + no data (handled by getDashboardData returning nulls), has data (full dashboard)
- Australian FY (Jul-Jun) for FY presets

### 6 drill-down routes

- `/lite/finance/mrr` — MRR breakdown by active deal, click-through to pipeline
- `/lite/finance/outstanding` — Outstanding invoices with overdue badges, click-through to invoice detail
- `/lite/finance/expenses` — Full expense ledger with status/category/source filters, reuses `FinanceDashboardClient`
- `/lite/finance/recent` — Last 30 days mixed transactions
- `/lite/finance/category/[slug]` — Category-specific expense list
- `/lite/finance/export` — Placeholder for FD-4 (accountant bundle)

All drill-downs follow the same pattern: back-link to Finance, header with summary stats, list with click-through to owning feature.

### Narrative number-reference validation

Inline in the narrative card component: parses `number_references` from the LLM output, renders matching tokens as clickable links to drill-down routes. Non-matching tokens render as plain text. Fallback when narrative is null or parse fails: "Narrative unavailable" message. Stale indicator when narrative is >6 hours old.

## New files

- `lib/finance/narrative-prompt.ts`
- `lib/finance/dashboard-data.ts`
- `lib/scheduled-tasks/handlers/finance-narrative.ts`
- `components/lite/finance/finance-full-dashboard.tsx`
- `app/lite/finance/mrr/page.tsx`
- `app/lite/finance/outstanding/page.tsx`
- `app/lite/finance/expenses/page.tsx`
- `app/lite/finance/recent/page.tsx`
- `app/lite/finance/category/[slug]/page.tsx`
- `app/lite/finance/export/page.tsx`
- `tests/fd3-dashboard-narrative.test.ts`

## Edited files

- `app/lite/finance/page.tsx` — complete rewrite for full dashboard layout
- `lib/finance/index.ts` — 2 new re-exports (getDashboardData, buildNarrativePrompt)
- `lib/scheduled-tasks/handlers/index.ts` — FINANCE_NARRATIVE_HANDLERS import + spread

## Verification

- `npx tsc --noEmit` — zero new errors (2 pre-existing in hp19 test file)
- `npx vitest run` — 257 files, 2444 passed, 1 skipped (6 new tests)
- Browser check: `/lite/finance` renders full layout with range picker, empty state, nav links. Drill-down routes (`/mrr`, `/outstanding`, `/expenses`, `/recent`, `/export`) all render correctly.

## Rollback

- Git-revertable: all new files additive. Page.tsx rewrite is the only destructive edit but the prior version is in git.

## Key decisions

- **SVG projection chart rather than a charting library** — lightweight, no new dependency. Renders contracted area fill + pipeline dashed + decay dotted lines. Scales to container width via viewBox.
- **Narrative stored as JSON string in `narrative_text`** — parsed on read. Includes `_fallback` flag for failed generations so the UI can distinguish "no narrative yet" from "narrative generation failed".
- **Range picker as URL params** — deep-linkable, server-side data fetching. Default is `this_month`.
- **Australian FY presets** — Jul-Jun, consistent with snapshot.ts computations.
- **Expense drill-down reuses existing `FinanceDashboardClient`** — the expenses table component from FD-1 works perfectly as the full ledger view with filter params.
- **Category slug matching** — accepts both underscore and hyphenated versions of category keys for URL friendliness.

## Settings keys consumed

Same as FD-2 — this session reads metrics from snapshots, doesn't directly call `settings.get()`.

## Next session should know

- **FD-4 (Session D)** — Accountant bundle export, cockpit banners, onboarding step. The export page exists as a placeholder. Cockpit banner integration needs `getHealthBanners()` extension.
- **`finance_narrative_regenerate` handler is now live** — snapshot handler enqueues it, this session built the handler. Material-event wiring (re-trigger on invoice paid, expense created, etc.) is FD-4 scope or can be wired into existing mutation paths.
- **Content mini-session not yet run** — narrative prompt uses generic phrasing. The content session should calibrate tone, opener rotation, callout phrasing per spec §12.
- **Pre-existing hp19 test TS errors** — still 2 cosmetic `TS2345` errors in `tests/hp19-briefing-signals.test.ts`.
