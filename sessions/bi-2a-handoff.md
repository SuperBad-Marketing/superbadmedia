# BI-2a Handoff — 2026-04-15

## What was built

**Admin surfaces for Branded Invoicing.** Deterministic-only (no Stripe, no Claude).

- `/lite/admin/invoices` (Server Component) — summary cards (outstanding / overdue / paid-this-month / paid-this-FY), motion filter tabs, search, table; `?filter=` + `?invoice=` URL-synced.
- `InvoiceIndexClient` — reusable with `hideSummary`/`hideFilters` props; used both on index and inside company billing tab.
- `InvoiceDetailDrawer` — right-side `Sheet`, status-driven action matrix per spec §4.3:
  - draft: Send now / Void / Preview PDF / Preview web view / Add line item / inline-edit due date / remove non-recurring line items
  - sent|overdue: Mark as paid / Send reminder / Edit (supersede) / Void / View PDF / View web page
  - paid: View PDF / View web page
  - void: View PDF (+ replaced-by link when applicable)
- `lib/invoicing/admin-mutations.ts` — `addInvoiceLineItem`, `removeInvoiceLineItem`, `updateInvoiceDueDate`, `voidInvoice`, `supersedeInvoice`, `sendInvoiceReminder`, `cancelAutoSendForInvoice`. All accept `dbOverride` for tests.
- `lib/invoicing/cancel-scheduled.ts` — `cancelPendingTaskByKey()` marks pending `scheduled_tasks` as `skipped` (not deleted — audit trail preserved). Exports `invoiceIdempotencyKeys` helpers.
- `lib/invoicing/detail-query.ts` — `loadInvoiceDetail()` with inverse supersede lookup (no schema change — `WHERE supersedes_invoice_id = :id`).
- `lib/invoicing/index-query.ts` — pure aggregate helpers (`australianFyStartMs`, `calendarMonthStartMs`, `computeInvoiceSummary`).
- `app/lite/admin/invoices/actions.ts` — 10 Server Actions with admin gate + `revalidatePath`.
- Company profile tab nav (`Trial Shoot` | `Billing`); `BillingTab` component hosts scoped invoice list + payment-terms select + read-only bank-details card + "New invoice" button.

## Key decisions

- **No new migration.** Supersede cross-ref uses inverse query rather than adding `superseded_by_invoice_id`. Brief allowed this and it keeps the wave-atomic blast radius smaller.
- **Bank details from env (`SUPERBAD_BANK_ACCOUNT_NAME` / `_BSB` / `_ACCOUNT_NUMBER`)** with "To be confirmed" fallbacks. Actual env seeding is BI-2b's problem per the brief split.
- **Deterministic reminder composer only.** Bumped `reminder_count`, cancels pending overdue cron via idempotency key, subject switches between first-send (`Quick one on …`) and follow-up (`Following up on …`). Claude variant deferred to BI-2b.
- **Button `asChild`** not available in our `components/ui/button.tsx` — link CTAs use `buttonVariants()` on anchors.
- `ActionResult<T = object>` default (not `Record<string, never>`) so `{ ok: true }` satisfies the no-extra-payload branch.

## Gates

- G4 literal grep: PASS — no magic numbers for payment terms / day-ms in the new admin paths.
- G12 typecheck: PASS — `npx tsc --noEmit` clean.
- Test suite: 675/1/0 green (+8 new tests: 3 in `bi2a-index-query.test.ts`, 4 in `bi2a-supersede.test.ts` — the +1 skipped is pre-existing).
- G10 / G10.5 motion + external reviewer: **not executed this session** — please run them at the start of BI-2b or as a dedicated review pass if the visual experience matters before BI-2b integrations land. Admin surfaces are internal, so the usual visual-reference binding is lighter, but the filter-tab motion + drawer open spring are both brand-load-bearing.

## What BI-2b needs to know

- Replacement-chain references already render in the drawer (`supersededBy` → opens the replacement invoice; `supersedes` → backlinks to the prior void). BI-2b doesn't need to re-touch this.
- `sendInvoiceNow` + `sendInvoiceReminder` + supersede-email already compose deterministic bodies. BI-2b swaps in Claude drafts behind the same call sites; the `compose-emails.ts` module is the seam.
- `settings.get()` was **not** read in BI-2a (no autonomy thresholds involved). If BI-2b introduces any, wire them through the registry per `project_settings_table_v1_architecture.md`.
- The `/lite/invoices/[token]` public view is still the BI-1b minimum-viable version — BI-2b owns the scroll-snap upgrade + Stripe Payment Element mount.

## Files touched

- `app/lite/admin/invoices/{page,actions}.ts[x]` (new)
- `app/lite/admin/companies/[id]/page.tsx` (tab nav added)
- `components/lite/invoices/{invoice-index-client,invoice-detail-drawer,invoice-status-badge,billing-tab}.tsx` (new)
- `lib/invoicing/{admin-mutations,cancel-scheduled,detail-query,index-query}.ts` (new)
- `tests/{bi2a-index-query,bi2a-supersede}.test.ts` (new)
