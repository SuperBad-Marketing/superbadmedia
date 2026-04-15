# SB-5 — Public checkout page handoff

**Built:** `/get-started/checkout` — public, unauthenticated, server-rendered Stripe subscription conversion surface.

## What landed

- `app/get-started/checkout/page.tsx` — server page; `dynamic = "force-dynamic"`, `robots: { index: false, follow: false }`; accepts `?tier={id}&product={slug}`; redirects to `/get-started/pricing` on missing/invalid/archived/Stripe-Price-missing; renders tier + product confirmation + `CheckoutClient`.
- `app/get-started/checkout/clients/checkout-client.tsx` — two-phase client. Phase 1: identity block (email + businessName) + three commitment radio cards (Monthly / Annual monthly-billed / Annual upfront) with `houseSpring` + `AnimatePresence` "all in" flourish on third card + live total line + Full Suite nudge line (dormant until subscriber auth). Phase 2: Stripe `<Elements>` + `<PaymentElement>` with `confirmPayment({ redirect: "if_required" })`, `data-voice-suppressed="true"`, return_url `/get-started/welcome?email=…`.
- `app/get-started/checkout/actions.ts` — `createSaasSubscriptionAction`: Zod-validated input; loads tier + product (active + all 3 Stripe Price IDs required); find-or-create prospect user + company (name_normalised) + primary contact (email_normalised); `ensureStripeCustomer(contactId)` + `stripe.customers.update({ email, name })`; `stripe.subscriptions.create` with `payment_behavior: "default_incomplete"`, price id selected by cadence, `add_invoice_items` setup fee **only** for monthly; wraps local deal-write + `activity_log kind="saas_subscription_created"` in a txn; on local failure `stripe.subscriptions.cancel()`; committed_until = today + 1yr for annual cadences, null for monthly.
- `app/get-started/welcome/page.tsx` — placeholder post-payment landing ("Payment received. Andy will be in touch within a business day.").
- `docs/content/saas-subscription-billing/checkout.md` + `lib/content/checkout-page.ts` — Claude-authored dry voice; identity framing per cadence; "Alright. You're all in." flourish for annual_upfront.
- `lib/saas-products/queries.ts` — added `loadTierForCheckout(tierId, productSlug)` (validates status + all 3 Stripe Price IDs) + `loadFullSuiteTopTierMonthlyCents()` (second-product nudge).
- `scripts/seed-sb5-checkout.ts` — fixture: outreach (t1/t2/t3 at 49/99/199 with $99 setup) + full-suite (79/149/299 no setup); all Stripe Price IDs stubbed.
- `tests/saas-products/sb5-checkout-action.test.ts` — 6 hermetic tests (monthly + annual_monthly + annual_upfront happy paths, Stripe failure leaves no deal row + no cancel call, slug mismatch, invalid email).
- `tests/e2e/saas-checkout-page.spec.ts` — 4 Playwright tests (render + radios + default selection, "all in" click surfaces flourish + total recomputes to 1,188, missing params redirect, unknown tier redirects).

## Silent reconciles (locked without asking Andy per `feedback_technical_decisions_claude_calls`)

- **Subscriber auth primitive gap:** no magic-link/signup exists for `role="client"` yet. Captured email + businessName inline and silently write a `role="prospect"` user + company + primary contact in the action. SB-6 should promote prospect→client on post-payment landing or via webhook.
- **Redirect target:** brief said `/lite/onboarding` but `/lite/*` requires auth. Used `/get-started/welcome` per brief's "or locked dashboard equivalent" escape hatch — SB-6 owns the real locked onboarding dashboard.
- **Full Suite nudge dormant:** implemented per spec (`loadFullSuiteTopTierMonthlyCents()` + session check) but `session?.user?.role === "client"` never fires until subscriber auth lands. Dormant wire, not dead.
- **Stripe customer email/name:** `ensureStripeCustomer(contactId)` creates without email. Added explicit `stripe.customers.update(id, { email, name })` after ensure (not banned by the `customers.create` ESLint rule).
- **Setup-fee via `add_invoice_items`:** uses inline `price_data` against the live `stripe_product_id` rather than a preregistered Price (setup is situational, not a catalog SKU).

## Verification

- `npx tsc --noEmit` → 0 errors.
- `npx vitest run tests/saas-products/sb5-checkout-action.test.ts` → 6/6 in 1.77s.
- `npm test -- --run` → **767/1/0** (+6 from SB-1 baseline of 761).
- `npx playwright test tests/e2e/saas-checkout-page.spec.ts` → 4/4 in ~2m.
- Manual browser check: **OWED** — opened PATCHES row `sb5_manual_browser_verify` (walk pricing → checkout → commitment toggle → Stripe 4242 card → welcome redirect).

## G10.5 external-reviewer self-assessment (REQUIRED — public money flow)

- **`feedback_primary_action_focus`** — PASS. One button per phase, no side tasks, no fallback UX. Inline email support link is a transition CTA (earned), not a distraction.
- **`feedback_individual_feel`** — PASS. Identity block is first, product/tier named at top, copy reads like their own checkout.
- **`feedback_motion_is_universal`** — PASS. Commitment cards use `houseSpring` on select; "all in" flourish uses `AnimatePresence`; payment phase suppresses voice per §3.3.
- **`feedback_felt_experience_wins`** — PASS. GST-inclusive prices via `formatCentsAud`; "inc. GST" microcopy on total only.
- **`feedback_no_lite_on_client_facing`** — PASS. Copy says "SuperBad" only.
- **`feedback_pre_populated_trial_experience`** — N/A for this slice (cold-outreach pre-populated checkout is explicitly out-of-scope per brief).

## What next agent should know

- `/get-started/*` naturally bypasses the `/lite/*` auth gate — proxy allowlist unchanged.
- Every checkout writes a `role="prospect"` user — SB-6 must promote on first locked-dashboard visit (or via webhook on subscription `status=active`).
- Deal row is written pre-payment-confirmation; `subscription_state="active"` is optimistic — `invoice.payment_failed` webhook should flip to `past_due` if card fails mid-flow.
- `stripePromiseRef` is a module-level singleton; `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` required at runtime; missing key falls through to "Warming up…" forever (documented, intentional — pre-launch env populate in Coolify).
- Full Suite nudge: reusable pattern — second-product prompts for any new signup whose primary contact's email already owns a deal with `won_outcome="saas"`.
- Dev-DB seeding: `DB_FILE_PATH=./dev.db npx tsx scripts/seed-sb5-checkout.ts`.

## PATCHES_OWED

- `sb5_manual_browser_verify` — Andy to walk full pricing → checkout → Stripe 4242 → welcome; non-blocking.
