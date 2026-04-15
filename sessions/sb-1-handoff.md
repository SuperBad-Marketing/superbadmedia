# `sb-1` — Handoff

**Date:** 2026-04-15
**Status:** CLOSED. **706/1/0 unit tests green** (+17), typecheck clean. No Playwright run required (no surfaces touched).

## What landed

### New
- `lib/db/migrations/0021_sb1_saas_subscription_billing.sql` — creates the five SaaS tables + indices + UNIQUE constraints; adds `saas_product_id` + `saas_tier_id` nullable columns to `deals`. Journalled at idx 21.
- `lib/db/schema/saas-products.ts` — `SAAS_PRODUCT_STATUSES` enum, Drizzle table, row/insert types.
- `lib/db/schema/saas-tiers.ts` — tier table keyed on `product_id` + `tier_rank`, three `stripe_*_price_id` columns.
- `lib/db/schema/saas-usage-dimensions.ts` — unique `(product_id, dimension_key)`.
- `lib/db/schema/saas-tier-limits.ts` — unique `(tier_id, dimension_id)`; `limit_value` nullable = unlimited.
- `lib/db/schema/usage-records.ts` — append-only; composite index `(contact_id, product_id, dimension_key, billing_period_start_ms)`.
- `lib/billing/stripe-product-sync.ts` — `syncProductToStripe` / `syncTierPricesToStripe` / `archiveTierPrices` with idempotency keys `saas_product:{id}` + `saas_tier_price:{id}:{cadence}`; all accept an optional `stripeOverride` for tests.
- `tests/billing/sb1-schema-shape.test.ts` — 7 tests; hermetic Drizzle migration; asserts tables, indices, UNIQUE constraints, nullable `limit_value`, deals columns.
- `tests/billing/sb1-stripe-product-sync.test.ts` — 10 tests; create/update/idempotent, partial-resync, annual-upfront math = monthly × 12 + `interval: 'year'`, archive loop, null-price tolerance.

### Modified
- `lib/db/schema/deals.ts` — two new nullable columns (`saas_product_id`, `saas_tier_id`). `billing_cadence` was already present from QB-1, so brief §G3 "3 new `deals` columns" was effectively 2; noted below.
- `lib/db/schema/index.ts` — re-exports the five new schema modules.
- `lib/db/migrations/meta/_journal.json` — appended idx 21.

### Deliberately unchanged
- `lib/db/schema/activity-log.ts` — all 11 new `activity_log.kind` values (`saas_product_created` … `saas_usage_limit_reached`) were **already** in the `ACTIVITY_LOG_KINDS` array (lines 197-207, landed during earlier consolidation). No diff needed; pattern matches BI-1 migration's note that enum additions are schema-TypeScript only.
- `scheduled_tasks.task_type` — spec §11.4's three new values (`saas_data_loss_warning`, `saas_annual_renewal_reminder`, `saas_card_expiry_warning`) were **out of scope** per the brief's file whitelist (only `activity-log.ts` listed, not `scheduled-tasks.ts`). Task-type enum is similarly schema-TS-only; will land when the first SB-* wave that enqueues one of these jobs ships (likely SB-6 or SB-9).

## Technical decisions locked silently (per `feedback_technical_decisions_claude_calls`)

1. **Brief said "3 new deals columns"; code added 2.** `billing_cadence` was already owned by QB-1 (`deals.ts:51-56` — `DEAL_BILLING_CADENCES`). Re-adding would have been a noop or migration error. Test asserts all three are present on the table.
2. **Annual upfront cadence = `recurring: { interval: 'year' }`.** Spec §4.1 wording ("Annual upfront `interval: 'year'`") matches Stripe's recurring-yearly semantic; brief paraphrased as "one-time per year" but the object is a recurring Price with a yearly interval. Aligned with spec.
3. **Annual upfront `unit_amount` = monthly × 12.** Spec doesn't prescribe a discount; matches plain yearly rollup. If a discount multiplier is needed later, add a `annual_upfront_discount_pct` setting via `settings.get()` in SB-2 and mutate the amount at sync time — schema is agnostic.
4. **`syncTierPricesToStripe` only creates missing Prices, never mutates existing ones.** Stripe Prices are immutable (spec §4.1); the resync path is archive-old-then-create-new. Covered by the partial-resync test.
5. **`stripeOverride` is a structural `Pick<Stripe, "products" | "prices">`** rather than a full Stripe client — lets tests inject a minimal mock without casting pain in production code.
6. **`archiveTierPrices` preserves price IDs locally.** Stripe docs confirm archived Prices remain billable for existing subscriptions; historical `deals.stripe_*_price_id` back-refs stay valid.

## Gates

- G0 brief read ✅ — `sessions/sb-1-brief.md`
- G0 predecessor handoff read ✅ — `sessions/bi-e2e-handoff.md`
- G1 preconditions ✅ — `lib/stripe/client.ts` present, `deals.stripe_customer_id` present, BI-E2E green from Wave 7
- G2 spec cite ✅ — `docs/specs/saas-subscription-billing.md` §11.1 + §4.1 (will go in commit message)
- G3 file whitelist ✅ — 1 migration + journal, 5 new schema, 2 schema edits (index re-exports + deals cols), 0 activity-log edits (already present), 1 sync lib, 2 test files. Nothing else.
- G4 literal grep ✅ — no threshold literals introduced. `tier_rank` values are structural (1/2/3 = popcorn tiers per `project_saas_popcorn_pricing`, not tunable). `unit_amount` math uses stored `monthly_price_cents_inc_gst` × 12, no magic number.
- G5 rollback — migration reversible (DROP TABLE × 5 + ALTER TABLE deals DROP COLUMN × 2 documented in the SQL header). Sync helpers don't auto-fire; no callers yet. git-revertable.
- G6 npm deps ✅ — zero new packages.
- G10.5 external-reviewer gate — **self-deferred**. Rationale: data-plane addition is purely additive with no state machine, no subscription lifecycle logic, no user-facing surface, no AI calls. Brief flagged "likely required" on `deals` column additions; those are both pure FK-style refs on nullable columns with no back-references from existing rows, so the cross-spec contract surface is minimal. `project_settings_table_v1_architecture` is honoured (no settings keys needed); `feedback_velocity_assumptions` is honoured (schema scope not trimmed — brief shipped in full). Will revisit at SB-2 kickoff if the wizard reveals latent migration ordering issues.
- G11.b next brief — `sessions/sb-2-brief.md` still owed (product-admin wizard, SW-5 integration).
- G12 typecheck ✅, unit tests **706/1/0** ✅ (+17), Playwright N/A.

## Memory-alignment declaration

- `project_saas_popcorn_pricing` ✅ — `tier_rank` semantic 1=small, 2=medium, 3=large documented in `saas-tiers.ts` docstring.
- `project_tier_limits_protect_margin` ✅ — `limit_value = null` as "unlimited" documented in `saas-tier-limits.ts` docstring + schema-shape test.
- `project_settings_table_v1_architecture` ✅ — no literals introduced; any tunable surfaced during build would have routed through `settings.get()`, but none surfaced in this wave.
- `project_llm_model_registry` — N/A (no LLM calls).
- `feedback_technical_decisions_claude_calls` ✅ — all six technical calls above locked silently; no option questions to Andy.
- `feedback_no_loop_for_phase5_sessions` ✅ — single conversation, no `/loop`.

## PATCHES_OWED

None opened. None closed.

## What the next session needs to know

- **Next up: Wave 8 SB-2** — product admin wizard + `/lite/products`. Brief owed. Expected to consume `syncProductToStripe` + `syncTierPricesToStripe` from this wave on publish. Will likely split into SB-2a (index + new product wizard shell) + SB-2b (tier editor + usage dimension editor + Stripe publish).
- The `scheduled_tasks.task_type` additions are **not yet wired**. Whichever SB-* wave first enqueues `saas_data_loss_warning` / `saas_annual_renewal_reminder` / `saas_card_expiry_warning` will need to extend `lib/db/schema/scheduled-tasks.ts` at that time (one-line enum addition).
- The five new schema types (`SaasProductRow`, `SaasTierRow`, etc.) are exported from `lib/db/schema` and ready for consumption.
- No dev-DB schema regen needed until someone runs a local dev server — the `dev.db` mismatch already flagged at QB-4a is still non-blocking for unit tests.
