# BI-1a handoff — Branded Invoicing primitives + handlers

**Wave:** 7. **Tier:** `/normal` (Sonnet). **Closed:** 2026-04-15.
**Scope split:** BI-1 was split at session kickoff into BI-1a (this session — schema + primitives + handlers + sweep + mark-paid + tests) and BI-1b (next — PDF template + `/api/invoices/[token]/pdf` route + kill-switch flip). BI-2 owns all admin + client UI.

## What landed

- **Schema** — `lib/db/schema/invoices.ts` (5 statuses × 2 paid_via × `InvoiceLineItem` shape); `companies.payment_terms_days INTEGER NOT NULL DEFAULT 14`. Migration `0020_bi1_branded_invoicing.sql` registered in `_journal.json` idx 20. Indexes: `(company,status)`, `(status)`, `(due_at_ms,status)`, `(deal_id)`.
- **Settings** (registry 88 → 90): `invoice.review_window_days=3`, `invoice.overdue_reminder_days=3`. Typed in `lib/settings.ts`; seeded in migration 0020.
- **Email classifications** — `invoice_send`, `invoice_reminder`, `invoice_supersede` added to both `EMAIL_CLASSIFICATIONS` and `TRANSACTIONAL_CLASSIFICATIONS` (invoicing = engaged conversation; bypasses outreach kill-switch + quiet window).
- **Primitives**:
  - `lib/invoicing/sequences.ts` — `allocateInvoiceNumber({year, db})` atomic upsert-increment on `sequences`; format `SB-INV-YYYY-NNNN`.
  - `lib/invoicing/transitions.ts` — `LEGAL_TRANSITIONS` map + `IllegalInvoiceTransitionError` + `transitionInvoiceStatus()` atomic `UPDATE ... WHERE id AND status = from`.
  - `lib/invoicing/totals.ts` — `deriveInvoiceTotals()` derives GST at total level (`Math.round(total/11)`) per spec §14.3; `sumLineItems()`.
  - `lib/invoicing/generate.ts` — `generateInvoice()` + exported `projectCycleLineItems()` (cycle 0 = retainer + one-off; cycle ≥1 = retainer-only).
  - `lib/invoicing/send.ts` — `sendInvoice()`: draft-only guard, email, transition draft→sent, logs `invoice_sent`.
  - `lib/invoicing/mark-paid.ts` — `markInvoicePaid()`: idempotent on `paid`, rejects non-`sent|overdue`, logs `invoice_marked_paid` / `invoice_paid_online` by `paid_via`.
  - `lib/invoicing/sweep.ts` — `sweepOverdueInvoices()` bulk flips `sent → overdue` where `due_at_ms < now`, logs `invoice_overdue` per row.
  - `lib/invoicing/compose-emails.ts` — deterministic composers (`composeInvoiceSendEmail` / `…ReminderEmail` / `…SupersedeEmail`); Claude-drafted variants land in BI-2.
- **Scheduled-task handlers** (`lib/invoicing/handlers.ts`):
  - `manual_invoice_generate` — guards `deal.stage==="won"` + `company.billing_mode==="manual"`; calls `generateInvoice`; enqueues `manual_invoice_send` at `send_at + review_window_days`.
  - `manual_invoice_send` — if still draft, sends; enqueues `invoice_overdue_reminder` at `due_at + overdue_reminder_days`; enqueues next-cycle `manual_invoice_generate` if `subscription_state==="active"` AND `committed_until_date_ms > nextSendAt`.
  - `invoice_overdue_reminder` — flips `sent → overdue` if needed, sends reminder, bumps `reminder_count` + `last_reminder_at_ms`, logs `invoice_reminder_sent`.
- **Registry wired** — `INVOICING_HANDLERS` spread in `lib/scheduled-tasks/handlers/index.ts`; removed stub slots from `quote-builder.ts` (`QUOTE_BUILDER_STUB_TASK_TYPES` narrowed 4 → 2; only `subscription_pause_resume*` remain).
- **Worker sweep** — `sweepOverdueInvoices({nowMs})` called once per `tick()` (after dispatch, before heartbeat), try/caught so a sweep failure never poisons the tick.

## Kill-switch

`killSwitches.invoicing_manual_cycle_enqueue_enabled` **stays false.** BI-1b flips it to `true` as the final commit of that session. `lib/quote-builder/accept.ts` already gates the initial `manual_invoice_generate` enqueue on it. The QB-E2E precondition test (`qb-e2e.spec.ts`) still asserts `=== false` and stays green.

## Verification

- `npx tsc --noEmit` — zero errors.
- `npm test` — 660 passed, 1 skipped, 0 failed. New tests: `tests/bi1-totals.test.ts` (5), `tests/bi1-invoicing.test.ts` (19). Updated: `tests/qb1-handlers.test.ts` (stub list narrowed to 2), `tests/settings.test.ts` (88 → 90 seed count).
- G4 literal grep — `review_window_days` / `overdue_reminder_days` both routed through `settings.get()`; no magic day counts in handlers.

## Closes in `PATCHES_OWED.md`

- `qb4c_manual_invoice_generate_handler` — ✅ CLOSED (stubs removed, real handler wired).

## What BI-1b owns

1. `renderToPdf()` / invoice PDF template (Puppeteer is already in place from QB-3; reuse `lib/pdf/render.ts`).
2. `/api/invoices/[token]/pdf` route — token-authed, streams PDF.
3. `/lite/invoices/[token]` read-only web view (minimum viable; admin/client UI is BI-2).
4. **Flip `killSwitches.invoicing_manual_cycle_enqueue_enabled → true`** as last commit after everything else is green.
5. Resolve `bi1_ensure_stripe_customer_precondition` PATCHES_OWED if applicable.
