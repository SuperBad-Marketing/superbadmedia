# sb-2b — handoff

**Wave 8 SB-2b CLOSED 2026-04-15.** SaaS product publish wizard now ships end-to-end.

## What landed

- **3 new step clients:**
  - `tier-editor-step-client.tsx` — three fixed tier rows (1=Small / 2=Medium / 3=Large), rank structural and not removable; per-dimension limits with "∞ Unlimited" checkbox (unlimited → `limit_value=null`); free-form `featureFlags: Record<string, boolean>` editor. Exports pure helpers `emptyTiersState`, `reconcileTierLimits`, `validateTiers` (unit-covered).
  - `pricing-step-client.tsx` — monthly + setup-fee inputs per tier; setup-fee default routed through `settings.get("billing.saas.monthly_setup_fee_cents")` server-side. Live preview reads "Monthly $X · Annual billed monthly $X · Annual upfront $Y" where Y = monthly × 12 (structural per spec §1 Q5). Popcorn-pricing nudge surfaces when `large.monthlyCents <= medium.monthlyCents * 1.2`.
  - `demo-config-step-client.tsx` — `demo_enabled` toggle + optional `sample_payload` textarea. JSON shape kept thin per brief.
- **`saas-product-setup-client.tsx` rewrite** — wires steps 3–6; resume guard reroutes to step 2 if `productId` missing at step ≥ 2; review step bypasses `STEP_TYPE_REGISTRY` and renders via `WizardShell` children path (registry-based `review-and-confirm` doesn't support per-section Edit callbacks); each review section has an **Edit** button that calls `setIndex(editIndex)`. Celebration `onComplete` fires `publishSaasProductAction` and `play("subscription-activated")` on success.
- **`publishSaasProductAction`** in `actions-saas-product.ts`:
  1. Admin gate + payload sanity (3 tiers, ranks=1,2,3, monthly>0, setupFee≥0).
  2. Loads product (must be `status="draft"`) + dimensions; maps `dimensionKey → dimension_id`.
  3. **Single `db.transaction`:** insert `saas_tiers` rows, insert `saas_tier_limits` rows, flip `saas_products.status draft→active`, write `activity_log kind="saas_product_published"`.
  4. **Outside txn:** `syncProductToStripe(productId)` → per-tier `syncTierPricesToStripe(tierId)` (3 tiers × 3 cadences = 9 Stripe Prices). Stripe failure → `revertProductToDraft()` + logs `kind:"note" + meta.kind:"saas_product_publish_stripe_failed"`.
  5. Success → insert `wizard_completions` with sha256 `contract_version` (mirrors `actions-graph.ts` pattern).
- **Settings + seed:** migration `0022_sb2b_setup_fee_setting.sql` (non-journalled, run via `runSeeds`); registry row in `lib/settings.ts`; `docs/settings-registry.md` bumped 90 → 91.
- **Dispatcher wiring** — `app/lite/setup/admin/[key]/page.tsx` fetches `saasSetupFeeCentsDefault` only when `def.key === "saas-product-setup"`; passes to client.
- **`use-admin-shell.ts`** — exposes `setIndex` for review-step Edit jumps.
- **Wizard def** — `verify()` flipped `{ok:false}→{ok:true}`.

## Silent reconciles (per `feedback_technical_decisions_claude_calls`)

- Brief referenced `lib/settings/keys.ts` — doesn't exist. Added to `lib/settings.ts` registry in a new "SaaS Subscription Billing (1 — SB-2b)" block.
- Brief referenced a "completion" sound key — not in the locked 8-sound registry. Chose `subscription-activated` as the thematic match for SaaS product go-live.
- Review step bypasses `STEP_TYPE_REGISTRY` because the registry's `review-and-confirm` contract has no per-section Edit hook with `setIndex` jumps. Rendered via `WizardShell` children path instead.

## Verification

- `npx tsc --noEmit` → 0 errors.
- `npm test` → **740 passed / 1 skipped (741)** (+11 new + 2 adjusted: `tests/settings.test.ts` 90→91 count; `tests/saas-products/sb2a-wizard-def.test.ts` verify() now-ok expectation).
- Playwright N/A this slice (SB-E2E owns the full critical-flow run).

## PATCHES_OWED opened

- `sb2b_manual_browser_verify` — Andy to walk the full saas-product-setup wizard end-to-end and confirm the Stripe test-mode dashboard shows one Product + 3 tiers × 3 Prices. Non-blocking; transactional + Stripe paths are unit-covered with a hermetic fake client.

## Next session

**SB-2c** — product detail page `/lite/admin/products/[id]` + archive / un-archive flow per spec §8.3 / §8.4. Brief pre-compiled at `sessions/sb-2c-brief.md`.

## What the next agent should know

- The publish action uses `dimension_key` (not `tempId`) as the cross-boundary identifier — server resolves `dimension_id` from `(product_id, dimension_key)`. Keep this contract when extending.
- Stripe sync helpers in `lib/billing/stripe-product-sync.ts` accept an optional `stripeOverride?: StripeClient` — the publish-action test uses this pattern via `vi.mock("@/lib/stripe/client")`.
- `archiveTierPrices(tierId)` is the escape hatch for rollback — preserves IDs so historical subscribers keep billing (spec §4.1). SB-2c archive flow should use it, not delete the Prices.
- Review-step "Edit" uses `setIndex(editIndex)` — the step order is: 0 name-and-slug / 1 usage-dimensions / 2 tiers / 3 pricing / 4 demo-config / 5 review / 6 celebrate.
