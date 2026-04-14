# BI-1 brief — Branded Invoicing kickoff

**Wave:** 7. **Tier:** `/normal` (Sonnet). **Pre-authored by:** QB-E2E session (G11.b).

## Why this session

QB-E2E shipped with a precondition test that locks `killSwitches.invoicing_manual_cycle_enqueue_enabled === false` — QB-6 originally gated the manual-invoice enqueue on it. BI-1 is the session that builds the manual-invoice pipeline and (at session end) flips that kill-switch to true. The branded-invoicing spec (`docs/specs/branded-invoicing.md`) is the authoritative scope; read it first.

## Pre-conditions (verify before coding)

- `docs/specs/branded-invoicing.md` exists and was touched in Phase 3.5 reconciliation — confirm.
- `killSwitches.invoicing_manual_cycle_enqueue_enabled === false` — grep it, do not trust memory.
- `scheduled_tasks` worker (QB-6) is in place with the `manual_invoice_generate` task_type reserved but not yet handled.
- BI-1 spec §X (check the spec for actual section numbers) covers the admin compose/preview/send flow for manual invoices.

## Expected scope (read the spec to confirm, don't take this as gospel)

Likely in-scope:
- Invoice data model (if not already in schema — may already exist from Phase 4 migrations).
- `lib/invoicing/generate-manual-invoice.ts` — pure generator, takes a deal/quote pair + period, returns an invoice draft.
- `lib/invoicing/handlers/manual-invoice-generate.ts` — scheduled_tasks worker handler.
- Admin surface for preview + send (probably one route, one action, one modal per house pattern).
- Email classification `invoice_sent` (+ reminder variants per spec).
- LLM slug for invoice body copy if spec calls for it.

Likely out-of-scope (defer to BI-2 / BI-3):
- Payment receipt / reconciliation.
- Overdue dunning.
- BI-E2E (that's a post-BI-stack session).

## Gates (G0–G12 per AUTONOMY_PROTOCOL)

- G0–G3 precondition reads: spec, settings registry, kill-switches file.
- G4 literal-grep audit: any new autonomy thresholds or durations must come from `settings.get()`, not literals.
- G5 rollback plan: kill-switch flip is itself the rollback hook. Document it.
- G10.5 external-reviewer gate: PASS or PASS_WITH_NOTES before close.
- G11.b: author next-wave brief before close (likely BI-2 or BI-E2E depending on how far BI-1 gets).

## Open items carried in from QB-E2E

- `qbe2e_manual_quote_settled_missing` — if BI-1 touches the manual accept/settle path, consider closing this alongside.

## Constraints

- No Stripe APIs in this session (manual invoices are the point).
- No schema changes if existing migrations already cover invoices — read before editing.
- Kill-switch flip happens at the end of the session as the last commit, not the first.
