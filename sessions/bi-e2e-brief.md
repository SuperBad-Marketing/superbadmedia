# `bi-e2e` — Branded Invoicing E2E (online payment flow) — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0. Read only this file at session start.**

---

## 1. Identity

- **Session id:** `bi-e2e`
- **Wave:** 7 — Branded Invoicing (closing gate)
- **Type:** `INFRA` (Playwright E2E — the §G12 critical-flow test for
  the invoice-pay path; pairs with `qb-e2e.spec.ts` from Wave 6).
- **Model tier:** `/normal` (Sonnet). Test authoring against shipped
  code — no state-machine design.
- **Sonnet-safe:** `yes`
- **Estimated context:** `medium`

## 2. Spec references

- `docs/specs/branded-invoicing.md` §3 (public web experience) +
  §4 (online payment) + §5 (webhook branches) + §8 (scheduled chain).
- `AUTONOMY_PROTOCOL.md` §G12 — Playwright E2E mandatory on the five
  critical flows; BI-E2E covers `quote accept → manual_invoice_generate
  → send → token open → Payment Element → webhook → paid`.
- `BUILD_PLAN.md` Wave 7 — BI-E2E is the wave closer.

## 2a. Visual references

- Public surface binding reference: shipped `/lite/invoices/[token]`
  page (`components/lite/invoices/invoice-web-experience.tsx`).
- Admin drawer not in scope for E2E — UI hooks + server actions are
  the assert target.

## 3. Acceptance criteria (verbatim, from spec §3 + §5)

```
E2E scenario (online-payment path — the one §G12 mandates):

  1. Seed via `scripts/seed-bi-e2e.ts` (reuse `scripts/seed-qb-e2e.ts`
     + `scripts/seed-pipeline.ts` fixture patterns):
       - Admin user + company + contact + won deal with Stripe billing.
       - A generated draft invoice (cycle 0) produced by
         `generateInvoice({source: "manual"})`.
       - Kill switches: `invoicing_manual_cycle_enqueue_enabled=true`,
         `llm_calls_enabled=false` (deterministic email path — we are
         testing payment plumbing, not Claude drafting).

  2. Admin route — drive `/lite/admin/invoices` drawer "Send now".
     Assert:
       - invoice status = sent
       - activity_log row kind=invoice_sent
       - scheduled_tasks row invoice_overdue_reminder enqueued

  3. Public route — load `/lite/invoices/[token]` in a fresh context
     (no admin session). Assert page renders with invoice number,
     total, and Payment Element section.

  4. Stripe mode — POST `/api/invoices/[token]/payment-intent` with
     the public token. Assert response carries clientSecret and the
     idempotencyKey `invoice_pi:{id}` pattern was honoured (re-POST
     returns same PI id).

  5. Simulate webhook — POST a crafted `payment_intent.succeeded`
     event to `/api/stripe/webhook` (test secret; mirror the harness
     in `tests/stripe/dispatch-payment-intent-invoice.test.ts`). The
     event carries `metadata.product_type="invoice"` +
     `metadata.invoice_id={id}`.

  6. Assert:
       - invoice status = paid
       - invoice.paid_via = stripe
       - invoice.paid_at_ms stamped
       - activity_log row kind=invoice_paid exists
       - public page now renders the "Payment received" confirmation
         variant (re-GET /lite/invoices/[token]).
       - idempotent re-delivery of the same webhook is a no-op
         (alreadyPaid short-circuit).
```

Stripe bank-transfer path is **out of scope** for this E2E (covered
by unit tests in `bi-2a-supersede.test.ts` + admin drawer flow).

## 4. Skill whitelist

- `webapp-testing` — Playwright config + patterns.
- `nextauth` — admin session seeding (reuse `qb-e2e` admin-session
  helper if it landed, else port the pattern).
- `drizzle-orm` — fixture seeding.

## 5. File whitelist

- `scripts/seed-bi-e2e.ts` — NEW — deterministic fixtures (company,
  contact, won deal with `stripe_billing_mode`, generated draft
  invoice, admin user).
- `tests/e2e/bi-e2e.spec.ts` — NEW — the spec above.
- `tests/e2e/helpers/stripe-webhook.ts` — NEW if not present —
  crafts a signed `payment_intent.succeeded` event against the local
  webhook secret so the Playwright runner can POST it. Reuse the
  signature math from `tests/stripe/dispatch-payment-intent-invoice.test.ts`.
- `tests/e2e/helpers/admin-session.ts` — REUSE from `qb-e2e` (if
  landed) or port.
- `playwright.config.ts` — MODIFY if needed to register the new spec;
  no new `webServer` block (share the `qb-e2e` one).
- `sessions/bi-e2e-handoff.md` — NEW.
- `sessions/<next>-brief.md` — NEW per G11.b. Likely target: Wave 8
  kickoff (Client Portal — the early-cancel + pause/resume surfaces
  QB-8 shipped data-plane for). Confirm against `BUILD_PLAN.md` at
  session start.

## 6. Settings keys touched

- **Reads:** `invoicing_manual_cycle_enqueue_enabled` (must be `true`
  by now — BI-1b flipped it), `llm_calls_enabled` (set `false` for
  deterministic email path in the test env).
- **Seeds:** none.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] Playwright installed (landed in QB-E2E) — `ls node_modules/@playwright/test`.
- [ ] `playwright.config.ts` exists with a `webServer` block using
  `next build && next start` (QB-E2E locked this in).
- [ ] Public invoice route exists —
  `ls app/lite/invoices/\[token\]/page.tsx`.
- [ ] Payment-intent route exists —
  `ls app/api/invoices/\[token\]/payment-intent/route.ts`.
- [ ] Webhook invoice branches exist —
  `grep -n "product_type.*invoice" lib/stripe/webhook-handlers/payment-intent-succeeded.ts lib/stripe/webhook-handlers/payment-intent-failed.ts`.
- [ ] Kill switch flipped —
  `grep -n "invoicing_manual_cycle_enqueue_enabled" lib/kill-switches.ts`
  (value should be `true`).

## 8. Rollback strategy (G6)

`git-revertable`. Purely additive — seed script + Playwright spec +
test-only helpers. No schema, no env, no public surfaces touched.
If Stripe webhook-signing helper needs to land, it lives in
`tests/e2e/helpers/` and has no production caller.

## 9. Definition of done

- [ ] `scripts/seed-bi-e2e.ts` idempotently seeds the fixture set.
- [ ] `tests/e2e/bi-e2e.spec.ts` green, covers §3 end-to-end.
- [ ] QB-E2E spec still green (no config regression).
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → 689+/1/0 green.
- [ ] `npx playwright test` → all specs green.
- [ ] G4 literal grep — no new autonomy thresholds.
- [ ] G10.5 external-reviewer gate — PASS or PASS_WITH_NOTES.
- [ ] Memory-alignment declaration in handoff.
- [ ] G0 → G12 clean handoff + next-wave brief authored in same
  commit (G11.b).

## 10. Cross-spec / carry-forward

**From BI-2b-ii (this wave's predecessor):**
- Claude-drafted emails land but the E2E runs with
  `llm_calls_enabled=false` — the deterministic fallback is the path
  under test. Separate unit tests already cover the LLM branch
  (`tests/bi2b-ii-compose-emails.test.ts`).
- Manual follow-up Send modal is admin-only, not on this critical
  flow.

**From BI-2b-i:**
- Payment-intent route + webhook invoice branches are the SUT. Unit
  tests for idempotency + customer back-fill already green in
  `tests/stripe/dispatch-payment-intent-invoice.test.ts`; this E2E
  is the cross-boundary smoke.

**From BI-1b:**
- `invoicing_manual_cycle_enqueue_enabled=true`. E2E depends on this
  flip having landed.

**From QB-E2E:**
- Playwright infra (config, admin-session helper, `next build && next
  start` webServer workaround for Next 16 Turbopack better-sqlite3
  quirk). Reuse; do not duplicate.

**Kill-switch inventory at session start:** no new switches. Writes
allowed only for `llm_calls_enabled` in the test env (deterministic
email path for this E2E).

## 11. Notes for next-wave brief writer (G11 extension)

BI-E2E closes Wave 7. Next wave per `BUILD_PLAN.md` is most likely
**Client Portal** — the surfaces that consume the QB-8 data plane
(early-cancel, pause/resume, subscription visibility). Confirm by
reading `BUILD_PLAN.md` Wave 8 at session start.

Next-wave brief must:
- Cite its spec file(s) verbatim.
- List G1 preconditions against the repo state after BI-E2E merges
  (Playwright infra present, invoicing critical flow covered).
- Flag every kill-switch the wave unlocks or flips.
