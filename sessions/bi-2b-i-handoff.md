# BI-2b-i — Branded Invoicing integrations (Stripe + client UI) — Handoff

**Closed:** 2026-04-15
**Brief:** `sessions/bi-2b-brief.md` (split into bi-2b-i + bi-2b-ii at session start; this half = Stripe + client UI + env + tests)
**Model:** Opus (`/deep`) — integration-heavy Stripe + webhook branch + client UX.
**Type:** FEATURE
**Rollback:** no kill-switch introduced. Revert = delete new files + revert webhook-handler + QB PaymentElement + `.env.example` edits + `/lite/invoices/[token]/page.tsx` rewrite. No schema change. No migration. No settings keys touched.

## What shipped

- **`lib/invoicing/load-public-invoice.ts`** — NEW. Token loader for the public invoice surface. Returns null for draft / unknown. Inverse supersede query on `invoices.supersedes_invoice_id` surfaces `supersededByToken`; carries `sourceQuoteToken` through when `invoice.quote_id` is set. Returns `{invoice, company, deal, primaryContact, sourceQuoteToken, supersededByToken}`.
- **`app/api/invoices/[token]/payment-intent/route.ts`** — NEW. POST mirrors the QB PI route. Guards on `invoice.status ∈ {sent, overdue}`. Reuses existing PI if status ≠ succeeded/canceled and amount unchanged. Calls `ensureStripeCustomer(primaryContact?.id ?? "company:${company.id}")` (FOUNDATIONS §11.7 primitive); on fresh customer, best-effort stamps email + name. Creates PI `amount=total_cents_inc_gst` AUD, `automatic_payment_methods.enabled`, `idempotencyKey: invoice_pi:{id}`, metadata `{product_type:"invoice", invoice_id, invoice_number, deal_id, company_id}`. Stamps `invoices.stripe_payment_intent_id` + back-fills `deals.stripe_customer_id` when missing.
- **`lib/stripe/webhook-handlers/payment-intent-succeeded.ts`** — EDITED. Added `product_type === "invoice"` branch BEFORE the quote check. New `handleInvoicePaymentIntentSucceeded()` calls `markInvoicePaid({invoice_id, paid_via:"stripe", stripe_payment_intent_id, nowMs}, database)`, back-fills `deals.stripe_customer_id` when absent. Idempotent via `markInvoicePaid`'s `alreadyPaid` short-circuit — re-delivered events are no-ops.
- **`lib/stripe/webhook-handlers/payment-intent-failed.ts`** — EDITED. Added `product_type === "invoice"` branch. New `handleInvoicePaymentIntentFailed()` does a direct `activity_log` insert with `kind:"note"`, `meta.kind:"invoice_payment_failed"`, stamps `failure_code`, `failure_message`, `stripe_payment_intent_id`, `event_id`. Invoice stays in `sent`/`overdue`.
- **`components/lite/quote-builder/quote-payment-element.tsx`** — EDITED. Added `paymentIntentEndpoint?: string` prop; defaults to `/api/quotes/${token}/payment-intent`. Dep array updated. Enables invoice reuse of `PaymentElementHost` without duplicating ~155 lines.
- **`components/lite/invoices/invoice-web-experience.tsx`** — NEW (~440 lines). Two-section scroll-snap client (§4.4). Fixed section-dots indicator on left. Section 1 = invoice body (hero, metadata, line items, totals, footnote). Section 2 = payment (bank transfer card first, then Payment Element in `motion.div layoutId="quote-primary-action"` with `houseSpring`). Overdue banner shown in section 2. `PaidConfirmation` sub-component replaces section 2 when status=paid. Testids: `scroll-hint`, `invoice-overdue-banner`, `invoice-payment-element`, `invoice-pay-button`, `invoice-paid-confirmation`.
- **`components/lite/invoices/superseded-invoice-card.tsx`** — NEW. Void-state card. Replacement variant → "This invoice has been updated." + "View the current version →" link to `/lite/invoices/${replacementToken}`. No-replacement variant → "This invoice is no longer valid." + `hi@superbadmedia.com.au` reach-out. Testids: `invoice-void-card`, `invoice-void-replacement-link`.
- **`app/lite/invoices/[token]/page.tsx`** — REWRITTEN (from BI-1b min-viable). Server Component. Uses `loadPublicInvoiceByToken`. Void → `SupersededInvoiceCard`. Else → `InvoiceWebExperience`. `bankDetailsFromEnv()` reads `SUPERBAD_BANK_*` with "To be confirmed" fallbacks.
- **`.env.example`** — EDITED. Added `SUPERBAD_ABN`, `SUPERBAD_BILLING_EMAIL`, `SUPERBAD_BANK_ACCOUNT_NAME`, `SUPERBAD_BANK_BSB`, `SUPERBAD_BANK_ACCOUNT_NUMBER` with explanatory block (pre-launch: populate in Coolify before first paid invoice leaves the platform).
- **`tests/stripe/dispatch-payment-intent-invoice.test.ts`** — NEW. 8 tests covering webhook invoice branch: missing invoice_id (both succeeded + failed), unknown invoice_id, happy-path flip sent→paid with PI stamp, idempotent re-delivery (exactly one `invoice_paid_online` log, `paid_at_ms` unchanged), `deals.stripe_customer_id` back-fill + preservation-when-set, failure-branch logs `invoice_payment_failed` with code/message.

## Decisions

- **BI-2b pre-split into bi-2b-i + bi-2b-ii at session start.** User elected option B. This half = Stripe PI route + webhook invoice branches + scroll-snap client + `ensureStripeCustomer` precondition + env-seed + webhook tests. Deferred to **bi-2b-ii**: 4 Claude-drafted email prompts (`invoice-send`, `invoice-overdue-reminder`, `invoice-manual-followup`, `invoice-supersede`) + registry slugs + drift-check wiring + manual-follow-up send modal + `sessions/bi-e2e-brief.md` (G11.b wave closer).
- **`PaymentElementHost` reused, not duplicated.** Parameterised via `paymentIntentEndpoint` prop. Cheaper than forking; all Stripe Element concerns (`<Elements>`, `loadStripe`, `confirmPayment({redirect:"if_required"})`) live in one place.
- **Void state handled server-side.** Full-page takeover; no point mounting `InvoiceWebExperience` just to hide it. `page.tsx` branches into `SupersededInvoiceCard`.
- **Contact fallback for `ensureStripeCustomer`.** When a deal has no `primary_contact_id`, the PI route passes `company:${company.id}` as the synthetic contact id. The primitive keys the customer cache on that string; no collision with real contact ids.
- **Tier-2 morph: `layoutId="quote-primary-action"` shared across quote accept + invoice pay.** Same token intentional — one animated primary-action surface across every public client buy-button flow.
- **`handleInvoicePaymentIntentSucceeded` casts `database as typeof defaultDb` when calling `markInvoicePaid`.** The primitive types its `dbOverride` strictly; the handler's local `Db` union (`BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb`) is looser. Cast is safe — both arms use the same real schema — and keeps the primitive's contract tight.
- **Backfill-only on `deals.stripe_customer_id`.** When absent: stamp. When set: leave alone. Stops a drifting PI.customer (unlikely but possible via Stripe customer portal merges) from clobbering the canonical deal-side id.
- **No E2E in this half.** Brief's G11.b defers Playwright to wave-closer; `sessions/bi-e2e-brief.md` will be written at end of bi-2b-ii.
- **`qbe2e_manual_quote_settled_missing` PATCHES_OWED row untouched.** BI-2b doesn't replace the quote-settle log path; still owed separately.

## Files touched

| File | Change |
| --- | --- |
| `lib/invoicing/load-public-invoice.ts` | NEW |
| `app/api/invoices/[token]/payment-intent/route.ts` | NEW |
| `lib/stripe/webhook-handlers/payment-intent-succeeded.ts` | Invoice branch + handler |
| `lib/stripe/webhook-handlers/payment-intent-failed.ts` | Invoice branch + handler |
| `components/lite/quote-builder/quote-payment-element.tsx` | `paymentIntentEndpoint` prop |
| `components/lite/invoices/invoice-web-experience.tsx` | NEW |
| `components/lite/invoices/superseded-invoice-card.tsx` | NEW |
| `app/lite/invoices/[token]/page.tsx` | Rewritten (void branch + web experience) |
| `.env.example` | SUPERBAD_ABN + billing email + bank details block |
| `tests/stripe/dispatch-payment-intent-invoice.test.ts` | NEW (8 tests) |

## Verification

- `npx tsc --noEmit` → 0 errors.
- `npm test` → **683 passed / 1 skipped / 0 failed** (was 675/1/0; +8 new invoice webhook tests).
- G4 literal grep: new modules use env-sourced strings + fallbacks, no hardcoded placeholder literals.
- Manual browser check **deferred** — bi-2b-ii ships the Claude emails + send modal; full walkthrough belongs at wave-close alongside the E2E spec.

## What's owed / next

1. **bi-2b-ii**: 4 Claude prompts + registry slugs + drift-check + manual-follow-up send modal + `sessions/bi-e2e-brief.md`.
2. **Manual browser check** of `/lite/invoices/[token]`: sent → Payment Element mounts + confirms + webhook flips status; overdue → banner shown; paid → confirmation card + PDF download; void → superseded card (with + without replacement). Do at wave close.
3. **`qbe2e_manual_quote_settled_missing`** still open in PATCHES_OWED — unrelated; carry forward.
4. **Pre-launch**: populate `SUPERBAD_ABN` + bank details in Coolify production env before first paid invoice.
