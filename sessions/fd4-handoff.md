# FD-4 Handoff — Finance Dashboard: Accountant Bundle Export + Cockpit Banners + Onboarding Step

**Date:** 2026-04-20
**Wave:** 19
**Status:** COMPLETE

## What was built

### Export data layer — `lib/finance/export-queries.ts`

Core data layer for the accountant bundle. `getExportTransactions()`, `getExportInvoices()`, `getExportExpenses()`, `getClientRevenue()` produce CSV-ready arrays with Xero-compatible column names (amount_inc_gst, gst_amount, amount_ex_gst). `computeBasSummary()` and `computePandLSummary()` aggregate for PDF generation. All monetary values converted from cents to AUD at the query boundary.

### Export period presets — `lib/finance/export-periods.ts`

`getBasPresets(now)` returns last 2 completed BAS quarters (Australian calendar: Q3 Jan-Mar, Q4 Apr-Jun, Q1 Jul-Sep, Q2 Oct-Dec). `getFyPresets(now)` returns current + previous Australian FY (Jul-Jun). `getAllPresets()` returns 4 presets. `customPeriod(start, end)` for arbitrary ranges.

### PDF templates — `lib/finance/pdf-templates.ts`

`buildBasPdfHtml()` and `buildPandLPdfHtml()` produce self-contained HTML with inline brand styling (cream #faf5ef background, Georgia serif, charcoal text, SuperBad Media header). `exportFilename()` slugifies the period label for download filenames.

### Bundle generator — `lib/finance/generate-export-bundle.ts`

Orchestrates full bundle: parallel data fetch, parallel PDF render via `renderToPdf()`, CSV generation via `toCsv()`, zip assembly via JSZip. Returns `{ buffer, filename, periodLabel }`. Bundle contains: BAS summary PDF, P&L PDF, 4 CSVs (transactions, expenses, invoices, per-client revenue).

### Export server actions — `lib/finance/export-actions.ts`

`requestExportAction(formData)` creates `finance_exports` row + enqueues `finance_export_generate` scheduled task. `getExportStatus(exportId)` for polling. `getPastExports()` returns 20 most recent non-purged exports.

### Export UI — `components/lite/finance/export-client.tsx` + `app/lite/finance/export/page.tsx`

Server component loads presets and past exports. Client component renders 4 preset buttons, custom date range section with native date inputs, Generate button, polling status (5s interval), past exports list with download links. Loading state shows spinner with dry copy.

### API routes

- `app/api/admin/finance-exports/generate/route.ts` — POST: creates export row + enqueues task
- `app/api/admin/finance-exports/[id]/route.ts` — GET: serves zip file from disk
- `app/api/admin/finance-exports/[id]/status/route.ts` — GET: returns status JSON for polling
- `app/api/admin/finance-exports/list/route.ts` — GET: returns recent exports

### Export generate handler — `lib/scheduled-tasks/handlers/finance-export-generate.ts`

Handles `finance_export_generate` task: updates status to generating, calls `generateFinanceExportBundle()`, writes zip to `var/exports/finance/`, updates DB row with file path + size, sends email notification with attachment (if <= 10MB), logs activity. On failure: sets status to "failed" with error_message.

### Retention purge handler — `lib/scheduled-tasks/handlers/finance-export-retention-purge.ts`

Reads `finance.export_retention_days` from settings (default 90), finds ready exports past cutoff, deletes files from disk, marks rows as "purged".

### Finance health banners — `lib/finance/cockpit.ts`

`getFinanceHealthBanners(nowMs)` returns `HealthBanner[]` with 3 kinds:
- `finance_bas_due`: fires when BAS quarter end <= `finance.bas_reminder_days_ahead` (14d default)
- `finance_eofy_due`: fires when FY end <= `finance.eofy_reminder_days_ahead` (30d default)
- `finance_invoice_overdue`: fires when any invoice > 30d overdue OR total outstanding > $5k

Checks `compliance_milestones` table for BAS-filed / EOFY-filed dismissals.

### Compliance milestone actions — `lib/finance/compliance-actions.ts`

`markComplianceMilestoneAction(kind, periodLabel, note?)` inserts `compliance_milestones` row + logs activity. Used for one-click BAS-filed / EOFY-filed dismissals.

### Finance tax rates wizard — `lib/wizards/defs/finance-tax-rates.ts`

`WizardDefinition` with key "finance-tax-rates", audience "admin", 3 steps: GST rate (10% standard / 0% not registered), income tax rate (25% sole trader/small co / 30% standard co), review-and-confirm. Completion contract writes `finance.gst_rate` and `finance.income_tax_rate` via `settings.set()`.

### DB schema — `lib/db/schema/finance-exports.ts` + migration

`finance_exports` table: id, period_start, period_end, period_label, status (pending/generating/ready/failed/purged), file_path, filename, file_size_bytes, error_message, requested_at_ms, completed_at_ms, created_at_ms. `SCHEDULED_TASK_TYPES` extended with `finance_export_retention_purge`.

## New files

- `lib/finance/export-queries.ts`
- `lib/finance/export-periods.ts`
- `lib/finance/pdf-templates.ts`
- `lib/finance/generate-export-bundle.ts`
- `lib/finance/export-actions.ts`
- `lib/finance/cockpit.ts`
- `lib/finance/compliance-actions.ts`
- `lib/db/schema/finance-exports.ts`
- `lib/db/migrations/0062_fd4_finance_exports.sql`
- `lib/scheduled-tasks/handlers/finance-export-generate.ts`
- `lib/scheduled-tasks/handlers/finance-export-retention-purge.ts`
- `lib/wizards/defs/finance-tax-rates.ts`
- `components/lite/finance/export-client.tsx`
- `app/api/admin/finance-exports/generate/route.ts`
- `app/api/admin/finance-exports/[id]/route.ts`
- `app/api/admin/finance-exports/[id]/status/route.ts`
- `app/api/admin/finance-exports/list/route.ts`
- `tests/fd4-export-banners-wizard.test.ts`

## Edited files

- `app/lite/finance/export/page.tsx` — complete rewrite (was FD-3 placeholder)
- `lib/finance/index.ts` — added re-exports for export-periods, generate-export-bundle, export-queries types, cockpit
- `lib/db/schema/index.ts` — added finance-exports export
- `lib/db/schema/scheduled-tasks.ts` — added finance_export_retention_purge to SCHEDULED_TASK_TYPES
- `lib/scheduled-tasks/handlers/index.ts` — added FINANCE_EXPORT_GENERATE_HANDLERS + FINANCE_EXPORT_RETENTION_PURGE_HANDLERS
- `lib/wizards/defs/index.ts` — added finance-tax-rates import

## Verification

- `npx tsc --noEmit` — zero new errors (2 pre-existing in hp19 test file)
- `npx vitest run` — 258 files, 2459 passed, 1 skipped (15 new tests)
- Browser check: `/lite/finance/export` renders 4 preset buttons (BAS Q3 2026 Jan-Mar, BAS Q2 2025 Oct-Dec, Current FY 2025-2026, FY 2024-2025), custom date range section, Generate button disabled when no dates, brand styling correct

## Rollback

- Migration: `DROP TABLE IF EXISTS finance_exports` reverses the schema addition
- All new files additive; edited files git-revertable
- Handlers removable from registry by removing import + spread lines

## Key decisions

- **Polling over WebSocket for export status** — 5s interval fetch is simpler and sufficient for a ~60s generation. No new infrastructure needed.
- **Zip written to disk at `var/exports/finance/`** — filesystem persistence for download serving. Retention purge cleans up on schedule.
- **Email attachment capped at 10MB** — larger bundles get a download link only.
- **Compliance milestones as separate table** — allows per-period BAS-filed / EOFY-filed tracking independent of other features.
- **Wizard presets rather than free numeric input** — matches the hand-held setup philosophy. Tax rates are standard values, not custom.

## Settings keys consumed

- `finance.bas_reminder_days_ahead` (default 14)
- `finance.eofy_reminder_days_ahead` (default 30)
- `finance.overdue_invoice_threshold_days` (default 30)
- `finance.outstanding_invoices_threshold_aud` (default 5000)
- `finance.export_retention_days` (default 90)
- `finance.gst_rate` (written by wizard)
- `finance.income_tax_rate` (written by wizard)

## Next session should know

- **FD-4 completes Session D — the last explicitly scoped Finance Dashboard session.** The BUILD_PLAN references FD-5 for Observatory cost roll-up + Stripe fee roll-up live wiring, but that's blocked until COB (Wave 21) lands. Those crons are stubbed.
- **Dev DB migration was applied manually** — `sqlite3 dev.db` with the CREATE TABLE statement. The seed runner should pick it up for fresh databases.
- **Content mini-session not yet run** — export UI copy, banner phrasing, and wizard voice treatment use placeholder text. CMS-6 should calibrate.
- **Pre-existing hp19 test TS errors** — still 2 cosmetic `TS2345` errors in `tests/hp19-briefing-signals.test.ts`.
- **The `finance_export_generate` handler depends on Puppeteer** — `renderToPdf()` needs a Chromium install at runtime. Works in dev; verify in production deploy.
