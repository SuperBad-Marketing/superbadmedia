# QB-5 — Stripe `payment_intent.payment_failed` handler + metadata-contract reframing — handoff

**Closed:** 2026-04-14 · Wave 6 · `/deep` Opus · surgical scope

## Scope call at kickoff

QB-4c handoff left four `qb4c_*` rows and two `sp7_*` rows on the table. Surgical scope chosen over the "bundle subscription-lifecycle webhooks too" alternative — subscription lifecycle (`customer.subscription.*` + `invoice.payment_*`) is a large bundle (5+ events with `deals.subscription_state` machine plumbing) and deserves its own focused session.

## What landed

- **`lib/stripe/webhook-handlers/payment-intent-failed.ts`** — new handler. Branches on `metadata.product_type`:
  - Non-quote → `skipped: covered_by_checkout_session` (mirrors PI-succeeded's idempotency stance).
  - Missing `quote_id` / `deal_id` → `error: missing_metadata.quote_or_deal_id`.
  - Unknown quote id → `error: quote_not_found:{id}`.
  - Happy path → inserts `activity_log` row with `kind:"note"` + `meta.kind:"quote_payment_failed"`, capturing `failure_code`, `failure_message`, `stripe_payment_intent_id`, `event_id`. **Quote status is deliberately not touched** — spec §7.1: quote stays `accepted` on payment failure; client retries in the Payment Element.
  - Uses `database.insert(activity_log)` directly (not `logActivity()`) so the `dbArg` test-db threading works — same pattern as the CRM helpers (`snoozeDeal`, `transitionDealStage`, etc.).
- **`lib/stripe/webhook-handlers/index.ts`** — registers the `payment_intent.payment_failed` case in `dispatchStripeEvent()`.
- **`tests/stripe/dispatch-payment-intent-failed.test.ts`** — 6 new tests (hermetic SQLite + migration, mirrors the SP-7 dispatch test harness):
  1. Non-quote PI → skipped
  2. Missing product_type → skipped
  3. Quote PI missing quote_id → error
  4. Quote PI unknown quote_id → error (not thrown)
  5. Happy path → ok, quote stays `accepted`, activity_log row with full failure detail
  6. No failure detail → ok, body says "unknown", null codes
- **`PATCHES_OWED.md`** updates:
  - `qb4c_payment_failed_handler` → ✅ **CLOSED** with implementation notes.
  - `sp7_if_stripe_metadata_contract` → reframed: Intro Funnel is PaymentIntent-only (spec §11.2); Checkout-Session contract is forward-declared against future code.
  - `sp7_qb_stripe_metadata_contract` → reframed: QB-4c's PaymentIntent satisfies the metadata contract (`product_type="quote"` + `quote_id` + `deal_id` + `company_id`); Checkout-Session flavour carries forward to any future retainer/SaaS Checkout code path.

## Verification

- `npx tsc --noEmit` — clean.
- `npm test` — **78 test files, 562 passed, 1 skipped** (was 556/1 — +6).
- G4 literal grep: no autonomy literals introduced (failure-code strings are Stripe-issued, not tunables; no timeouts/thresholds/cutoffs added).
- No schema change, no migration, no settings keys, no new routes, no new npm deps, no env vars.
- Manual browser verification — N/A (webhook-only change).

## Key decisions

- **`quote_payment_failed` logged via `kind:"note" + meta.kind` rather than widening `ACTIVITY_LOG_KINDS`.** Spec §7.1 line 614 literally says "(activity log value added to the cross-spec list if not already — confirm in Build)". Matches the SP-9 / QB-4c precedent for quote/subscription-adjacent kinds that aren't enumerated. A future migration can promote it to a first-class kind if/when downstream surfaces need to filter on it.
- **`acceptQuote()` + PI-succeeded quote-branch coverage tests deferred.** QB-4c's carry flagged these as thin — still thin after QB-5. They're a legitimate follow-up but scoping them into this session would have doubled its size and pushed against the G11 context budget. Left as carry for the subscription-lifecycle session or a dedicated mini-session.
- **`database.insert(activity_log)` over `logActivity()` in the new handler.** `logActivity()` hardcodes the default db — PI-succeeded (QB-4c) has the same issue but its quote-branch has no unit tests to surface it. The new handler works because it threads `dbArg` through to the insert directly.

## Carry

- **Subscription lifecycle webhooks** (`qb4c_subscription_lifecycle_webhooks`) — still open. Needs a dedicated session: handlers for `customer.subscription.created/updated/deleted/paused/resumed` + `invoice.payment_succeeded/failed`, plus `deals.subscription_state` transitions (`active → past_due / paused / cancelled / lapsed`). Not in BUILD_PLAN yet as a named row — propose inserting as Wave 6 QB-6 or a standalone "subscription-lifecycle" session before Wave 7.
- **`acceptQuote()` unit tests** — coverage gap from QB-4c. ~6-10 tests worth: idempotency on already-accepted, rejection of non-sent/viewed, proof-capture fields, manual vs stripe branch, committed-until computation.
- **`payment-intent-succeeded` quote-branch unit tests** — similar gap. Stripe SDK calls (`products.create`, `subscriptions.create`) need mocking; feasible but adds a first instance of that pattern to the repo.
- **Manual browser verify backlog** — BDA-4, QB-2b, QB-3, QB-4a, QB-4b, QB-4c still owed (standing carry; all gated on a `dev.db` reseed not booked yet).
- **Other PATCHES_OWED rows untouched** — `qb4c_sound_quote_accepted_emit`, `qb4c_manual_invoice_generate_handler`, plus the SP-9 / SP-8 / SW-*b / BDA-POLISH rows all remain on their existing gates.

## What the next session needs

**Wave 6 next row (or subscription-lifecycle session).** Decide at Andy's next `let's go`:

- **Option A — QB-6 / subscription-lifecycle.** Wire `customer.subscription.*` + `invoice.payment_*` handlers; `deals.subscription_state` state machine transitions + tests. Covers `qb4c_subscription_lifecycle_webhooks`. Medium-to-large session.
- **Option B — the next named QB row in `BUILD_PLAN.md` Wave 6.** Check `BUILD_PLAN.md` Wave 6 for what sits after QB-4c/5 (likely supersede flow or scheduled-task handlers fleshing out).

Pre-session reads: `docs/specs/quote-builder.md` §7.1 + §8, `PATCHES_OWED.md` `qb4c_*` rows still open, `sessions/qb-5-handoff.md` (this file), `sessions/qb-4c-handoff.md`, `BUILD_PLAN.md` Wave 6.
