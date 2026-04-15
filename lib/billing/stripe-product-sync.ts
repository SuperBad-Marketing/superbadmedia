/**
 * SB-1: Stripe Product/Price sync helpers.
 *
 * Pure data-plane layer — no Server Actions, no UI, no emission of
 * activity-log rows. Owners:
 *   `syncProductToStripe(productId)`  → creates/updates the Stripe Product
 *   `syncTierPricesToStripe(tierId)`  → creates the three Prices per tier
 *   `archiveTierPrices(tierId)`       → flips Stripe Prices to active=false
 *
 * Each helper is idempotent: re-running after partial success picks up
 * where it left off. Stripe's `idempotencyKey` header de-dupes the
 * underlying API call even under retry storms.
 *
 * Source of truth: docs/specs/saas-subscription-billing.md §4.1 + §11.1.
 * Consumed by SB-2 (product admin wizard) and SB-6 (subscription creation).
 */
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { getStripe } from "@/lib/stripe/client";

type StripeClient = Pick<Stripe, "products" | "prices">;

function now(): number {
  return Date.now();
}

export interface SyncProductResult {
  stripeProductId: string;
  created: boolean;
}

/**
 * Create or update the Stripe Product row mirroring a Lite
 * `saas_products` record. Persists `stripe_product_id` back on success.
 * Idempotent on `stripe_product_id` presence — if already set, updates
 * name/description/active state in place.
 */
export async function syncProductToStripe(
  productId: string,
  stripeOverride?: StripeClient,
): Promise<SyncProductResult> {
  const stripe = stripeOverride ?? getStripe();
  const [product] = await db
    .select()
    .from(saas_products)
    .where(eq(saas_products.id, productId))
    .limit(1);
  if (!product) {
    throw new Error(`saas_products row not found: ${productId}`);
  }

  const active = product.status === "active";

  if (product.stripe_product_id) {
    await stripe.products.update(product.stripe_product_id, {
      name: product.name,
      description: product.description ?? undefined,
      active,
    });
    return { stripeProductId: product.stripe_product_id, created: false };
  }

  const created = await stripe.products.create(
    {
      name: product.name,
      description: product.description ?? undefined,
      active,
      metadata: {
        lite_product_id: product.id,
        lite_product_slug: product.slug,
      },
    },
    { idempotencyKey: `saas_product:${product.id}` },
  );

  await db
    .update(saas_products)
    .set({ stripe_product_id: created.id, updated_at_ms: now() })
    .where(eq(saas_products.id, product.id));

  return { stripeProductId: created.id, created: true };
}

export interface SyncTierPricesResult {
  stripeMonthlyPriceId: string;
  stripeAnnualPriceId: string;
  stripeUpfrontPriceId: string;
  createdAny: boolean;
}

/**
 * Create the three Stripe Prices for a tier (monthly, annual-billed-
 * monthly, annual-upfront). Prices are immutable in Stripe, so this
 * helper only **creates** missing Prices — it never mutates existing
 * ones. The caller (SB-2) archives + recreates on price changes via
 * `archiveTierPrices()` + a fresh call here.
 */
export async function syncTierPricesToStripe(
  tierId: string,
  stripeOverride?: StripeClient,
): Promise<SyncTierPricesResult> {
  const stripe = stripeOverride ?? getStripe();
  const [tier] = await db
    .select()
    .from(saas_tiers)
    .where(eq(saas_tiers.id, tierId))
    .limit(1);
  if (!tier) {
    throw new Error(`saas_tiers row not found: ${tierId}`);
  }
  const [product] = await db
    .select()
    .from(saas_products)
    .where(eq(saas_products.id, tier.product_id))
    .limit(1);
  if (!product?.stripe_product_id) {
    throw new Error(
      `tier ${tierId}: parent product not yet synced to Stripe — call syncProductToStripe first`,
    );
  }

  const stripeProductId = product.stripe_product_id;
  const monthlyCents = tier.monthly_price_cents_inc_gst;
  const annualUpfrontCents = monthlyCents * 12;

  let createdAny = false;
  let monthlyId = tier.stripe_monthly_price_id;
  let annualId = tier.stripe_annual_price_id;
  let upfrontId = tier.stripe_upfront_price_id;

  if (!monthlyId) {
    const price = await stripe.prices.create(
      {
        product: stripeProductId,
        unit_amount: monthlyCents,
        currency: "aud",
        recurring: { interval: "month" },
        metadata: { lite_tier_id: tier.id, cadence: "monthly" },
      },
      { idempotencyKey: `saas_tier_price:${tier.id}:monthly` },
    );
    monthlyId = price.id;
    createdAny = true;
  }
  if (!annualId) {
    const price = await stripe.prices.create(
      {
        product: stripeProductId,
        unit_amount: monthlyCents,
        currency: "aud",
        recurring: { interval: "month" },
        metadata: {
          lite_tier_id: tier.id,
          cadence: "annual_monthly",
        },
      },
      { idempotencyKey: `saas_tier_price:${tier.id}:annual_monthly` },
    );
    annualId = price.id;
    createdAny = true;
  }
  if (!upfrontId) {
    const price = await stripe.prices.create(
      {
        product: stripeProductId,
        unit_amount: annualUpfrontCents,
        currency: "aud",
        recurring: { interval: "year" },
        metadata: { lite_tier_id: tier.id, cadence: "annual_upfront" },
      },
      { idempotencyKey: `saas_tier_price:${tier.id}:annual_upfront` },
    );
    upfrontId = price.id;
    createdAny = true;
  }

  if (createdAny) {
    await db
      .update(saas_tiers)
      .set({
        stripe_monthly_price_id: monthlyId,
        stripe_annual_price_id: annualId,
        stripe_upfront_price_id: upfrontId,
        updated_at_ms: now(),
      })
      .where(eq(saas_tiers.id, tier.id));
  }

  return {
    stripeMonthlyPriceId: monthlyId!,
    stripeAnnualPriceId: annualId!,
    stripeUpfrontPriceId: upfrontId!,
    createdAny,
  };
}

/**
 * Archive all three Stripe Prices for a tier (sets `active=false`).
 * Price IDs are preserved locally so historical subscriptions keep
 * working (per spec §4.1 — Stripe Prices stay billable for existing
 * subscribers even when archived).
 */
export async function archiveTierPrices(
  tierId: string,
  stripeOverride?: StripeClient,
): Promise<void> {
  const stripe = stripeOverride ?? getStripe();
  const [tier] = await db
    .select()
    .from(saas_tiers)
    .where(eq(saas_tiers.id, tierId))
    .limit(1);
  if (!tier) {
    throw new Error(`saas_tiers row not found: ${tierId}`);
  }

  const priceIds = [
    tier.stripe_monthly_price_id,
    tier.stripe_annual_price_id,
    tier.stripe_upfront_price_id,
  ].filter((id): id is string => Boolean(id));

  for (const id of priceIds) {
    await stripe.prices.update(id, { active: false });
  }
}
