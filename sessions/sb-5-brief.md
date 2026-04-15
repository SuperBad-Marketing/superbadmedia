# `sb-5` — Public checkout page

**Wave:** 8. **Type:** FEATURE. **Spec:** `docs/specs/saas-subscription-billing.md` §3.3, §4.1, §4.2, §4.5.
**Predecessor:** `sessions/sb-3-handoff.md` — `/get-started/pricing` links every Get started CTA to `/get-started/checkout?tier={tierId}&product={slug}`. Those links are dead until this ships.

**Model:** `/deep` (Opus). Stripe flow, commitment radio semantics, suppression rules, identity-framed copy.

## Goal

Ship `/get-started/checkout` — minimal, focused, close-the-deal surface. Subscriber arrives from pricing page (or demo), picks commitment, pays via Stripe Payment Element, lands in locked onboarding state (Brand DNA gate lives post-signup — not this slice).

## Acceptance criteria (G12)

1. **`/get-started/checkout` server page** — accepts `?tier={tierId}&product={slug}` query; resolves to the active tier; renders product name + tier name at top as confirmation (not re-sell). If tier/product missing or archived → redirect to `/get-started/pricing`.
2. **Three commitment radio cards** per spec §3.3: Monthly / Annual monthly-billed / Annual upfront. Identity framing copy per card from Claude-authored content (new `docs/content/saas-subscription-billing/checkout.md` + barrel). Third card gets the "all in" confirmation flourish on select (per spec §3.3).
3. **Clear total** below the selected card. Setup fee shown only for Monthly. GST-inclusive per `feedback_felt_experience_wins`.
4. **Stripe Payment Element** — once user clicks "Continue to payment", voice copy suppresses (spec §3.3). Single action button. Small "issues? email andy@superbadmedia.com.au" at bottom.
5. **Second-product nudge** — if an authenticated subscriber with an existing subscription lands here for a second product, show Full Suite comparison line (not a modal). Defer actual upsell mechanics; the line is enough for this slice.
6. **Payment success** — Stripe subscription created per §4.2 (monthly / annual-monthly / annual-upfront branches); deal row written with `won_outcome="saas"`, `billing_cadence`, `committed_until_date`; setup fee via `add_invoice_items` for Monthly only; `logActivity("saas_subscription_created")`; redirect to `/lite/onboarding` (or locked dashboard equivalent).
7. **Error paths** — Stripe failure surfaces on the same page with the Payment Element intact for retry. No blank screens. No lost tier selection.

## Out of scope

- Brand DNA gate (post-payment — separate wave).
- Cold-outreach pre-populated checkout (separate entry path — later wave).
- Interactive demo landing pages (§3.2 — later wave).
- Upgrade / downgrade / product-switch flows (§4.4 — later wave).
- Cancel flow (§5 — later wave).

## Gates

- **G0** read this brief + `sessions/sb-3-handoff.md` + spec §3.3 / §4.1 / §4.2 / §4.5 + existing `lib/billing/stripe-product-sync.ts` + existing Payment Element usage (search for prior Stripe Elements integrations: `grep -rn "PaymentElement\|stripe.confirmPayment"`).
- **G1** preconditions verify before code:
  - `saas_tiers.stripe_monthly_price_id` / `stripe_annual_price_id` / `stripe_upfront_price_id` populated for the target tier (query-level gate).
  - `deals` table accepts `won_outcome="saas"` + `billing_cadence` enum includes monthly/annual_monthly/annual_upfront.
  - `saas_subscription_created` in `ACTIVITY_LOG_KINDS` (grep; add if missing).
  - User auth path: subscriber account creation happens before payment per Q23 (locked dashboard). Confirm existing signup/magic-link primitive or note a new one.
- **G2** cite `docs/specs/saas-subscription-billing.md §3.3, §4.2, §4.5` in commit message.
- **G3** file whitelist (NEW unless marked):
  - `app/get-started/checkout/page.tsx`
  - `app/get-started/checkout/clients/checkout-client.tsx` (commitment radios + total + Stripe Payment Element)
  - `app/get-started/checkout/actions.ts` (`createSaasSubscriptionAction` — Stripe subscription, deal row, activity log)
  - `docs/content/saas-subscription-billing/checkout.md`
  - `lib/content/checkout-page.ts`
  - `lib/saas-products/queries.ts` (modify — add `loadTierForCheckout(tierId)` if not covered)
  - `tests/saas-products/sb5-checkout-action.test.ts` (happy path per commitment × 3 + Stripe failure leaves retryable state)
  - `tests/e2e/saas-checkout-page.spec.ts` (render + commitment toggle + suppression class + links from pricing page resolve)
  - `scripts/seed-sb5-checkout.ts` (fixture: one active product, three tiers with all three Stripe Price IDs populated — Stripe test-mode stubs)
  - `sessions/sb-5-handoff.md` + `sessions/<next>-brief.md` + `SESSION_TRACKER.md`.
- **G4** literal grep: no hard-coded price strings in components — all prices flow from tier rows + `formatCentsAud`. Copy lives in content barrel.
- **G5** motion: commitment radios use `houseSpring` on select; "all in" flourish uses `AnimatePresence`; Payment Element region respects suppression (no voice motion while active).
- **G6** rollback: failed Stripe subscription creation = no local deal row; action is transactional around the local write, Stripe is the outer step with explicit rollback on local failure.
- **G7** npm deps: `@stripe/stripe-js` + `@stripe/react-stripe-js` likely already present (grep `package.json`); if NOT, flag to Andy before installing.
- **G10.5** external-reviewer gate: **REQUIRED** — public-facing, money-handling, new critical flow. Self-review against `feedback_primary_action_focus`, `feedback_individual_feel`, `feedback_motion_is_universal`, `feedback_pre_populated_trial_experience`.
- **G11.b** next brief: SB-6 (locked post-payment dashboard / onboarding gate) is the natural next — compile at end.
- **G12** verification:
  - `npx tsc --noEmit` zero errors.
  - `npm test` green.
  - `npx playwright test tests/e2e/saas-checkout-page.spec.ts` green.
  - Manual browser check mandatory: click through from `/get-started/pricing` → checkout → commitment toggle → Payment Element renders (Stripe test mode) → 4242 card succeeds → redirect lands.

## Open question for Andy

**None expected** — spec §3.3 fully locks the layout and commitment radio shape; §4.2 fully locks the Stripe branches. The "all in" confirmation flourish is a copy/motion decision inside existing primitives; Claude-author it.

## Memory-alignment to check before starting

- `feedback_primary_action_focus` — checkout is THE conversion flow; no fallback UX, no distractions, one button.
- `feedback_individual_feel` — the page feels like *their* checkout, not a shared form.
- `feedback_felt_experience_wins` — GST-inclusive prices, never "+GST" microcopy.
- `feedback_motion_is_universal` — every state change animates (except under suppression rules).
- `project_saas_popcorn_pricing` — Full Suite nudge surfaces for second-product subscribers.
- `feedback_no_lite_on_client_facing` — copy says "SuperBad", never "SuperBad Lite".
