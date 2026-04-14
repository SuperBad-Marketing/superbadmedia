# BI-1b brief — Branded Invoicing PDF + kill-switch flip

**Wave:** 7. **Tier:** `/normal` (Sonnet). **Pre-authored by:** BI-1a (G11.b).

## Why this session

BI-1a landed the full manual-invoice pipeline behind the still-false kill-switch: schema, primitives, scheduled-task handlers, sweep, mark-paid, 24 new tests green. The pipeline is ready — but invoices can't be viewed or PDF'd yet, so the switch stays off. BI-1b builds the view + PDF layer and, as the final commit, flips `killSwitches.invoicing_manual_cycle_enqueue_enabled → true`. No admin UI — that lands in BI-2.

## Pre-conditions (verify before coding)

- Read `sessions/bi-1a-handoff.md` end-to-end.
- `killSwitches.invoicing_manual_cycle_enqueue_enabled === false` — grep to confirm.
- `INVOICING_HANDLERS` registered in `lib/scheduled-tasks/handlers/index.ts` and green.
- Puppeteer + `lib/pdf/render.ts` already in place from QB-3 — reuse it.
- `docs/specs/branded-invoicing.md` — §PDF/§view/§token — read these sections freshly.

## Expected scope

In-scope:
1. `lib/invoicing/pdf-template.tsx` + `lib/invoicing/render-invoice-pdf.ts` — mirrors `lib/quote-builder/{pdf-template,render-quote-pdf}.ts`. Filename: `SuperBad-Invoice-{slug}-{number}.pdf`.
2. `/api/invoices/[token]/pdf/route.ts` — token lookup on `invoices.token`; 404 on miss; streams PDF with `Content-Disposition`.
3. `/lite/invoices/[token]/page.tsx` — read-only web view (subject, total, line items, due date, "Download PDF" link, "Mark as paid via bank transfer" is BI-2 admin surface only). Proxy allowlist update for the `/lite/invoices/` public route tree.
4. **Flip kill-switch** — `lib/kill-switches.ts` `invoicing_manual_cycle_enqueue_enabled: true` as the **last** commit, after all else green. Update QB-E2E `qb-e2e.spec.ts` precondition assertion.
5. Handoff + `sessions/bi-2-brief.md` for the admin+client UI wave.

Out-of-scope (defer to BI-2):
- Admin compose/edit/supersede UI.
- Client "Pay online" Stripe Element mount.
- Claude-drafted email variants + drift-check.
- Overdue "Mark as paid" admin button.

## Gates (G0–G12)

- G0–G3 pre-reads (spec + registry + kill-switches).
- G4 literal-grep — PDF layout is UI, not autonomy; no settings expected.
- G5 rollback — flipping the switch back to `false` is the rollback; handlers remain safely behind the accept.ts gate.
- G10.5 external reviewer — PASS or PASS_WITH_NOTES before flip.
- G11.b — write `sessions/bi-2-brief.md` before close.

## Open items carried forward from BI-1a

- `bi1_ensure_stripe_customer_precondition` — PATCHES_OWED, check for relevance; stripe-billed deals use native Stripe invoices so may already be moot.
- Claude-drafted invoice-email prompts (`lib/ai/prompts/branded-invoicing/`) deferred to BI-2.
