# SB-6b handoff — 2026-04-15

**Wave 8 SB-6b CLOSED.** `/lite/onboarding` polished from SB-6a placeholder into status-aware dashboard with Brand DNA CTA hero, billing-portal hero, cross-product checkout guard, and 2 Playwright E2E tests green.

**Spec:** `docs/specs/saas-subscription-billing.md` §3.4, §4.3, §5.1.

## What landed

- **`lib/saas-products/subscriber-summary.ts`** (NEW) — extracted + extended from SB-6a's inline `loadSubscriberSummary`. Returns `dealId / productId / productSlug / productName / tierName / billingCadence / subscriptionState / stripeCustomerId`. Exports `cadenceLabel` + `SubscriberSummary` type. Reused by onboarding page, dashboard client (type only), and billing-portal route.
- **`app/lite/onboarding/page.tsx`** (REWRITE) — server component delegates client-role branch to `OnboardingDashboardClient`; admin placeholder path untouched.
- **`app/lite/onboarding/clients/onboarding-dashboard-client.tsx`** (NEW) — three status variants driven by `subscriptionState`:
  - `active` → Brand DNA CTA hero (Link → `/lite/brand-dna`) + "Andy will be in touch" follow-up
  - `past_due` → billing-portal hero (form POST → `/api/stripe/billing-portal`) + recovery copy
  - anything else (null / paused / incomplete-ish) → same billing-portal hero, softer copy ("Still warming up.")
  `houseSpring` + `AnimatePresence` on variant cross-fade; `layout` on summary card; `whileHover` / `whileTap` on CTA.
- **`app/api/stripe/billing-portal/route.ts`** (NEW) — POST creates `stripe.billingPortal.sessions.create({customer, return_url})`, 303s to Stripe. Same-origin guard on Origin header, role=`client` gate, summary fallback if no `stripe_customer_id` on file. `force-dynamic` + `runtime=nodejs`.
- **`app/get-started/checkout/page.tsx`** (PATCH) — new `authedSubscriberHasLiveSubscriptionFor(email, productId)` helper. Redirects to `/lite/onboarding` when authed client already has a `subscription_state ∈ {active, past_due, paused}` deal for the exact product. Different product → existing Full Suite nudge still renders.
- **`tests/e2e/saas-onboarding-gate.spec.ts`** (NEW) — 2 tests: active variant asserts Brand DNA CTA + href=`/lite/brand-dna`; past_due variant asserts billing-portal hero + form action + absence of CTA.
- **`scripts/seed-sb6b-e2e.ts`** (NEW) — hermetic fixture: 1 product + tier, 2 prospect users (→ promoted to client on redeem), companies + contacts + deals in distinct subscription states + magic-link tokens.

## Verification

- `npx tsc --noEmit` — 0 errors.
- `npm test` — 108 files, 773 passing / 1 skipped (unchanged from SB-6a baseline; no unit tests added this slice).
- Playwright `tests/e2e/saas-onboarding-gate.spec.ts` — **2/2 green** in 2.0 min.
- G4 literal grep: no new autonomy thresholds. TTL on billing-portal session is Stripe-managed. Subscription-state enum values (`active` / `past_due` / `paused`) are structural, not tunables.
- Manual browser walk: **owed** (PATCHES_OWED `sb6b_manual_browser_verify`). Full Playwright suite not rerun this session — scoped spec run confirms new surface; changes to unrelated pages: none.

## Silent reconciles per `feedback_technical_decisions_claude_calls`

1. **Brief called for `incomplete` subscription variant.** Enum lacks `incomplete`; collapsed null / unknown states into the same billing-portal hero used by `past_due` with softer "Still warming up" copy. Covers the real gap (Stripe webhook hasn't landed yet) without a schema migration.
2. **Extracted `loadSubscriberSummary` to `lib/saas-products/subscriber-summary.ts`** — brief said "extend if needed"; extraction was needed once dashboard client + billing-portal route both consumed the summary. Original inline version removed from `page.tsx`.
3. **Type-only import in client component.** Client component imports the `SubscriberSummary` type via `import type` and inlines its own `cadenceLabel`. Server-only `@/lib/db` import inside subscriber-summary would otherwise bundle `better-sqlite3` into the browser chunk (crashed webpack with `Module not found: fs`).
4. **Origin guard on billing-portal route** — added a same-origin check since the brief flagged "short TTL" but didn't prescribe anti-CSRF. A simple Origin comparison closes the trivial case.
5. **Seeder token `expires_at_ms`.** Fixture `NOW = 1_700_000_000_000` (Nov 2023) but real Date.now() is Apr 2026 — tokens would be "expired" at redeem. Seeder uses `Date.now() + 365d` for token expiry only. Noted inline.
6. **E2E not included in the E2E suite rename** — spec file sits alongside existing `saas-*.spec.ts` files; no test matcher change.

## PATCHES_OWED opened

- **`sb6b_manual_browser_verify`** — Andy to run: test-card pay at `/get-started/checkout` → login email → click → land on dashboard (active variant) → click "Teach SuperBad your brand" → lands on `/lite/brand-dna` (or 404 if route unbuilt — log then).
- **`sb6b_billing_portal_unit_test`** — no unit test around the billing-portal route's origin guard + no-customer-id fallback. Small; add when a bug bites.
- **`sb6b_paused_variant_copy`** — `paused` state currently uses "Still warming up" copy; if SB-9 pause flow ships before then, author dedicated "Your subscription is paused until…" copy.

## PATCHES_OWED closed

None this slice.

## Things SB-7 will need

- `usage_records` + `checkUsageLimit()` + `recordUsage()` live in SB-7 per BUILD_PLAN.md.
- Subscriber dashboard is now a stable surface — SB-7's "approaching cap" prompt lives on this page (hero slot or new secondary card under the Brand DNA CTA).
- `loadSubscriberSummary` returns `dealId + productId + tierName`; SB-7 can join usage against those.
- Cross-product guard in `/get-started/checkout` uses exact `saas_product_id` match; SB-7 hard-cap blocks should reuse the same matching scheme.

## Memory alignment

- `feedback_earned_ctas_at_transition_moments` — post-payment landing is the canonical earned transition; Brand DNA CTA is now a single, full-width, weighted action (not clutter).
- `feedback_primary_action_focus` — one primary action per variant; no cross-sells; past_due has only the portal button.
- `feedback_individual_feel` — product + tier names render per-subscriber; no "communal SaaS" chrome.
- `feedback_motion_is_universal` — variant cross-fade animates; summary card `layout` transitions; CTA hover/tap spring; no click-to-open jumps.
- `feedback_no_lite_on_client_facing` — nothing on the surface says "Lite".
- `project_brand_dna_flagship_experience` — dashboard CTA respects the flagship framing; actual BDA surface is downstream.
- `project_settings_table_v1_architecture` — no literals introduced.
