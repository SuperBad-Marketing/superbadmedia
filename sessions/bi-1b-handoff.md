# BI-1b handoff — Branded Invoicing PDF + kill-switch flip

**Wave:** 7. **Tier:** `/normal` (Sonnet). **Closed:** 2026-04-15.

## What landed

- **PDF template** — `lib/invoicing/pdf-template.tsx`. ATO-compliant tax invoice: masthead, "Tax Invoice" title (brand red), invoice number + issued + due meta, `Billed to` + `From` parties block (ABN on both sides), optional scope-summary banner, line-items table, totals block with GST itemised when applicable (GST-not-applicable note otherwise), overdue + void banners, pay-CTA card hidden on paid/void, PAID stamp overlay + payment date on `status==="paid"`, terms link footer. Mirrors `lib/quote-builder/pdf-template.ts` visual language; shares `companySlug` import. Filename `SuperBad-Invoice-{company-slug}-{invoice-number}.pdf`.
- **Supplier profile primitive** — `defaultSupplier()` exported from `pdf-template.tsx`. Reads `SUPERBAD_ABN` + `SUPERBAD_BILLING_EMAIL` from env with fallbacks (`"ABN to confirm"` / `"hi@superbadmedia.com.au"`). Pre-flip env-seeding is a BI-2 / launch-gate concern — reviewer note #1.
- **Render helper** — `lib/invoicing/render-invoice-pdf.ts` (`renderInvoicePdf(id)`). Reproducible from invoice id alone per §4.5: reads invoice → company → deal → primary contact → optional source quote, builds absolute `invoiceUrl`/`quoteUrl`/`termsUrl`, calls shared `renderToPdf()` Puppeteer driver. No session/cookie state.
- **Token-gated PDF route** — `app/api/invoices/[token]/pdf/route.ts`. 404 on token miss, streams `application/pdf` with `Content-Disposition: inline; filename="…"`. No status gating (paid/overdue/void all render — template variant selection is intrinsic).
- **Public read-only web view** — `app/lite/invoices/[token]/page.tsx`. Minimum viable per brief: masthead + Tax-Invoice title, invoice number / issued / due, billed-to + from blocks, optional scope-summary banner, line-items table, GST-itemised totals, status banners (overdue/void), PAID badge, Download-PDF CTA, optional "View original proposal" link, terms-link footer. Server component, `export const dynamic = "force-dynamic"`, `generateMetadata()` with `robots: noindex`. Scroll-snap two-section + Stripe Payment Element + post-payment confirmation + "Mark as paid" admin button all deferred to BI-2.
- **Proxy allowlist** — `/lite/invoices/` added to `proxy.ts` `isPublicRoute()`, directly after the `/lite/quotes/` line. Anonymous token access.
- **Kill-switch flip** — `killSwitches.invoicing_manual_cycle_enqueue_enabled: false → true`. Comment updated to record the flip date + rationale. `accept.ts` gate at line 210 now unlocks `manual_invoice_generate` enqueue on retainer accept.
- **QB-E2E precondition update** — `tests/e2e/qb-e2e.spec.ts` precondition flipped `toBe(false) → toBe(true)`; post-accept assertion flipped `toHaveLength(0) → toHaveLength(1)` to reflect that accept now enqueues exactly one first-cycle generate task.
- **Tests** — `tests/bi1b-invoice-pdf-template.test.ts` (8 new): filename derivation, GST-applicable render (itemised totals + quote-link), GST-not-applicable path, paid-stamp variant + pay-CTA suppression, overdue banner, void banner + pay-CTA suppression, missing-contact / missing-source-quote graceful render, `defaultSupplier()` env-fallback.

## Kill-switch

`invoicing_manual_cycle_enqueue_enabled === true` in committed code. Rollback path: flip back to `false` + re-flip the two `qb-e2e.spec.ts` assertions. Scheduled-task handlers remain safely behind the `accept.ts` gate — if the switch flips back, no in-flight `manual_invoice_generate` tasks can be freshly enqueued.

## Verification

- `npx tsc --noEmit` — zero errors.
- `npm test` — 668 passed, 1 skipped, 0 failed (660 → 668: +8 new tests).
- Playwright QB-E2E (`tests/e2e/qb-e2e.spec.ts`) — assertion set updated; not rerun in this session (unit test runner doesn't execute Playwright). Next build session that touches the quote-accept flow (or the BI-E2E session) will exercise it.
- G4 literal grep — no autonomy literals introduced; PDF layout is UI.
- G10.5 external reviewer — **PASS_WITH_NOTES** (before flip). Concerns recorded below.

## G10.5 reviewer notes

1. `SUPERBAD_ABN` env fallback renders the literal string "ABN to confirm" on invoices until the env var is set. Track on pre-launch checklist + BI-2 brief — non-blocking for this session.
2. Token-miss returns 404 with no body leakage; no audit logging. Acceptable for v1.
3. Metadata API handles robots/noindex correctly — belt-and-braces check only.
4. BI-2 brief (below) satisfies G11.b.

## PATCHES_OWED changes

- Narrowed `branded-invoicing.md · Add ensureStripeCustomer() precondition …` row gate from "Phase 5 Branded Invoicing build session" to "BI-2 build session" — BI-1a/b ship zero Stripe-touching paths; all Stripe Payment Element mounting + `payment_intent.succeeded` handling is BI-2. Rationale recorded inline in `PATCHES_OWED.md`.

## Opens for BI-2

Admin compose/edit/supersede UI; client-facing Stripe Payment Element (two-section scroll-snap layout per spec §4.4); Claude-drafted email variants (send / overdue reminder / manual follow-up / supersede) under `lib/ai/prompts/branded-invoicing/` with drift-check; overdue "Send reminder" manual button; post-payment confirmation state; scope-summary auto-derivation from accepted quote; pre-send review UI for the 3-day auto-send window; SUPERBAD_ABN / SUPERBAD_BILLING_EMAIL env seeding on deploy target. Full brief: `sessions/bi-2-brief.md`.
