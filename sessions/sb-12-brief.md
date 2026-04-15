# SB-12 brief — Setup-fee mechanics (Wave 8, final feature slice)

**Spec:** `docs/specs/saas-subscription-billing.md` §4.5, §6 op#41 (line ~806), §7.
**Predecessors:** SB-5 (shipped add_invoice_items inline), SB-8 (product switch via `applyProductSwitch`), SB-9 (payment-failure lockout + recovery), SB-11 (cancel flow).
**Size:** small (Wave 8 final non-E2E slice — SB-E2E is next).

## Goal

Lock the setup-fee invariant the spec pinned in §4.5:

- **Charged** on every new monthly subscription — even if the contact had a previous cancelled subscription (this IS the loophole closure per Q7; no extra anti-gaming logic needed).
- **Not charged** on annual subscriptions.
- **Not charged** on product switches (`applyProductSwitch`).
- **Not charged** on reactivate after payment failure (SB-9 recovery path — Stripe retries the existing invoice; no new `add_invoice_items` ever appended).

And discharge §6 op#41: **setup-fee logic lives in one place.** Today it's inline in `app/get-started/checkout/actions.ts` lines 248–259. Move it to a single `lib/billing/` helper so the "no ad-hoc `add_invoice_items` elsewhere" rule is grep-enforceable.

## Current state (verified 2026-04-15)

- `app/get-started/checkout/actions.ts:248–259` — only place `add_invoice_items` appears in app code for SaaS. Gated on `cadence === "monthly" && tier.setup_fee_cents_inc_gst > 0`. Writes `setup_fee_cents` into `activity_log.meta` on `saas_subscription_created`.
- `lib/saas-products/tier-change.ts:437` — `applyProductSwitch` calls `switchSubscriptionProduct` (items update only, no `add_invoice_items`). Already invariant-safe.
- `lib/stripe/subscriptions.ts` — no `add_invoice_items` references. Recovery-path code (SB-9) resumes via default PM; no new invoice items. Already invariant-safe.
- `lib/billing/` — does NOT yet exist as a directory (only scattered helpers). This session creates it.
- Settings:
  - `billing.saas.monthly_setup_fee_cents` (platform default, migration 0022)
  - `saas_tiers.setup_fee_cents_inc_gst` (per-tier override, integer NOT NULL DEFAULT 0)
- `grep -rn "add_invoice_items" --include="*.ts"` — one hit (the checkout action). Confirm this stays the *only* producer after refactor.

## Scope (what lands this session)

1. **`lib/billing/setup-fee.ts` (NEW)** — single export:
   ```
   export function buildMonthlySetupFeeInvoiceItems(params: {
     cadence: CommitmentCadence;
     stripeProductId: string;
     setupFeeCentsIncGst: number;
   }): Stripe.SubscriptionCreateParams["add_invoice_items"] | undefined
   ```
   - Returns `undefined` for annual/annual_upfront, or when `setupFeeCentsIncGst <= 0`.
   - Returns the one-element array otherwise (AUD, `unit_amount`, `quantity: 1`).
   - Pure function, no DB reads, no Stripe calls — trivially unit-testable.
2. **`app/get-started/checkout/actions.ts`** (EDIT) — replace inline block (lines 248–259) with `buildMonthlySetupFeeInvoiceItems(...)` call. Assign to `subscriptionParams.add_invoice_items` only if result is defined. Activity-log `meta.setup_fee_cents` value unchanged (still `cadence==="monthly" ? tier.setup_fee_cents_inc_gst : 0`). No behaviour change.
3. **`tests/billing/setup-fee.test.ts` (NEW)** — unit tests on the pure helper:
   - monthly + positive fee → one-item array with exact shape
   - monthly + zero fee → undefined
   - monthly + negative fee (defensive, shouldn't occur) → undefined
   - annual_monthly → undefined (even with positive fee)
   - annual_upfront → undefined (even with positive fee)
4. **`tests/saas-products/sb12-setup-fee-invariants.test.ts` (NEW)** — integration-style guards for the spec invariants:
   - **Resubscribe loophole.** `createSaasSubscriptionAction` called with a contact whose company already has a cancelled deal (seed: deal with `subscription_state="cancelled_post_term"`) on monthly → Stripe `subscriptions.create` is called with `add_invoice_items` present (setup fee re-charged). Asserts Q7 loophole closure.
   - **Annual skip.** Same setup but `cadence: "annual_monthly"` → `add_invoice_items` absent.
   - **Product switch invariant.** Mock-stripe test: `applyProductSwitch` never calls anything that mounts `add_invoice_items`. Assert by reading captured Stripe calls.
   - **Zero-fee tier.** Monthly + `setup_fee_cents_inc_gst=0` → `add_invoice_items` absent (avoids a zero-amount invoice line).
5. **Grep guard — Vitest test in `tests/billing/setup-fee-guard.test.ts` (NEW)** — static-style test that fails if `add_invoice_items` appears anywhere in `app/**/*.ts` or `lib/**/*.ts` outside `lib/billing/setup-fee.ts`. Reads files from disk, regexes for the literal, filters out the owner file, asserts zero remaining hits. This is the grep-enforceable version of "setup fee logic lives in one place" — the net that catches future drift.

## Out of scope (call out, don't build)

- SaaS admin editor for per-tier setup fees — already shipped earlier in Wave 8.
- Setup fee proration or partial refunds on same-cycle cancel — spec: not a thing; setup fee stays charged.
- Setup-fee revenue reporting split from MRR — Phase 6 / observability, not this session.
- Any change to existing `saas_subscription_created` activity-log `meta.setup_fee_cents` field.
- SB-E2E (Playwright signup flow) — next session, not this one.

## Settings keys consumed

None new. This session reads `tier.setup_fee_cents_inc_gst` (already present via SB-1 / SB-2b).

## Kill switches

None new. Setup fee follows the existing `saas_signup_enabled` / `saas_tier_change_enabled` gates implicitly through the caller paths.

## G10.5 external reviewer

**Not required.** No new user-visible copy, no state-change moment, no surface. Pure refactor + tests + invariant guard. Log in handoff as "G10.5 N/A — refactor-only slice."

## Verification gates (AUTONOMY_PROTOCOL §1)

- **G0 preflight:** verify `lib/billing/` directory does not exist before creating. Verify line 248–259 of `actions.ts` still matches the brief's snippet (detects drift).
- **G1 skills:** `typescript-validation` (Zod already in `actions.ts`; not needed new). No new skills required.
- **G3 tests:** `npm test` green; expect +11–14 tests (5 unit + 4 invariant + 1 grep guard, minus any deduplicated).
- **G4 typecheck:** `npx tsc --noEmit` zero errors.
- **G5 manual browser:** **N/A** — no UI change. Log as skipped with reason.
- **G6 rollback:** git-revertable, no data shape change, no migration. Safe.
- **G7 settings literals:** no new autonomy-sensitive literals; helper pulls `setup_fee_cents_inc_gst` from the tier row passed in.
- **G9 motion:** N/A.
- **G10.5:** N/A per above.
- **G11.b:** pre-compile `sessions/sb-e2e-brief.md` at start of SB-E2E — **this session's responsibility at end**.

## PATCHES_OWED to carry in

- `sb11_retainer_route_lift` — not touched here (not retainer domain).
- `sb11_manual_browser_verify` — not touched (SB-11 surface).
- `sb11_g105_external_reviewer` — not touched.
- `sb11_action_integration_tests` — not touched; Server Action integration tests owed on SB-11 cancel action, not SB-5 checkout.
- `sb11_copy_mini_session` — not touched (no new copy in this slice).

All carry forward to SB-E2E or a mop-up copy session.

## Success criteria

1. `add_invoice_items` appears in exactly one file after this session: `lib/billing/setup-fee.ts`.
2. `createSaasSubscriptionAction` behaviour byte-identical for every existing test (no regressions on SB-5 tests — 817+ baseline holds).
3. Four invariant tests all pass, proving the spec §4.5 matrix.
4. Grep-guard test passes green and would fail if a future session added `add_invoice_items` anywhere else.
5. Typecheck + full test suite green.

## Things SB-E2E will need (G11.b pre-compile target)

- Playwright E2E: `/get-started/pricing` → tier pick → `/get-started/checkout` → Payment Element confirm (test-mode card) → redirect to `/lite/onboarding` → Brand DNA CTA visible → subscriber magic-link path → `/lite/portal/subscription` renders. Full signup golden path.
- Mandatory per BUILD_PLAN Wave 8 closing row. Must run in CI against a synthetic Stripe test-mode key.
- Brief pre-compile happens at start of SB-12's session wind-down.
