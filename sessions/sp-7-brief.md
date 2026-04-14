# SP-7 — Stripe webhook dispatch (idempotent) — Brief

**Wave:** 5 · **Type:** INFRA · **Size:** medium
**Spec:** `docs/specs/sales-pipeline.md` §§3.1, 3.3, 10.1, 11 (build disciplines 1 + 7), 12
**BUILD_PLAN row:** Wave 5 SP-7 (note: BUILD_PLAN says `stripe_processed_events`; real table is `webhook_events` from SP-1 — terminology align, no migration).

## Goal

Turn the existing signature-verifying receiver stub (`app/api/stripe/webhook/route.ts`, from SW-5b) into a real event dispatcher that:

1. Idempotently records every valid Stripe event in `webhook_events` **before** processing.
2. Handles `checkout.session.completed` across three product types:
   - `intro` → set Deal to `trial_shoot`, set `companies.trial_shoot_status = 'booked'`, log activity.
   - `retainer` → finalise Deal as `won` with `won_outcome='retainer'`, populate `value_cents` + `value_estimated=false`, log activity, queue customer-warmth cue.
   - `saas` → finalise Deal as `won` with `won_outcome='saas'`, populate `value_cents`, log activity, queue customer-warmth cue.
3. Handles `payment_intent.succeeded` — log-only no-op (Checkout covers Won; PI.succeeded is future subscription-renewal territory owned by SB).
4. Is kill-switch gated via a new settings key.
5. Ships with unit tests + a Playwright smoke that walks a signed test event end-to-end to `won` (G12 critical-flow mandate).

## Calls locked this session

1. **Deal id transport:** `stripe.checkout.Session.metadata.deal_id` (string). Quote Builder / Intro Funnel are responsible for stamping metadata at session creation. Line-item / price-id lookups are not consulted for Deal routing.
2. **Product type detection:** `stripe.checkout.Session.metadata.product_type` ∈ `"intro" | "retainer" | "saas"`. Explicit session-time intent beats inferring from Price id (prices rotate; metadata doesn't drift).
3. **Missing metadata handling:** if `deal_id` or `product_type` is absent or unrecognised, the handler writes `webhook_events.result='error'` with a descriptive `error` string, logs to `external_call_log`, and returns 200 (never 4xx/5xx — Stripe retries are noise). A cockpit health banner (out of scope this session) will surface these.
4. **`payment_intent.succeeded`:** registered but no-op (log-only `webhook_events.result='skipped'` with reason `"covered_by_checkout_session"`). Placeholder so future subscription work has a known integration point.
5. **Kill-switch key:** `pipeline.stripe_webhook_dispatch_enabled` (boolean, default `true`). When `false`, receiver still verifies signature + records `webhook_events.result='skipped'` reason `"kill_switch"` and returns 200 — no business dispatch runs. Added to `docs/settings-registry.md` + seed migration.
6. **Value-cents source:** `checkout.session.amount_total` (integer cents, AUD). If `null` (shouldn't happen on a completed Checkout), handler writes `result='error'`.
7. **Customer-warmth cue:** emitted via a new `activity_log` row with `meta.kind='stripe_won'` carrying `{ won_outcome, value_cents }`. Cockpit + sound trigger consume this later; SP-7 just produces it, doesn't wire the playback (that's SP-9 + Cockpit).
8. **Reuse of finalisation helpers:** `retainer` / `saas` paths call the existing `finaliseDealAsWon()` from SP-6. Because that helper writes its own activity row + transitions stage atomically, SP-7 adds only the `stripe_won` activity row on top, no duplicate transition logic.
9. **`value_cents` population:** SP-6's `finaliseDealAsWon()` currently does not accept a value_cents argument. This session extends its signature to `finaliseDealAsWon(dealId, outcome, { valueCents? }, …)` — existing callers pass nothing (backwards-safe), Stripe path passes the amount. `value_estimated=false` is set iff `valueCents` is provided.
10. **Intro product path:** calls a new helper `markCompanyTrialShootBooked(companyId, { dealId })` that sets `companies.trial_shoot_status='booked'` (forward-only via SP-5's sub-machine) + transitions the Deal to `trial_shoot` stage in one transaction. Uses the existing `advanceTrialShootStatus` helper under the hood.
11. **Signature verification timing:** stays where it is (before any DB work). Only signed, verified events enter the idempotency table.
12. **Idempotency primary key:** `webhook_events.id = stripe event id` (e.g. `evt_…`). `ON CONFLICT DO NOTHING` on insert → if the row already existed, handler short-circuits and returns 200 without re-dispatching.
13. **Error isolation:** dispatch failures (DB error, unknown deal, etc.) do **not** re-throw — they're captured, written to `webhook_events.error` as a string, response is still 200. Stripe retries are worse than a recorded failure.
14. **No subscription-mode wiring here.** The SaaS branch treats `checkout.session.completed` as a one-off Won signal. Renewal/cancel/pause for true subscriptions is SB territory, explicitly deferred.

## Deliverables

- `lib/stripe/webhook-handlers/index.ts` — `dispatchStripeEvent(event, nowMs?)`. Pure-ish: takes a verified `Stripe.Event`, returns `{ result, error? }`. Does not know about the HTTP layer.
- `lib/stripe/webhook-handlers/checkout-session-completed.ts` — product-type branch logic; pulls metadata, calls the three helpers.
- `lib/stripe/webhook-handlers/payment-intent-succeeded.ts` — no-op handler returning `{ result: 'skipped', error: 'covered_by_checkout_session' }`.
- `lib/crm/mark-company-trial-shoot-booked.ts` — intro-path helper (company status + deal transition in one tx).
- `lib/crm/finalise-deal.ts` — extend `finaliseDealAsWon` signature to accept optional `valueCents`; update SP-6 callers (no-op defaults).
- `app/api/stripe/webhook/route.ts` — rewrite to: verify signature → read kill-switch → insert-or-skip `webhook_events` → call `dispatchStripeEvent` → update row's `result` + `error` → always 200. Preserve existing `external_call_log` emission (SW-5c E2E still uses it as a receipt probe).
- `lib/db/migrations/00XX_sp7_webhook_dispatch_setting.sql` — INSERT one row into `settings` for `pipeline.stripe_webhook_dispatch_enabled = true`.
- `docs/settings-registry.md` — new row under Sales Pipeline.
- `tests/stripe/dispatch-checkout-session-completed.test.ts` — unit: intro / retainer / saas branches + missing metadata + unknown deal + value_cents null.
- `tests/stripe/dispatch-payment-intent-succeeded.test.ts` — unit: always skipped.
- `tests/stripe/webhook-idempotency.test.ts` — unit: second insert is a no-op; handler short-circuits.
- `tests/stripe/webhook-kill-switch.test.ts` — unit: `false` → skipped with reason `kill_switch`, no business side effects.
- `tests/e2e/stripe-webhook-critical-flow.spec.ts` — Playwright smoke: POST a signed test event (retainer product, seeded deal in `quoted`) to the webhook route, assert Deal landed in `won` + activity_log + webhook_events row `result='ok'`. `test.skip()` if `STRIPE_WEBHOOK_TEST_SECRET` not set.

## Preconditions to verify before writing code

- `webhook_events` table exists (SP-1). ✓ checked.
- `companies.billing_mode`, `companies.trial_shoot_status`, `deals.value_cents`, `deals.value_estimated` (SP-1). Need to re-check the last two.
- `transitionDealStage` accepts an external tx arg (SP-2). ✓.
- `advanceTrialShootStatus` accepts an external tx arg (SP-5). Need to verify.
- `finaliseDealAsWon` (SP-6) present + transactional. ✓.
- Kill-switch helper pattern — confirm `settings.get()` is available + returns typed values.
- `docs/settings-registry.md` row format.

## Out of scope (explicit)

- Subscription lifecycle (`customer.subscription.*`) — SB spec.
- Resend inbound / bounce webhooks — SP-8.
- Customer-warmth sound playback wiring — SP-9.
- Client Management provisioning on Won — CM spec.
- Cockpit health banner for failed webhooks — Cockpit spec.
- `external_call_log` audit dashboard — Observatory.
- Drag-out-of-Won reversal — deferred per SP-6 handoff.

## Rollback strategy

- Kill-switch (`pipeline.stripe_webhook_dispatch_enabled = false`) halts business dispatch without a deploy. Stripe still sees 200s, no retries, nothing moves.
- Migration is additive (one settings row); down-migration = DELETE the row.
- All new files are net-new; no in-place rewrites of critical flows. The route.ts rewrite is the only exception — keep a clear `git revert` target (single commit).

## Settings keys consumed (G11 preflight)

- `pipeline.stripe_webhook_dispatch_enabled` (new, seeded by this session).

## Verification gates (AUTONOMY_PROTOCOL §1)

- G1: preconditions verified above before first code touch.
- G4: literal grep — no hardcoded thresholds introduced.
- G7: typecheck clean.
- G8: `npm test` green, with 4+ new test files covering dispatch, idempotency, kill-switch, and the skipped PI handler.
- G11: settings key wired via `settings.get()`, no literal gate.
- G12: Playwright smoke over the critical Won flow, skipped when test-secret env var absent (matches the existing E2E conventions from SW-5c / SW-13).
- End-of-session: artefact verification — each file in the Deliverables list `ls`-confirmed before handoff.

## Manual browser pass (owed, Andy-driven)

Not blocking this session. SP-5/SP-6 verification seeds + steps live in each handoff; run alongside when convenient.
