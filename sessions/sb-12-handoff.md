# SB-12 handoff — Setup-fee mechanics (Wave 8, final non-E2E slice)

**Status:** CLOSED 2026-04-15.
**Spec:** `docs/specs/saas-subscription-billing.md` §4.5, §6 op#41.
**Brief:** `sessions/sb-12-brief.md`.

## What landed

- **`lib/billing/setup-fee.ts`** (NEW) — `buildMonthlySetupFeeInvoiceItems()`.
  Pure function. Returns `Pick<Stripe.SubscriptionCreateParams, "add_invoice_items"> | undefined`.
  Returns undefined for annual cadences, zero fee, or non-finite fee. Returns
  a partial params object (spreadable) otherwise. No DB, no Stripe calls.
- **`app/get-started/checkout/actions.ts`** (EDIT) — inline `add_invoice_items`
  block (previously lines 248–259) replaced with helper call +
  `Object.assign(subscriptionParams, setupFeeExtra)`. Docstring updated to
  name the helper. Byte-equivalent Stripe param output for every existing
  SB-5 test case.
- **`tests/billing/setup-fee.test.ts`** (NEW) — 5 pure unit tests across the
  cadence × fee-amount matrix.
- **`tests/billing/setup-fee-guard.test.ts`** (NEW) — filesystem grep guard.
  Fails if `add_invoice_items` appears anywhere under `app/**` or `lib/**`
  except `lib/billing/setup-fee.ts`. This is the op#41 net.
- **`tests/saas-products/sb12-setup-fee-invariants.test.ts`** (NEW) — 4
  integration-style guards:
  - Resubscribe loophole: monthly after a `cancelled_post_term` deal on
    the same company still attaches the setup fee (Q7 invariant).
  - Annual skip: `annual_monthly` → no `add_invoice_items`.
  - Zero-fee tier on monthly: no `add_invoice_items` (no zero-amount line).
  - Product switch path: `lib/stripe/subscriptions.ts` +
    `lib/saas-products/tier-change.ts` contain no `add_invoice_items`
    and no helper reference (Q10b invariant — static structural check).

## Verification (AUTONOMY_PROTOCOL §1)

- **G0 preflight:** checkout action snippet matched spec (line-shifted by 1
  vs. brief, content identical). `lib/billing/` directory pre-existed
  (drift from brief — `stripe-product-sync.ts` lives there). Noted, no
  action required.
- **G1 skills:** none new loaded; helper is a pure-function refactor.
- **G3 tests:** `npm test` → 832 passed / 0 failed / 1 skipped (+10 over
  prior baseline of 822).
- **G4 typecheck:** `npx tsc --noEmit` → zero errors.
- **G5 manual browser:** N/A — no UI change, no copy change, no state
  change. Refactor + guard only.
- **G6 rollback:** git-revertable. No migration, no data shape change.
- **G7 settings literals:** none introduced; helper reads tier row values
  passed in by the caller.
- **G9 motion:** N/A.
- **G10.5 external reviewer:** N/A — refactor-only slice per brief.
- **G11.b:** `sessions/sb-e2e-brief.md` pre-compiled this session.

## Invariants now grep-locked

`add_invoice_items` appears in exactly one file in `app/**` / `lib/**`:
`lib/billing/setup-fee.ts`. Any future session that tries to mount the
param elsewhere (e.g. on a product-switch path, a reactivate path, or an
ad-hoc invoice adjustment) will fail `tests/billing/setup-fee-guard.test.ts`
immediately. The "setup fee logic lives in one place" discipline is now
net-enforced, not prose-enforced.

## PATCHES_OWED

- No new patches owed from this slice.
- Carry forward (untouched, on their owner surfaces):
  - `sb11_retainer_route_lift`
  - `sb11_manual_browser_verify`
  - `sb11_g105_external_reviewer`
  - `sb11_action_integration_tests`
  - `sb11_copy_mini_session`

## Next

**Wave 8 SB-E2E** — Playwright signup golden path. Brief pre-compiled at
`sessions/sb-e2e-brief.md`. Closes Wave 8.
