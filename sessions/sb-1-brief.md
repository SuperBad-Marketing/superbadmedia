# `sb-1` — SaaS Subscription Billing infrastructure

**Wave:** 8 (kickoff). **Type:** INFRA. **Model:** `/normal` (Sonnet — schema + thin Stripe sync helpers, no UI, no state machines).
**Spec:** `docs/specs/saas-subscription-billing.md` §11 (schema), §4.1 (Stripe object mapping), §2.1 (two revenue arms).
**Predecessor:** Wave 7 BI-E2E CLOSED 2026-04-15. Branded Invoicing critical flow ships green; Stripe webhook + invoice payment branches in production behaviour.

## Goal

Land the schema primitives + Stripe Product/Price sync helpers that every other SB-* card in Wave 8 builds on. **No public surfaces, no admin wizard, no checkout flow.** Pure data plane + sync layer.

## Acceptance criteria (G12)

1. **Schema migration** adding the five tables from spec §11.1:
   - `saas_products` (id, name, slug UNIQUE, status enum draft|active|archived, demo_enabled, demo_config JSON, menu_config JSON, product_config_schema JSON, stripe_product_id nullable, display_order, timestamps)
   - `saas_tiers` (id, product_id FK, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst default 0, feature_flags JSON, stripe_monthly/annual/upfront price ids nullable, timestamps)
   - `saas_usage_dimensions` (id, product_id FK, dimension_key, display_name, display_order, UNIQUE(product_id, dimension_key))
   - `saas_tier_limits` (id, tier_id FK, dimension_id FK, limit_value nullable=unlimited, UNIQUE(tier_id, dimension_id))
   - `usage_records` (id, contact_id FK, company_id FK, product_id FK, dimension_key, billing_period_start, recorded_at, INDEX(contact_id, product_id, dimension_key, billing_period_start))
   - Plus `deals` column additions (all nullable): `saas_product_id`, `saas_tier_id`, `billing_cadence` enum monthly|annual_monthly|annual_upfront.

2. **Drizzle schema files** under `lib/db/schema/`:
   - `saas-products.ts`, `saas-tiers.ts`, `saas-usage-dimensions.ts`, `saas-tier-limits.ts`, `usage-records.ts`. Re-export from `lib/db/schema/index.ts`.
   - `deals.ts` extended with the three new nullable columns (no behavioural change).

3. **Activity log additions** (spec §11.3) — extend `activity_log.kind` enum with the 11 new values listed there. Schema-only; no callers wired in this wave.

4. **`lib/billing/stripe-product-sync.ts`** — pure helper layer (no Server Actions, no UI). Functions:
   - `syncProductToStripe(productId)` — creates/updates Stripe Product from `saas_products` row; persists `stripe_product_id` back. Idempotent on `stripe_product_id` presence.
   - `syncTierPricesToStripe(tierId)` — creates the three Prices (monthly recurring, annual_monthly recurring, annual_upfront one-time per spec §4.1) for a tier; persists the three `stripe_*_price_id` columns. Idempotent.
   - `archiveTierPrices(tierId)` — sets Stripe Prices `active=false` (price IDs persist for historical subscriptions per spec §4.1).
   All three accept an optional `stripeOverride` for tests, default to `lib/stripe/client`. Use `idempotencyKey: \`saas_product:{id}\`` / `saas_tier_price:{id}:{cadence}` patterns.

5. **Settings keys** (none new — `billing.saas.monthly_setup_fee_cents` is owned by SB-2 per BUILD_PLAN.md, not SB-1). If anything tunable surfaces during build, route through `settings.get()`; never hardcode.

6. **Tests** under `tests/billing/`:
   - `sb1-stripe-product-sync.test.ts` — happy path create + idempotent re-sync + price archival. Mock the Stripe SDK via `vi.hoisted` (pattern matches `tests/stripe/*`).
   - `sb1-schema-shape.test.ts` — hermetic Drizzle migration into in-memory sqlite, assert all five tables + indices + UNIQUE constraints + the three new `deals` columns exist.

## Out of scope (explicitly defer)

- Product admin wizard / `/lite/products` UI → SB-2.
- Public pricing page / checkout / Payment Element → SB-3..5.
- Stripe Subscription creation / `ensureStripeCustomer` reuse → SB-6.
- `checkUsageLimit()` / `recordUsage()` runtime helpers → SB-7. (This wave defines the schema they read; the helpers themselves come next.)
- Setup-fee rules / multi-subscription logic → SB-11/12.

## Gates

- G0 read this brief + `sessions/bi-e2e-handoff.md`.
- G1 preconditions: BI-E2E green; Stripe client (`lib/stripe/client.ts`) wired (used by Wave 7); `deals.stripe_customer_id` exists.
- G2 cite spec §11.1 + §4.1 in commit message.
- G3 file whitelist: 1 migration, 5 new schema files, `lib/db/schema/index.ts` (re-export), `lib/db/schema/deals.ts` (3 new columns), `lib/db/schema/activity-log.ts` (11 new enum values), `lib/billing/stripe-product-sync.ts`, 2 test files. Nothing else.
- G4 literal grep: no new threshold literals; tier_rank is structural data, not a threshold.
- G5 rollback: migration reversible (DROP TABLE for new ones; `ALTER TABLE deals DROP COLUMN` per added column). Drizzle records in `__drizzle_migrations`. Sync helpers don't fire until SB-2 wires them.
- G6 npm deps: zero new packages. Stripe SDK already installed.
- G10.5 external-reviewer gate — **likely required** (data-plane addition + new `activity_log.kind` values + new `deals` columns). If the migration touches `deals`, plan a self-review pass against `feedback_velocity_assumptions` and `project_settings_table_v1_architecture`.
- G11.b next brief: `sessions/sb-2-brief.md` — product-admin wizard (SW-5 integration). Large card; will likely split.
- G12 verification: typecheck clean, unit tests green, **no Playwright run required** (no surfaces touched).

## Open question for Andy

None expected. Schema is fully specced. If something ambiguous surfaces at build time, lock it silently per `feedback_technical_decisions_claude_calls` and document in handoff.

## Memory alignment to check before starting

- `project_llm_model_registry` — irrelevant this wave (no LLM calls).
- `project_settings_table_v1_architecture` — applies to any tunables; default to `settings.get()` over hardcoding.
- `project_saas_popcorn_pricing` — `tier_rank` 1=small, 2=medium, 3=large maps to popcorn tiers; honour the spacing convention (small captures, medium default, large = small jump on price + big revenue lift) when writing fixture/test data.
- `project_tier_limits_protect_margin` — `limit_value` semantics: `null = unlimited` (top-tier power users); finite values protect margin at small/medium.

## Estimated context

Small wave. Schema files are mechanical; sync helpers are 50-80 lines each; tests are ~150 lines. Should fit in one session with headroom.
