# Branded Invoicing — Feature Spec

**Phase 3 output. Locked 2026-04-12.**

> **Prompt files:** `lib/ai/prompts/branded-invoicing.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

Branded Invoicing is SuperBad Lite's invoice generation and delivery system for manual-billed companies — clients whose `companies.billing_mode = 'manual'` in the Pipeline, meaning they pay via bank transfer or occasional Stripe one-off rather than Stripe's standard subscription flow. It owns the full lifecycle of an invoice: generation (auto or manual), pre-send review, delivery (email with PDF + online link), branded web view with inline Stripe payment, overdue tracking, reminders, manual follow-ups, mark-as-paid, void-and-reissue via supersede, and the monthly self-perpetuating task chain that keeps invoices firing without Andy touching anything.

Branded Invoicing is **directly downstream of Quote Builder** (`docs/specs/quote-builder.md`). Quote Builder's `handleManualInvoiceSend` handler in the scheduled-tasks worker is the primary automated entry point — it calls into Branded Invoicing's two-step primitive (`generateInvoice` → `sendInvoice`) to produce and dispatch each monthly invoice. The scheduled-tasks infrastructure (table, worker, handler map, idempotency, retry) is owned by Quote Builder; Branded Invoicing adds two new `task_type` values and follows the existing patterns exactly.

Integration with the Sales Pipeline (`docs/specs/sales-pipeline.md`) is via the `deals` and `companies` tables — Branded Invoicing reads `companies.billing_mode`, `companies.payment_terms_days`, `companies.gst_applicable`, and the accepted quote's `content_json` + `total_cents_inc_gst` to generate each invoice. Integration with the Daily Cockpit (`docs/specs/daily-cockpit.md`) is via cockpit attention cards for draft-review-window invoices, overdue invoices, and failed invoice tasks.

---

## 1. Purpose and shape

An invoice in SuperBad Lite is **a branded financial document that happens to comply with tax law**, not a compliance document that happens to be branded. That framing — parallel to Quote Builder's "a premium branded document that happens to transact" — dictates decisions across this spec:

- The PDF is ATO-compliant but visually unmistakable as SuperBad.
- The web view is a full branded experience with two scroll-snap sections, not a utility page with a pay button.
- The payment moment stays in the branded experience (inline Payment Element), never redirects to Stripe's generic checkout.
- The monthly cycle runs itself — Andy intervenes only when he has something to add.
- Voice surfaces are proportionate: a dry footer line on the PDF, a warm confirmation line post-payment, Claude-drafted contextual emails. No hidden eggs — invoices are trust surfaces, fully suppressed.

Branded Invoicing **only serves manual-billed companies**. Stripe-billed clients receive native Stripe invoices and receipts — Lite doesn't generate custom invoices for them. SaaS subscription billing (`docs/specs/saas-subscription-billing.md`) is a separate flow entirely.

---

## 2. The 25 locks (quick reference)

| # | Decision | Detail |
|---|---|---|
| Q1 | **Invoice number format** | Year-prefixed sequential: `SB-INV-2026-0001`. Per-year counter, globally unique, ATO-compliant. Parallel to Quote Builder's `SB-2026-0042`. |
| Q2 | **Who can trigger** | Auto (scheduled-tasks worker each month) + manual (Andy creates from deal/company profile) + edit-after-send via supersede (new row, old invoice voided with redirect). |
| Q3 | **Line item source** | Quote-locked recurring lines copied verbatim from the accepted quote each cycle + optional manual add-on line items Andy attaches before the invoice sends. Recurring base never edited — scope changes require a quote supersede upstream. |
| Q4 | **Payment terms** | Per-company, stored as `companies.payment_terms_days` (default 14). Set once on the company profile, inherited by every invoice. |
| Q5 | **PDF renderer** | Shared Puppeteer rendering pipeline (`lib/pdf/render.ts`) with Quote Builder. Branded Invoicing passes its own tax invoice React template. Route: `app/lite/invoices/[token]/pdf/page.tsx`. |
| Q6 | **PDF content** | Full ATO-compliant layout: masthead, "Tax Invoice" title, invoice number + dates, billed-to + supplier blocks, one-line scope summary from accepted quote, line items table, subtotal ex-GST / GST / total inc-GST, payment instructions (bank details + "Pay online" link), "View original proposal" quote link, sprinkle footer, fine print with ABN + payment terms. |
| Q7 | **Payment method** | Bank transfer (BSB + account + reference) primary + optional "Pay online" Stripe Payment Link on the invoice. Both paths available; bank transfer presented first since manual-billed clients typically prefer it. |
| Q8 | **Mark as paid** | One-click "Mark as paid" button on the invoice in Lite. No form, no amount confirmation, no date picker. Binary action — Andy is the source of truth. |
| Q9 | **Invoice states** | 5 states: `draft` / `sent` / `overdue` / `paid` / `void`. Worker transitions `sent` → `overdue` when `due_at` passes. |
| Q10 | **Overdue follow-up** | One automated reminder email 3 days after the due date (Claude-drafted, drift-checked, warm not demanding). Then Andy can manually trigger additional follow-ups via a "Send reminder" button that Claude-drafts a contextual chase email (drift-checked, Andy previews before send). Cockpit surfaces overdue status as an attention card. |
| Q11 | **Invoice surfaces** | Standalone index at `/lite/invoices` (filterable list + summary cards) + company profile billing tab showing that company's invoices. Two entry points to the same data. |
| Q12 | **Index page content** | List with status badges (invoice number, client, total, issue date, due date, status) + 4 summary cards at top: Outstanding (sent + overdue), Overdue (overdue only), Paid this month, Paid this financial year. Sortable, filterable by status. |
| Q13 | **Invoice email** | Claude-drafted contextual email (drift-checked, reads Brand DNA + Context Engine) with PDF attached + "View online" link. Diverges from Quote Builder's link-only pattern — invoices are filing-cabinet documents, AP departments need the PDF in their inbox. |
| Q14 | **Web view** | Full branded experience at `/lite/invoices/[token]`. Token-authenticated, no sign-in required. Cinematic, editorially designed — not a utility page. |
| Q15 | **Web view layout** | Two-section scroll-snap: section one = the invoice (masthead through total + scope + line items), section two = payment (Stripe Payment Element + bank details + "View original proposal" link + footer). `scroll-snap-type: y proximity`, `min-height: 100dvh` per section. |
| Q16 | **Stripe payment path** | Inline Stripe Payment Element on section two. Same Tier-2 cinematic reveal pattern as Quote Builder and Intro Funnel — no new motion slot spent. Keeps the client in the branded experience throughout. |
| Q17 | **Post-payment confirmation** | In-page confirmation replacing section two. "Paid" badge, receipt reference, "Download PDF" button (updated PDF now shows paid status), sprinkle line: *"paid in full. pleasure doing business."* No redirect. |
| Q18 | **Reminder timing** | Automated reminder fires 3 days after due date (not on due date — grace window for bank transfer clearing and AP batch cycles). |
| Q19 | **Credit notes** | Not in v1. Void + reissue via supersede pattern covers the "wrong amount" case. Direct refunds via Stripe or bank transfer handled outside Lite. |
| Q20 | **Invoice generation primitive** | Two-step: `generateInvoice({ deal_id, cycle_index, cycle_start, cycle_end })` → creates invoice in `draft` status; `sendInvoice({ invoice_id })` → renders PDF, drafts email, dispatches, transitions to `sent`. Clean seam for the add-on review flow. |
| Q21 | **Add-on review window** | Worker calls `generateInvoice()` 3 days before send date, creating a `draft`. Cockpit notification: "ACME's March invoice is ready for review — sends in 3 days." If Andy does nothing, auto-sends when window expires. If Andy opens the draft, he can add one-off line items, then send immediately or let the timer run. |
| Q22 | **Scheduled-tasks mapping** | Two tasks per cycle: `manual_invoice_generate` (fires 3 days before send date, creates draft + cockpit notification) and `manual_invoice_send` (fires on send date, checks invoice status — sends if still `draft`, skips if Andy already sent or voided). Extends `task_type` enum by 1 value (`manual_invoice_generate`). |
| Q23 | **Recurring chain** | Self-perpetuating: when `manual_invoice_send` completes (or skips), it enqueues the next cycle's `manual_invoice_generate` task. Chain stops when deal leaves `won` status or commitment ends. Matches Quote Builder's "on success, enqueue next cycle" pattern. |
| Q24 | **Voice & delight** | Claim §3 Invoice PDF footer from sprinkle bank — split treatment: dry line on unpaid PDF (content mini-session authors), *"paid in full. pleasure doing business."* on web view paid confirmation state. Full hidden-egg suppression on all invoice surfaces. |
| Q25 | **Suppression** | Full suppression on both web view sections. No hidden eggs fire anywhere on invoice surfaces. Ambient voice (footer sprinkle, email tone) is the only voice layer. Invoices are trust surfaces. |

---

## 3. End-to-end journey

### 3.1 Automated monthly cycle (the common path)

1. **Quote accepted for a manual-billed company.** Quote Builder's settle handler enqueues the first `manual_invoice_generate` task with `run_at = first_invoice_date - 3 days`.

2. **Generate task fires.** `handleManualInvoiceGenerate` calls `generateInvoice({ deal_id, cycle_index: 0, cycle_start, cycle_end })`:
   - Creates an `invoices` row in `draft` status.
   - Copies recurring line items from the accepted quote's `content_json`.
   - Calculates `due_at = issue_date + companies.payment_terms_days`.
   - Derives ex-GST amounts from GST-inclusive stored values (÷ 11 for standard 10% GST; skip GST line entirely if `companies.gst_applicable = false`).
   - Fires cockpit notification: "ACME's March invoice is ready for review — sends in 3 days."
   - Enqueues `manual_invoice_send` with `run_at = send_date`.
   - Logs `activity_log.kind = 'invoice_generated'`.

3. **Review window (3 days).** Andy sees the cockpit card. Two outcomes:
   - **Andy ignores it.** The invoice stays in `draft`. Auto-send fires on schedule.
   - **Andy opens it.** He can: add one-off line items (additive only, recurring lines untouched), adjust the due date, preview the PDF, then either click "Send now" (calls `sendInvoice()` immediately) or close and let the timer run.

4. **Send task fires.** `handleManualInvoiceSend` checks the invoice:
   - If `status = 'draft'`: calls `sendInvoice(invoice_id)`.
   - If `status = 'sent'` (Andy already sent manually): marks task `skipped`, no action.
   - If `status = 'void'` (Andy voided the draft): marks task `skipped`, no action.
   - On success: enqueues next cycle's `manual_invoice_generate` (cycle_index + 1, `run_at = next_cycle_send_date - 3 days`).
   - On failure: retry with backoff; after 3 fails, escalate to cockpit and stop retrying.

5. **`sendInvoice()` pipeline:**
   - Renders PDF via shared `renderToPdf()` pipeline (Puppeteer hits `app/lite/invoices/[token]/pdf/page.tsx`).
   - Stores PDF buffer (or regenerates on demand — implementation decision for Phase 5).
   - Claude-drafts the send email (`draft-invoice-email.ts`, reads Brand DNA + Context Engine, drift-checked).
   - Dispatches via `sendEmail({ classification: 'transactional' })` — bypasses §11.4 quiet window.
   - Attaches PDF + includes "View online →" link to `/lite/invoices/[token]`.
   - Transitions invoice to `sent` status.
   - Logs `activity_log.kind = 'invoice_sent'`.

6. **Client receives email.** Opens the PDF from their inbox (for filing) or clicks "View online" for the branded web experience.

7. **Client pays.**
   - **Bank transfer:** money lands in Andy's bank. Andy opens the invoice in Lite, clicks "Mark as paid." Invoice transitions to `paid`. Logs `activity_log.kind = 'invoice_marked_paid'`.
   - **Stripe online:** client clicks "Pay online" on the web view, Payment Element processes the payment. Stripe webhook fires `payment_intent.succeeded`. Webhook handler matches the payment to the invoice via metadata, transitions to `paid`. Logs `activity_log.kind = 'invoice_paid_online'`.

8. **If unpaid past due date:** scheduled-tasks worker transitions `sent` → `overdue`. Logs `activity_log.kind = 'invoice_overdue'`.

9. **Overdue reminder (due_at + 3 days):** `handleInvoiceOverdueReminder` fires. Claude-drafts a warm reminder email, drift-checked, dispatched via `sendEmail({ classification: 'transactional' })`. Logs `activity_log.kind = 'invoice_reminder_sent'`.

10. **Manual follow-ups:** Andy can click "Send reminder" on any overdue invoice at any time. Claude-drafts a contextual follow-up (aware of how many reminders have been sent, how long overdue). Andy previews and confirms before dispatch. Logs `activity_log.kind = 'invoice_reminder_sent'`.

11. **Chain-stop on subscription exit.** The self-perpetuating generate→send→generate chain stops the moment `deals.subscription_state` leaves `active_current` per the canonical state machine in FOUNDATIONS.md §12 — transitions to `cancel_scheduled_preterm`, `cancelled_buyout`, `cancelled_paid_remainder`, `cancelled_post_term`, or `ended_gracefully` all halt further cycles. Handlers check state on each run; a scheduled `manual_invoice_generate` that fires against a non-active subscription marks itself `skipped` and does not enqueue a successor.

### 3.2 Manual invoice creation

1. Andy opens a deal or company profile, clicks "New invoice."
2. System creates an invoice in `draft` status, seeded with the accepted quote's recurring line items (or blank if no active quote — covers one-off project billing).
3. Andy edits: adds/removes line items, adjusts amounts, sets due date (defaults to `companies.payment_terms_days` from today).
4. Andy clicks "Send." Same `sendInvoice()` pipeline as above.
5. This invoice is **not** part of the automated monthly chain — it's a standalone. Does not enqueue a next cycle.

### 3.3 Edit after send (supersede)

1. Andy realises a sent invoice has an error. Opens it, clicks "Edit."
2. System creates a new invoice row with `supersedes_invoice_id` pointing to the original. Original transitions to `void` status.
3. Original's web URL renders a gentle redirect card: "This invoice has been updated. View the current version →"
4. Andy edits the new draft, then sends. Client receives the corrected invoice. New invoice gets its own invoice number (next in sequence).
5. Logs `activity_log.kind = 'invoice_superseded'` on the original, `'invoice_generated'` + `'invoice_sent'` on the replacement.

---

## 4. Surfaces and UI

### 4.1 Invoice index page (`/lite/invoices`)

**Summary cards (top):**
- **Outstanding** — sum of `total_cents_inc_gst` where status IN (`sent`, `overdue`). Formatted as dollars inc-GST.
- **Overdue** — sum of `total_cents_inc_gst` where status = `overdue`. Red text if > 0.
- **Paid this month** — sum where status = `paid` AND `paid_at` within current calendar month.
- **Paid this FY** — sum where status = `paid` AND `paid_at` within current Australian financial year (1 Jul – 30 Jun).

**Filter tabs:** All / Draft / Sent / Overdue / Paid / Void. Each tab maps to a `?filter=<name>` query param so deep-links work — **`/lite/invoices?filter=overdue`** is the landing for the Daily Cockpit `finance_invoice_overdue` health-banner click-through (confirmed 2026-04-13 Phase 3.5 per Finance Dashboard patch). Query param drives initial tab selection; tab click updates the URL via `router.replace()`.

**List columns:** Invoice number, Client (company name), Total inc-GST, Issue date, Due date, Status badge (colour-coded). Sortable by any column. Search by client name or invoice number.

**Row click:** opens the invoice detail view (inline drawer or dedicated page — Phase 5 implementation decision; drawer recommended for consistency with Pipeline deal drawer pattern).

### 4.2 Company profile — Billing tab

A tab on the company profile showing:
- **Payment terms** — editable: `companies.payment_terms_days` with a simple dropdown (7 / 14 / 30 / 60 days).
- **Bank details for this company** — read-only display of SuperBad's bank details (BSB, account, company name as reference). Informational — these are the same details on every invoice.
- **Invoice list** — same list component as the index page, filtered to this company. No summary cards (the index page owns the aggregate view).
- **"New invoice" button** — creates a manual invoice for this company (§3.2 flow).

### 4.3 Invoice detail (admin view)

What Andy sees when he opens an invoice in Lite (from the index, company profile, or cockpit card):

- Invoice header: number, status badge, issue date, due date, company name.
- Line items table: description, quantity, unit price inc-GST, line total inc-GST. Recurring items marked with a subtle "recurring" label. Add-on items editable (only in `draft` status).
- Totals block: subtotal ex-GST, GST amount, total inc-GST.
- Scope summary (from accepted quote).
- Link to the accepted quote.
- **Actions (status-dependent):**
  - `draft`: "Add line item", "Send now", "Void", "Preview PDF", "Preview web view"
  - `sent`: "Mark as paid", "Send reminder", "Edit" (supersede), "Void", "View PDF", "View web page"
  - `overdue`: same as `sent` plus visual overdue indicator
  - `paid`: "View PDF", "View web page" (read-only)
  - `void`: "View PDF" (read-only), shows superseded-by link if applicable

### 4.4 Invoice web view (`/lite/invoices/[token]`) — client-facing

Token-authenticated, no sign-in required. Full branded experience with two scroll-snap sections.

**Section one — The Invoice:**
1. SuperBad masthead (logo, warm cream background, consistent with Quote Builder web page).
2. "Tax Invoice" title (ATO requirement) + invoice number + issue date + due date.
3. Billed-to block: company name, primary contact name, address if available.
4. Supplier block: SuperBad Media, ABN, contact email.
5. One-line scope summary pulled from the accepted quote's "What we'll do" section.
6. Line items table: description, quantity, unit price inc-GST, line total inc-GST.
7. Totals: subtotal ex-GST, GST amount (itemised — ATO requirement), **total inc-GST** (bold, prominent — the centrepiece number).
8. "View original proposal →" link to the accepted quote's web URL.

**Section two — Payment:**
1. Payment instructions heading.
2. Bank transfer details: BSB, account number, reference (invoice number). Presented first — primary expected method for manual-billed clients.
3. "Or pay online" — Stripe Payment Element, cinematic inline reveal (same Tier-2 motion pattern as Quote Builder). Inherits existing motion slot, no new slot spent.
4. Sprinkle footer line — dry line authored by content mini-session.
5. Fine print: ABN, payment terms, "questions? email hi@superbadmedia.com.au".

**Post-payment state (replaces section two after online payment):**
1. "Paid" badge — prominent, warm.
2. Receipt reference (Stripe payment ID).
3. "Download PDF" button (PDF now reflects paid status).
4. Sprinkle line: *"paid in full. pleasure doing business."*

**Overdue state:** section two gains a subtle but clear "This invoice is overdue" indicator above the payment options. Not aggressive — warm, factual.

**Void state (superseded invoice URL):** both sections replaced with a gentle redirect card: "This invoice has been updated." + "View the current version →" link to the replacement invoice. Same pattern as Quote Builder's superseded URL treatment.

### 4.5 Invoice PDF (`app/lite/invoices/[token]/pdf/page.tsx`)

Rendered via shared `renderToPdf()` pipeline (Puppeteer). One-page ATO-compliant tax invoice.

**Multi-document export support (confirmed 2026-04-13 Phase 3.5 per Finance Dashboard patch):** the `renderToPdf()` primitive exposes a `renderBundle()` variant that accepts an array of `{ template, data, filename }` entries and returns a single zip buffer. Finance Dashboard exports bundle 2 PDFs + 4 CSVs for BAS/EOFY handoffs; Quote Builder and Branded Invoicing themselves render single-document PDFs via the default `renderToPdf()` entry point. Implementation lives in `lib/pdf/render.ts`; consumers pass their template refs without knowing about zipping.

**Layout (top to bottom):**
1. SuperBad masthead (logo, brand colours).
2. **"Tax Invoice"** — ATO-required title, prominent.
3. Invoice number (`SB-INV-2026-0001`) + issue date + due date.
4. Billed-to block: company name, contact name, address if available.
5. Supplier block: SuperBad Media Pty Ltd, ABN [Andy's ABN], email, phone if applicable.
6. One-line scope summary (from accepted quote).
7. Line items table: description, qty, unit price inc-GST, line total inc-GST.
8. **Totals block:**
   - Subtotal (ex-GST)
   - GST (10%)
   - **Total (inc-GST)** — bold, largest number on the page
   - If `companies.gst_applicable = false`: no GST line, total = subtotal, note "GST not applicable"
9. Payment instructions: bank details (BSB + account + reference) + "Or pay online: [URL]"
10. "View original proposal →" [quote web URL]
11. Sprinkle footer line (dry, authored by content mini-session).
12. Fine print: ABN, "Tax invoice issued by SuperBad Media Pty Ltd", payment terms note.

**Paid variant:** when the PDF is downloaded after payment, adds a "PAID" watermark or stamp and the payment date. Totals block unchanged.

### 4.6 Invoice emails

All invoice emails are Claude-drafted, drift-checked against Brand DNA, and dispatched via `sendEmail({ classification: 'transactional' })` — bypassing §11.4 quiet window.

**Send email** (auto or manual dispatch):
- Subject: Claude-drafted, max 60 chars, contextual (e.g., "March invoice from SuperBad").
- Body: short contextual paragraph (reads Brand DNA + Context Engine), key details (invoice number, total, due date), "View online →" button.
- Attachment: invoice PDF.
- Threading: `In-Reply-To` / `References` headers for deal contact thread continuation (parallel to Quote Builder's threading pattern). `thread_message_id` stored on the invoice row.

**Overdue reminder** (automated, 3 days after due date):
- Subject: contextual, warm, not aggressive.
- Body: gentle nudge, references the invoice number and amount, "View online →" button.
- No PDF re-attachment (they already have it).
- Dispatched via `sendEmail({ classification: 'transactional' })`.

**Manual follow-up** (Andy-triggered, any time after overdue):
- Claude-drafted contextual chase email, aware of: how many reminders sent, how long overdue, Brand DNA + Context Engine.
- Andy previews before dispatch (same send-modal pattern as Quote Builder).
- "View online →" button included.

**Supersede notification** (when a sent invoice is voided and replaced):
- Subject: "Updated invoice from SuperBad" (or contextual variant).
- Body: "We've updated your invoice. The previous version (SB-INV-2026-0003) has been replaced." + "View updated invoice →" button.
- New PDF attached.

---

## 5. Data model

### 5.1 `invoices` (new table)

```
invoices
  id                           text pk (cuid)
  invoice_number               text unique not null        -- SB-INV-2026-0001
  deal_id                      text fk → deals.id not null
  company_id                   text fk → companies.id not null
  quote_id                     text fk → quotes.id nullable  -- null for manual invoices without a quote
  token                        text unique not null        -- URL token for client-facing access
  status                       enum: draft | sent | overdue | paid | void
  cycle_index                  integer nullable            -- 0-based; null for manual non-cycle invoices
  cycle_start                  date nullable               -- billing period start
  cycle_end                    date nullable               -- billing period end
  issue_date                   date not null
  due_at                       date not null               -- issue_date + companies.payment_terms_days
  paid_at                      timestamp_ms nullable       -- UTC epoch; set on mark-as-paid or Stripe webhook
  paid_via                     enum: bank_transfer | stripe nullable
  stripe_payment_intent_id     text nullable               -- set when paid via Stripe
  total_cents_inc_gst          integer not null             -- canonical GST-inclusive total
  total_cents_ex_gst           integer not null             -- derived: total ÷ 1.1 (rounded); equals total if !gst_applicable
  gst_cents                    integer not null             -- derived: total - ex_gst; 0 if !gst_applicable
  gst_applicable               boolean not null            -- snapshot from companies.gst_applicable at generation time
  line_items_json              jsonb not null               -- array of { description, quantity, unit_price_cents_inc_gst, line_total_cents_inc_gst, is_recurring }
  scope_summary                text nullable               -- one-line summary from accepted quote
  supersedes_invoice_id        text fk → invoices.id nullable
  thread_message_id            text nullable               -- email Message-ID for threading
  reminder_count               integer default 0           -- number of reminders sent (auto + manual)
  last_reminder_at             timestamp_ms nullable
  auto_send_at                 timestamp_ms nullable       -- when the review window expires (null for manual invoices)
  created_at                   timestamp_ms not null
  updated_at                   timestamp_ms not null
```

**Indexes:**
- `(company_id, status)` — company profile billing tab queries.
- `(status)` — index page filter queries.
- `(due_at, status)` — overdue sweep queries.
- `(token)` — unique, web view lookups.
- `(invoice_number)` — unique, search.

**Invoice number generation:** `SB-INV-{year}-{zero_padded_sequence}`. Sequence is per-year. Implementation: `SELECT MAX(sequence_number) FROM invoices WHERE year = :year` + 1, inside a transaction. Phase 5 can optimise with a `invoice_sequences` counter table if contention proves real (unlikely at Andy's scale).

### 5.2 Column additions to existing tables

**`companies` (additions):**
```
payment_terms_days             integer default 14          -- 7 | 14 | 30 | 60
```

Note: `companies.billing_mode` and `companies.gst_applicable` already exist from Pipeline and Quote Builder specs respectively.

**`activity_log.kind` enum additions** (8 new values):
- `invoice_generated`
- `invoice_sent`
- `invoice_overdue`
- `invoice_reminder_sent`
- `invoice_marked_paid`
- `invoice_paid_online`
- `invoice_superseded`
- `invoice_voided`

**`scheduled_tasks.task_type` enum additions** (2 new values):
- `manual_invoice_generate`
- `invoice_overdue_reminder`

Note: `manual_invoice_send` already exists in the enum from Quote Builder's spec.

---

## 6. Claude prompts

### 6.1 `draft-invoice-email.ts` (Opus-tier)

Drafts the send email when an invoice is dispatched.

**Input context:** Brand DNA profile, Client Context Engine summary, invoice details (number, total, due date, scope summary, cycle index), company name, contact name, previous invoice history for this company (count, last paid date).

**Output schema:** `{ subject_line: string (max 60 chars), body_paragraphs: string[], sign_off: string }`

**Constraints:** drift-checked against Brand DNA. No mention of the PDF attachment in the body (the email client handles attachment visibility). URL rendered as a button in HTML, excluded from Claude's body text. Warm, professional, brief — not a cover letter.

### 6.2 `draft-invoice-reminder.ts` (Opus-tier)

Drafts the overdue reminder (automated) and manual follow-up emails.

**Input context:** Brand DNA profile, Client Context Engine summary, invoice details, days overdue, reminder count (0 = first automated, 1+ = manual follow-ups), company payment history (reliable payer? first-time late?).

**Output schema:** `{ subject_line: string (max 60 chars), body_paragraphs: string[], sign_off: string }`

**Constraints:** drift-checked. Tone scales with context: first reminder is warm and assumes good faith; subsequent reminders are progressively more direct but never aggressive. Never threatens. Never uses the word "overdue" in the subject line of the first reminder.

### 6.3 `draft-supersede-notification.ts` (Haiku-tier)

Drafts the notification email when a sent invoice is superseded.

**Input context:** old invoice number, new invoice number, company name, contact name.

**Output schema:** `{ subject_line: string (max 60 chars), body_text: string }`

**Constraints:** short, functional, no drift-check needed (purely informational). One paragraph max.

---

## 7. Stripe integration

### 7.1 Payment Intent for online invoice payment

When a client clicks "Pay online" on the invoice web view:

1. Client-side creates a Payment Intent via API route (`app/api/lite/invoices/[token]/pay/route.ts`).
2. Payment Intent metadata: `{ invoice_id, deal_id, company_id, invoice_number }`.
3. Amount: `invoices.total_cents_inc_gst`.
4. Currency: AUD.
5. Payment Element renders inline (same component and Tier-2 motion pattern as Quote Builder).

### 7.2 Webhook handling

**`payment_intent.succeeded`:**
- Match via metadata `invoice_id`.
- Transition invoice to `paid`, set `paid_at`, `paid_via = 'stripe'`, `stripe_payment_intent_id`.
- Log `activity_log.kind = 'invoice_paid_online'`.
- Idempotent — check invoice isn't already `paid` before transitioning.

No Stripe Subscription involvement — manual-billed invoices are always one-off Payment Intents.

---

## 8. Scheduled-tasks integration

Branded Invoicing adds 2 new handler types to the existing scheduled-tasks worker (owned by Quote Builder's spec). All handlers follow the established patterns: idempotency keys, status precondition checks, retry with backoff, quiet-window bypass via `classification: 'transactional'`.

### 8.1 Handler: `handleManualInvoiceGenerate`

**Payload:** `{ deal_id, cycle_index, cycle_start, cycle_end }`

**Behaviour:**
1. Check deal is still in `won` status with `billing_mode = 'manual'`. If not: return `ok: true` (skip — deal cancelled or changed).
2. Call `generateInvoice({ deal_id, cycle_index, cycle_start, cycle_end })`.
3. Fire cockpit notification: "{Company}'s {month} invoice is ready for review — sends in 3 days."
4. Enqueue `manual_invoice_send` with `run_at = send_date` (3 days later).
5. Return `ok: true`.

**Idempotency key:** `manual_invoice_generate:{deal_id}:{cycle_index}`

### 8.2 Handler: `handleManualInvoiceSend` (updated from Quote Builder spec)

**Payload:** `{ deal_id, cycle_index, invoice_id }`

Note: Quote Builder's original handler signature was `{ deal_id, cycle_index, cycle_start, cycle_end }`. This spec refines it: the generate handler already created the invoice row, so the send handler receives the `invoice_id` directly. The `cycle_start` and `cycle_end` are on the invoice row. Quote Builder's spec described this handler as calling into Branded Invoicing's generation primitive — with the two-task split (Q22), generation is now a separate handler. `handleManualInvoiceSend` only sends.

**Behaviour:**
1. Read invoice row.
2. If `status = 'draft'`: call `sendInvoice(invoice_id)`.
3. If `status IN ('sent', 'paid')`: return `ok: true` (skip — Andy already sent manually, or already paid).
4. If `status = 'void'`: return `ok: true` (skip — Andy voided the draft).
5. On success: check deal is still active + within commitment. If yes: enqueue next cycle's `manual_invoice_generate` (cycle_index + 1, `run_at = next_send_date - 3 days`). If no: stop the chain.
6. Enqueue `invoice_overdue_reminder` with `run_at = due_at + 3 days`.
7. Return `ok: true`.

**Idempotency key:** `manual_invoice_send:{deal_id}:{cycle_index}`

### 8.3 Handler: `handleInvoiceOverdueReminder`

**Payload:** `{ invoice_id }`

**Behaviour:**
1. Read invoice row.
2. If `status != 'sent'` (paid, voided, or already transitioned to overdue and handled): return `ok: true` (skip).
3. Transition invoice to `overdue` if not already.
4. Claude-draft reminder email via `draft-invoice-reminder.ts`.
5. Dispatch via `sendEmail({ classification: 'transactional' })`.
6. Increment `reminder_count`, set `last_reminder_at`.
7. Log `activity_log.kind = 'invoice_reminder_sent'`.
8. Return `ok: true`.

**Idempotency key:** `invoice_overdue_reminder:{invoice_id}`

### 8.4 Overdue sweep

Separate from the reminder handler: a lightweight sweep that transitions `sent` → `overdue` for invoices past their due date. Runs as part of the scheduled-tasks worker's regular minute-by-minute poll cycle (not a separate cron). Implementation: a query in the worker's main loop that catches any invoice where `status = 'sent' AND due_at < now()` and transitions them, logging `invoice_overdue` for each. This ensures the status updates even if the reminder task hasn't fired yet.

---

## 9. The two-step primitive interface

### 9.1 `generateInvoice()`

**Location:** `lib/invoicing/generate.ts`

**Signature:**
```ts
generateInvoice(params: {
  deal_id: string;
  cycle_index?: number;       // null for manual non-cycle invoices
  cycle_start?: Date;
  cycle_end?: Date;
  source?: 'auto' | 'manual'; // default 'auto'
}) => Promise<{ ok: true; invoice_id: string } | { ok: false; error: string }>
```

**Behaviour:**
1. Read deal + company + accepted quote (if any).
2. Generate invoice number (next in year sequence).
3. Generate token (cryptographically random, URL-safe).
4. Copy recurring line items from quote's `content_json` (if quote exists).
5. Calculate `due_at = issue_date + companies.payment_terms_days`.
6. Derive GST: if `companies.gst_applicable`, ex-GST = `Math.round(total / 1.1)`, GST = total - ex-GST. If not applicable, ex-GST = total, GST = 0.
7. Snapshot `gst_applicable` from company record.
8. Create `invoices` row in `draft` status.
9. If `source = 'auto'`: set `auto_send_at = run_at + 3 days`.
10. Log `activity_log.kind = 'invoice_generated'`.
11. Return `{ ok: true, invoice_id }`.

### 9.2 `sendInvoice()`

**Location:** `lib/invoicing/send.ts`

**Signature:**
```ts
sendInvoice(params: {
  invoice_id: string;
}) => Promise<{ ok: true } | { ok: false; error: string }>
```

**Behaviour:**
1. Read invoice row. Assert `status = 'draft'`.
2. Recalculate totals (in case Andy added add-on line items).
3. Render PDF via `renderToPdf()` shared pipeline.
4. Claude-draft send email via `draft-invoice-email.ts`. Drift-check.
5. Dispatch email via `sendEmail({ classification: 'transactional' })` with PDF attached + "View online" link.
6. Store `thread_message_id` from Resend response.
7. Transition invoice to `sent`.
8. Log `activity_log.kind = 'invoice_sent'`.
9. Return `{ ok: true }`.

---

## 10. Voice & delight treatment

### 10.1 Ambient voice

**Invoice PDF footer:** dry one-liner on the unpaid document. Content mini-session authors this — must work as a sign-off on a document asking for money. Not celebratory, not demanding. Dry, warm, brief.

**Post-payment web view confirmation:** *"paid in full. pleasure doing business."* — earned moment, only appears after the client has actually paid. This is the §3 sprinkle claim from the sprinkle bank, split from the PDF footer because the PDF goes out before payment.

**Invoice emails:** Claude-drafted body inherits Brand DNA tone naturally. No additional ambient slot needed — the drift check ensures voice consistency.

### 10.2 Hidden eggs

**Fully suppressed.** No hidden eggs fire on any invoice surface (web view section one, web view section two, web view post-payment state, PDF, invoice emails). Invoices are trust surfaces — the client is looking at money they owe. Context-aware suppression is absolute, not cadence-gated.

### 10.3 Sprinkle bank updates

Claim §3 Invoice PDF footer in `docs/candidates/sprinkle-bank.md` — mark as `[CLAIMED by branded-invoicing]`. Split treatment: dry line on unpaid PDF (content mini-session), *"paid in full. pleasure doing business."* on web view paid confirmation.

---

## 11. Cross-spec flags

### 11.1 Quote Builder (`docs/specs/quote-builder.md`)

- **`handleManualInvoiceSend` handler updated.** The original Quote Builder spec described this handler as calling `generateInvoice()` + `sendInvoice()` in sequence. With the two-task split (Q22), `handleManualInvoiceGenerate` now handles generation and `handleManualInvoiceSend` only handles sending. The handler map in `lib/scheduled-tasks/handlers/index.ts` gains one new entry (`manual_invoice_generate`). The existing `manual_invoice_send` entry's behaviour narrows to send-only (no generation call).
- **First cycle enqueue at quote settle:** Quote Builder's settle handler for manual-billed quotes enqueues `manual_invoice_generate` (not `manual_invoice_send` as originally described). `run_at = first_invoice_date - 3 days`.

### 11.2 Sales Pipeline (`docs/specs/sales-pipeline.md`)

**New column on `companies`:**
- `payment_terms_days` integer default 14

**`activity_log.kind` enum additions** (8 new values): `invoice_generated`, `invoice_sent`, `invoice_overdue`, `invoice_reminder_sent`, `invoice_marked_paid`, `invoice_paid_online`, `invoice_superseded`, `invoice_voided`.

### 11.3 Daily Cockpit (`docs/specs/daily-cockpit.md`)

Must consume and surface:
- **Draft review window cards:** "ACME's March invoice is ready for review — sends in 3 days." Actionable — click opens the invoice detail.
- **Overdue invoice cards:** "{Company} invoice SB-INV-2026-0003 is {N} days overdue ({amount})." Actionable — click opens the invoice.
- **Failed invoice task alerts:** if `handleManualInvoiceSend` or `handleManualInvoiceGenerate` fail after retries, cockpit shows an escalation card.

### 11.4 Client Management (`docs/specs/client-management.md`)

- Company profile gains a **Billing tab** (§4.2) showing payment terms, invoice list, and "New invoice" button.
- The "my invoices" link on Quote Builder's manual-billed confirmation screen (Q16 in that spec) points to this billing tab or a client-portal equivalent.

### 11.5 Client Portal (currently rolled into Client Management)

- Client portal must render an "Invoices" section showing that client's invoices with status, amounts, and "View" links to the token-URL web view.
- No edit, no create, no mark-as-paid from the portal — read-only + pay-online only.

### 11.6 Comms Inbox (`docs/specs/unified-inbox.md`)

- Invoice emails (send, reminder, follow-up, supersede notification) must thread correctly with the deal's contact thread via `In-Reply-To` / `References` headers, same pattern as Quote Builder.

### 11.7 Foundations (`FOUNDATIONS.md`)

- The `sendEmail()` gate's `classification: 'transactional'` parameter (already owed from Task Manager and Quote Builder) is used by every Branded Invoicing email. Transactional classification bypasses §11.4 quiet window. This patch must land in Phase 5 before Branded Invoicing build sessions.

### 11.8 Design System Baseline (`docs/specs/design-system-baseline.md`)

- No new Tier-2 motion slots (Payment Element reveal inherits existing slot).
- No new sound registry slots (invoice payment is not a cockpit-audible event — the payment is the client's action, not Andy's; `sound:quote_accepted` is the Andy-side moment).

---

## 12. Content mini-session scope (deferred — owed before Phase 5 build)

A short creative session to author:

1. **Invoice PDF footer line** — dry one-liner for the unpaid document. Must work as a sign-off on a financial document. Not the same register as the quote PDF cover line.
2. **Invoice email prompts** — example outputs for: send email, first overdue reminder, second follow-up, supersede notification. Feeds into the Claude prompt constraints.
3. **Invoice web view copy** — section headings, payment instructions copy, overdue indicator text, void/superseded redirect card copy, post-payment confirmation copy (beyond the locked *"paid in full. pleasure doing business."*).
4. **Empty-state copy** — what the invoice index page shows when there are no invoices yet.

Smaller scope than Quote Builder's content mini-session. Can run as part of the same session or independently.

---

## 13. Open questions (resolve in Phase 5)

1. **PDF storage vs on-demand rendering.** Store the PDF buffer after first render (faster for re-downloads, but stale if the paid status changes) or re-render on every download (always current, but Puppeteer cost per request). Recommendation: store after send, re-render only when status changes (paid stamp added). Resolve in build.
2. **Bank details source.** SuperBad's BSB + account number need to live somewhere in Lite's config. Likely a Settings page or environment variable. Resolve in the setup wizard spec or Phase 5 infra session.
3. **Address on invoices.** The billed-to block shows company address "if available." The Pipeline's `companies` table may not have an address field yet. If not, either add one or omit the address line. Resolve when the company profile form is built.

---

## 14. Risks

1. **ATO compliance is a checklist, not a technical challenge — but the checklist matters.** Missing any of the required fields (ABN, "Tax Invoice" title, itemised GST, globally unique number) means the document isn't a valid tax invoice. Phase 5 build session should have the ATO checklist open during PDF template development.

2. **Review window edge cases.** Andy voids a draft during the review window, then the send task fires and finds a voided invoice. Handled by the status precondition check in `handleManualInvoiceSend` — but every edge case (void, supersede, manual send, deal cancellation mid-window) needs explicit coverage in the handler logic.

3. **GST derivation rounding.** Dividing by 1.1 can produce fractional cents. The spec uses `Math.round()` — standard practice, but the sum of rounded line-item ex-GST values might not equal the rounded total ex-GST. Resolve by deriving GST at the total level only, not per line item.

4. **Chain perpetuation on deal lifecycle changes.** If a deal is paused, cancelled, or its billing mode changes mid-chain, the next `manual_invoice_send` handler must detect this and stop the chain cleanly. The status precondition check handles cancellation; pause and billing-mode change need explicit checks added.

---

## 15. Reality check

Branded Invoicing is a medium-weight spec that assembles proven patterns from Quote Builder (supersede, scheduled-tasks, PDF rendering, Payment Element, email threading) and Intro Funnel (cinematic web view, token-URL access) into a new configuration. No new infrastructure is introduced — the scheduled-tasks worker, the PDF renderer, the email pipeline, and the Payment Element are all established.

**Hardest piece:** the review window lifecycle (Q21–Q23). The two-task-per-cycle pattern with cockpit notifications, optional Andy intervention, and status-aware send handler has the most edge cases. Each individual edge case is simple, but they compound.

**Build estimate:** 2 sessions.
- **Session A:** data model, `generateInvoice()` + `sendInvoice()` primitives, all 3 scheduled-tasks handlers, overdue sweep, PDF template, mark-as-paid. No UI beyond the PDF.
- **Session B:** invoice web view (two scroll-snap sections + Payment Element + post-payment confirmation), invoice index page + summary cards, company profile billing tab, invoice detail admin view, manual create flow, manual follow-up flow.

Session A should land before Quote Builder Phase 5 Session C, which wires `handleManualInvoiceSend` into the worker's handler map.

**What could go wrong:** the review window creates a 3-day gap where the invoice exists in `draft` and things can change (deal cancelled, quote superseded, Andy voids the draft). Every handler must be defensive about stale state. The handlers are simple individually — the discipline is making sure none of them assume the world hasn't changed since they were enqueued.
