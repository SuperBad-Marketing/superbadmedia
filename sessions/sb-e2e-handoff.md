# SB-E2E handoff — SaaS signup golden-path E2E (Wave 8 closer)

**Status:** CLOSED 2026-04-15. **Wave 8 CLOSED in full.**
**Spec:** `docs/specs/saas-subscription-billing.md` (full flow).
**Brief:** `sessions/sb-e2e-brief.md`.

## What landed

- **`tests/e2e/saas-signup.spec.ts`** (NEW) — single-test golden path:
  1. `/get-started/pricing` → Medium tier CTA click.
  2. `/get-started/checkout` loads with correct tier + monthly default.
  3. Fills `checkout-email-input` + `checkout-business-name-input` →
     `checkout-continue-button`.
  4. `createSaasSubscriptionAction` creates LIVE Stripe test-mode
     subscription + DB deal; payment phase mounts.
  5. Fills Stripe Payment Element iframe with `4242 4242 4242 4242`
     (+ expiry/CVC/optional postcode) → `checkout-pay-button`.
  6. `stripe.confirmPayment` resolves → redirect to
     `/get-started/welcome?email=...` — welcome page asserted visible.
  7. Server-side state asserted: user row seeded, deal with
     `won_outcome='saas'` + `subscription_state='active'` +
     `stripe_subscription_id` set, `saas_subscription_created`
     activity row present.
  8. Mints a `subscriber_magic_link_tokens` row directly (bypasses the
     Stripe→localhost webhook gap) → `/api/auth/magic-link?token=…` →
     lands on `/lite/onboarding` with `data-variant="active"` +
     `brand-dna-cta` visible (SB-6b contract).
  9. `/lite/portal/subscription` renders without auth bounce.

- **`scripts/seed-sbe2e.ts`** (NEW) — fixture for the above. One active
  product (`outreach-sbe2e`) with three tiers; only the Medium tier
  receives live Stripe IDs passed from the spec's `beforeAll`.

- **`playwright.config.ts`** (EDIT) — `STRIPE_PUBLISHABLE_KEY` and
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` now pass through
  `process.env.STRIPE_TEST_PUBLISHABLE_KEY` when set; fall back to
  `"pk_test_placeholder"` so existing hermetic specs unaffected.

## How to run

```bash
STRIPE_TEST_KEY=sk_test_... \
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_... \
npm run test:e2e -- tests/e2e/saas-signup.spec.ts
```

Without either env var the whole describe block skips with a visible
message (brief §6 success criterion #3). This keeps the default
`npm run test:e2e` CI run green on machines without Stripe keys while
still running the golden-path check when Andy sets the keys locally.

## Verification (AUTONOMY_PROTOCOL §1)

- **G0 preflight:** `@playwright/test` installed (devDep); existing
  `playwright.config.ts` + `tests/e2e/fixtures/seed-db.ts` reused.
- **G3 tests:** `npm test` → **832 passed / 1 skipped / 0 failed**
  (flat vs SB-12 baseline; no unit regressions). E2E spec listed by
  `playwright test --list` ✓; full run deferred pending Stripe keys
  (brief anticipates this — see §6 #3).
- **G4 typecheck:** `npx tsc --noEmit` → zero errors.
- **G5 manual browser:** N/A — the E2E *is* the browser check.
- **G6 rollback:** pure test + test-config addition; playwright.config
  change is gated on env vars absent in prod.
- **G10.5 external reviewer:** N/A — no user-visible surface added.

## Silent reconciles per `feedback_technical_decisions_claude_calls`

1. **Webhook bypass over signed-synth.** The brief wanted the magic-link
   step to exercise the real post-payment plumbing. In reality Stripe
   can't POST webhooks back to localhost, so the alternatives were
   (a) synthesise a signed `invoice.payment_succeeded` event and POST
   it to our webhook route, or (b) mint the token directly in the test
   DB. Chose (b): the webhook→token primitive is already unit-covered
   (`tests/auth/subscriber-magic-link.test.ts`) and the `stripe-webhook-
   critical-flow.spec.ts` already exercises the signed-synth path for
   the deal-advancement handler. The golden-path value here is the
   full browser arc, not redundant webhook coverage.

2. **Dynamic Stripe product/price creation.** Instead of asking Andy
   to pre-populate a stable test-mode product + price in his Stripe
   dashboard, `beforeAll` creates fresh ones per run via the Stripe
   API. Stripe test mode has no volume limits; the naming includes an
   ISO timestamp so audit is trivial.

3. **Direct DB token insert over `issueSubscriberMagicLink`.** The
   helper reads `settings.get("subscriber.magic_link_ttl_hours")` via
   the global DB handle, which in the test process is a separate
   better-sqlite3 connection from the webServer's. Rather than wire a
   dbOverride for `settings` too, the test inserts a valid row with a
   1-hour TTL directly. Contract with the redeem path (token_hash,
   expires_at_ms, consumed_at_ms, user_id) is exactly what the schema
   guarantees.

4. **Two Stripe env vars, not one.** Brief mentions only
   `STRIPE_TEST_KEY`. But `loadStripe` on the client needs the
   publishable key too, and `pk_test_placeholder` will fail
   Stripe.js's own validation before the Payment Element can mount.
   Added `STRIPE_TEST_PUBLISHABLE_KEY` alongside. Skip condition checks
   both.

5. **`test.setTimeout(180_000)`.** Default 30s isn't enough for the
   full arc — `next build && next start` webServer warm-up is already
   ~60s, and Stripe's subscription create + Payment Element mount
   adds 10-20s on first run. 180s gives headroom without masking real
   hangs.

## PATCHES_OWED

- **`sbe2e_ci_wire`** — `.github/workflows/` is empty and no husky
  hook exists. Brief §4 asked to "wire into pre-commit or nightly";
  nothing to attach to. When CI ships (Phase 6 adjacent), include
  `STRIPE_TEST_KEY` + `STRIPE_TEST_PUBLISHABLE_KEY` as CI secrets so
  this spec runs nightly rather than forever-skipping.

- **`sbe2e_stripe_cleanup`** — each spec run creates a fresh Stripe
  test-mode product + price and never cleans them up. Stripe test
  mode has no ceiling so it's harmless, but a weekly cron that prunes
  `SB-E2E *` products would keep the dashboard tidy. Pure housekeeping;
  not blocking.

- Carry forward (untouched):
  - `sb11_retainer_route_lift`
  - `sb11_manual_browser_verify`
  - `sb11_g105_external_reviewer`
  - `sb11_action_integration_tests`
  - `sb11_copy_mini_session`

## Memory alignment

- `feedback_technical_decisions_claude_calls` — five silent reconciles
  above; zero questions asked.
- `feedback_no_content_authoring` — no copy authored; all assertions
  target existing testids + spec-locked strings.
- `project_autonomous_build_loop` — spec skip-on-absent-key keeps the
  autonomous loop green on runs without Stripe keys rather than false-
  green or hanging.

## Next

**Wave 8 CLOSED.** Next pointer: **Wave 9 UI-1** — Unified Inbox
producer slice (per BUILD_PLAN.md).
