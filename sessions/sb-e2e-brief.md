# SB-E2E brief — Playwright SaaS signup golden path (Wave 8 closer)

**Spec:** `docs/specs/saas-subscription-billing.md` (full flow).
**BUILD_PLAN:** Wave 8 final row — "Playwright E2E: pricing → checkout → payment → Brand DNA → unlocked. **Mandatory.**"
**Predecessors:** SB-1 through SB-12 (all Wave 8 slices CLOSED).
**Size:** small-to-medium. Single-flow E2E.

## Goal

One Playwright E2E that drives the full subscriber arc against Stripe
test-mode, end to end, in a single browser session:

1. `/get-started/pricing` loads, tier CTAs visible.
2. Click a tier → `/get-started/checkout` loads with the right tier +
   commitment selector + Payment Element.
3. Fill email + business name, pick `monthly`, submit Payment Element
   with Stripe test card `4242 4242 4242 4242`.
4. Action returns `clientSecret`; `stripe.confirmPayment` resolves;
   redirect to `/lite/onboarding` (post-payment landing from SB-6a).
5. Brand DNA CTA visible on `/lite/onboarding` (from SB-6b).
6. Magic-link subscriber auth path (from SB-6a): request link → follow
   token in email queue (or test-mode stub) → land authed at portal.
7. `/lite/portal/subscription` renders with the live subscription + tier.

## Scope (what lands this session)

1. **Playwright config** (`playwright.config.ts`) — verify test-env setup
   from SW-5c still works; a Stripe test-mode key is required. Fail
   cleanly with a readable error if absent.
2. **`tests/e2e/saas-signup.spec.ts`** — the single golden-path spec.
   Uses real Stripe test-mode API (Payment Element in iframe). Follows
   the Playwright-Stripe iframe handling pattern already used in SW-5c's
   wizard E2E if one exists; otherwise uses Stripe's documented test-card
   helper selectors.
3. **Test-env email stub.** Magic-link E2E needs the token without a
   real inbox. Reuse whatever A5-era test stub exists for Resend; if
   none, bypass by reading the latest `email_outbox` (or equivalent)
   row from the seeded test DB and extracting the token.
4. **CI hook** — ensure `npm run test:e2e` (or the existing E2E script)
   targets this spec and is wired into the pre-commit or nightly flow.
   **Do not** add to default `npm test` (unit suite stays fast).

## Out of scope (call out, don't build)

- Annual and annual_upfront E2E paths — unit-covered in SB-5; not needed
  here. E2E stays on the critical path only.
- Payment failure / card-decline E2E — unit-covered in SB-9.
- Tier change / product switch E2E — unit-covered in SB-8.
- Cancel flow E2E — unit-covered in SB-11.
- Any copy changes.

## Verification gates

- **G0 preflight:** confirm Playwright is installed (SW-5c installed it;
  re-verify — same precondition miss that split SW-5 → SW-5b → SW-5c).
- **G3 tests:** `npm test` green (unit); `npm run test:e2e` green
  against Stripe test mode.
- **G4 typecheck:** zero errors.
- **G5 manual browser:** N/A (E2E *is* the browser check).
- **G6 rollback:** pure test addition, no production code touched.
- **G10.5:** N/A (no user-visible surface added).

## Success criteria

1. Single E2E spec runs green locally against a dev server + Stripe test
   mode.
2. Spec is runnable headless in CI.
3. Failure mode: if Stripe test key is missing, spec skips with a
   visible message (not a hang, not a false green).

## Close-out

- Update `SESSION_TRACKER.md`: Wave 8 CLOSED in full.
- Write `sessions/sb-e2e-handoff.md`.
- Next pointer: Wave 9 UI-1 (Unified Inbox producer slice).
