# BI-2a brief — Branded Invoicing admin surfaces

**Wave:** 7. **Tier:** `/deep` recommended (multi-surface admin UI; status-driven action matrix; supersede flow). **Split from:** original `bi-2-brief.md` — BI-2 was realistically two sessions, so split on 2026-04-15 before kickoff. BI-2b owns Stripe Payment Element + webhook + client scroll-snap upgrade + Claude-drafted emails with drift-check. **Pre-authored by:** BI-1b (G11.b), re-scoped 2026-04-15.

## Why this session

BI-1a + BI-1b landed the full pipeline + PDF + minimum-viable client token view, and flipped `killSwitches.invoicing_manual_cycle_enqueue_enabled → true`. Every retainer accept now enqueues a `manual_invoice_generate` task that auto-chains: generate → 3-day review → send → 3-day overdue reminder → next cycle. Right now Andy has **no admin surface** to see or touch those invoices — drafts, sent, overdue, paid, voided. BI-2a builds the admin control panel. BI-2b layers the client-facing Stripe + Claude email work on top.

## Pre-conditions (verify before coding)

- Read `sessions/bi-1a-handoff.md` + `sessions/bi-1b-handoff.md` end-to-end.
- Read `docs/specs/branded-invoicing.md` §4.1 + §4.2 + §4.3 + §4.6 (deterministic email paths only) + §5 data model.
- Read `app/lite/admin/pipeline/` + `app/lite/admin/companies/` end-to-end for admin layout conventions (drawer pattern, table primitives, filter tabs).
- Read `app/lite/admin/settings/catalogue/` + `app/lite/admin/settings/quote-templates/` for the inline editor / form pattern.
- Read `components/lite/quote-builder/send-quote-modal.tsx` for the send-modal pattern to mirror.
- Confirm `killSwitches.invoicing_manual_cycle_enqueue_enabled === true`.
- All `lib/invoicing/{generate,send,mark-paid,sweep,transitions,compose-emails,pdf-template,render-invoice-pdf}.ts` primitives exist — **reuse; do not rebuild**.
- `lib/invoicing/compose-emails.ts` deterministic composers (`composeInvoiceSendEmail` / `…ReminderEmail` / `…SupersedeEmail`) cover every email this session dispatches. Claude-drafted variants are a BI-2b concern; this session ships deterministic only.
- **No Stripe code lands this session.** No `ensureStripeCustomer`, no Payment Element, no webhook. If an action would normally touch Stripe, use the manual-path equivalent (bank-transfer instructions, admin mark-as-paid).

## Expected scope

**Admin surfaces** (behind auth, all under `/lite/admin/invoices/*` + company profile tab):

1. **Invoice index** `/lite/admin/invoices` — spec §4.1. Summary cards (Outstanding / Overdue / Paid this month / Paid this FY) + filter tabs (All / Draft / Sent / Overdue / Paid / Void) with `?filter=<name>` deep-link support (Daily Cockpit health-banner target) + sortable list (Invoice number, Client, Total inc-GST, Issue date, Due date, Status badge) + search (client name or invoice number). Row click → detail drawer.
2. **Invoice detail drawer** — spec §4.3. Opens inline over the index (mirror Pipeline deal drawer). Header (number, status badge, issue/due dates, company name). Line items table. Totals block. Scope summary + accepted-quote link. Status-dependent action matrix:
   - `draft`: Add line item · Send now · Void · Preview PDF · Preview web view
   - `sent`: Mark as paid · Send reminder · Edit (supersede) · Void · View PDF · View web page
   - `overdue`: same as `sent` plus visible overdue indicator
   - `paid`: View PDF · View web page (read-only)
   - `void`: View PDF (read-only) + superseded-by link if applicable
3. **Compose / pre-send review** — for `draft` only (the 3-day auto-send window). Add one-off line items (description, quantity, unit price inc-GST), adjust due date, preview PDF, "Send now" immediate dispatch or "Leave for timer" close. Line items persist onto the existing `invoices.line_items_json`.
4. **Supersede flow** — draft-first: void current + reissue new invoice (carries source quote reference + scope summary + any pre-supersede line items). Uses `composeInvoiceSupersedeEmail` (deterministic) when the superseded invoice was already `sent`/`overdue`. Stamps `superseded_by_invoice_id` on the void row and `supersedes_invoice_id` on the new row. Mirrors Quote Builder's supersede-via-new-row pattern (`qb3`).
5. **Company profile billing tab** — spec §4.2. New tab on the company profile at `/lite/admin/companies/[id]` (or wherever the existing profile lives — verify the current route). Editable `companies.payment_terms_days` dropdown (7 / 14 / 30 / 60). Read-only bank details card. Invoice list (same list component, filtered to this company, no summary cards). "New invoice" button → manual draft flow (creates `draft` invoice with empty line items, opens compose UI).
6. **"Send reminder" manual button** (admin-triggered on `sent`/`overdue` invoices). Preview-before-send modal mirroring the Quote Builder send-modal. Body uses deterministic `composeInvoiceReminderEmail`. Bumps `reminder_count` + `last_reminder_at_ms`, logs `invoice_reminder_sent`. Claude-drafted contextual variant with drift-check is a BI-2b concern.
7. **Mark-as-paid** — admin button on `sent`/`overdue`. Calls existing `markInvoicePaid({invoiceId, paidVia: "bank_transfer"})`. Simple confirm modal (amount + company). Logs `invoice_marked_paid`. Updates the drawer in place.

**Server Actions** (in `app/lite/admin/invoices/actions.ts`):
- `createManualInvoiceAction({companyId, dealId?})` — creates a `draft` invoice for manual composition; no schedule enqueue.
- `addInvoiceLineItemAction({invoiceId, lineItem})` — guards `status === "draft"`, mutates `line_items_json`, re-derives totals.
- `removeInvoiceLineItemAction({invoiceId, index})` — same guard.
- `updateInvoiceDueDateAction({invoiceId, dueAtMs})` — draft-only.
- `sendInvoiceNowAction({invoiceId})` — calls existing `sendInvoice()`; cancels any pending `manual_invoice_send` scheduled task for this invoice (idempotency-key lookup).
- `voidInvoiceAction({invoiceId, reason})` — transitions to `void`; cancels any pending scheduled tasks for this invoice.
- `supersedeInvoiceAction({sourceInvoiceId})` — voids source + creates fresh draft carrying forward source's deal/company/source_quote_id/scope_summary/line_items; stamps both rows' cross-refs. Returns new invoice id for drawer re-open.
- `sendReminderAction({invoiceId})` — bumps `reminder_count` + `last_reminder_at_ms` + dispatches deterministic reminder + logs `invoice_reminder_sent`. Cancels the pending `invoice_overdue_reminder` scheduled task (we're doing it manually).
- `markInvoicePaidAction({invoiceId, paidVia})` — wraps `markInvoicePaid()`.

**Cron / scheduled-task interactions** (no new handlers):
- `scheduled_tasks` cancellation on send-now / void / supersede — use idempotency keys (e.g. `manual_invoice_send:{id}`, `invoice_overdue_reminder:{id}`) to locate and null/delete pending rows.

## Out of scope (BI-2b)

- Stripe Payment Element mount on client web view.
- `payment_intent.succeeded` webhook handler.
- `ensureStripeCustomer()` precondition (PATCHES_OWED row stays open; BI-2b closes).
- Claude-drafted email variants (send / overdue reminder / manual follow-up / supersede) with drift-check.
- Client-facing scroll-snap two-section upgrade (BI-1b's minimum-viable view stays until BI-2b).
- Post-payment state replacement (paid badge + Download PDF(paid variant) + sprinkle) on client view.
- `SUPERBAD_ABN` / `SUPERBAD_BILLING_EMAIL` env seeding (BI-2b / launch-gate).

## Gates (G0–G12)

- G0–G3 pre-reads (spec + handoffs + registry + kill-switches).
- G4 literal grep — any autonomy threshold must flow through `settings.get()` (spec says none new, but verify on diff).
- G5 rollback — admin-only surfaces behind auth; rollback = git revert, no data-shape change. Confirm no new migrations land. If a new migration becomes necessary, ship a reversible `0021_…` + down.
- G10 motion — filter tab transitions + drawer open/close + supersede morph follow houseSpring.
- G10.5 external reviewer — required (supersede cross-reference logic + scheduled-task cancellation is easy to get subtly wrong).
- G11 budget checkpoint — if the admin index + drawer lands but compose/supersede still owes work at 70%, split off `bi-2a-ii` for the remainder; do not pour the tail into a shrinking context.
- G11.b — close by writing `sessions/bi-2b-brief.md` if not already present, or update it with anything BI-2a shifted. The BI-2b brief below is the seed.
- G12 typecheck + tests — `npx tsc --noEmit` zero errors, `npm test` green, new tests per surface.

## Tests owed

- `tests/bi2a-admin-actions.test.ts` — every Server Action's guards + status-transition correctness + scheduled-task cancellation side-effects.
- `tests/bi2a-supersede.test.ts` — cross-ref stamping, line-item carry-forward, send-email dispatch on non-draft source.
- `tests/bi2a-index-query.test.ts` — summary-card aggregates (inc-GST only, FY boundary math, month boundary math, overdue-red threshold).
- Component-level smoke coverage for the filter-tab URL sync (happy-path `?filter=overdue` renders Overdue tab selected).

## Open items carried forward

- `bi1_ensure_stripe_customer_precondition` (PATCHES_OWED) — **deferred to BI-2b**; no Stripe path lands this session.
- `SUPERBAD_ABN` / `SUPERBAD_BILLING_EMAIL` env seeding — deferred to BI-2b.
- `qbe2e_manual_quote_settled_missing` — deferred to BI-2b or BI-E2E; spec-gap review, not admin-UI work.
- BI-2b session is the natural successor; BI-E2E wraps the wave once BI-2b is green.
