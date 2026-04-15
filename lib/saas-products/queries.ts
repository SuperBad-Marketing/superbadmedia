/**
 * Server-only queries for SaaS product admin surfaces.
 * Owner: SB-2a (index) / SB-2c (detail + active-only listing).
 * Spec: docs/specs/saas-subscription-billing.md §8.1, §8.3.
 *
 * `subscriberCount` and `mrrCents` return 0 deterministically until
 * `usage_records` → MRR aggregation lands in SB-7/SB-8. The shape is
 * stable so callers don't change when those wire in.
 */
import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  saas_products,
  SAAS_PRODUCT_STATUSES,
  type SaasProductRow,
  type SaasProductStatus,
} from "@/lib/db/schema/saas-products";
import {
  saas_tiers,
  type SaasTierRow,
} from "@/lib/db/schema/saas-tiers";
import {
  saas_usage_dimensions,
  type SaasUsageDimensionRow,
} from "@/lib/db/schema/saas-usage-dimensions";
import {
  saas_tier_limits,
  type SaasTierLimitRow,
} from "@/lib/db/schema/saas-tier-limits";

export type SaasProductIndexRow = {
  row: SaasProductRow;
  tierCount: number;
  subscriberCount: number; // SB-7/SB-8 will fill
  mrrCents: number; // SB-7/SB-8 will fill
};

export type SaasProductSummaryCounts = {
  activeSubscribers: number;
  mrrCents: number;
  newThisMonth: number;
  churnThisMonth: number;
};

const DEFAULT_INDEX_STATUSES: SaasProductStatus[] = ["draft", "active"];

export async function listSaasProducts(options?: {
  includeArchived?: boolean;
}): Promise<SaasProductIndexRow[]> {
  const statuses = options?.includeArchived
    ? (SAAS_PRODUCT_STATUSES as readonly SaasProductStatus[])
    : DEFAULT_INDEX_STATUSES;

  const products = await db
    .select()
    .from(saas_products)
    .where(inArray(saas_products.status, statuses as SaasProductStatus[]))
    .orderBy(asc(saas_products.display_order), asc(saas_products.created_at_ms));

  const tierRows = await db
    .select({
      product_id: saas_tiers.product_id,
    })
    .from(saas_tiers);

  const tierCountByProduct = new Map<string, number>();
  for (const t of tierRows) {
    tierCountByProduct.set(
      t.product_id,
      (tierCountByProduct.get(t.product_id) ?? 0) + 1,
    );
  }

  return products.map((p) => ({
    row: p,
    tierCount: tierCountByProduct.get(p.id) ?? 0,
    subscriberCount: 0,
    mrrCents: 0,
  }));
}

/**
 * Customer-facing picker query. Used by SB-6 (subscribe flow) — returns
 * only products currently available for new subscriptions. Archived
 * products stay billable for existing subscribers (spec §4.1) but never
 * resurface here.
 */
export async function listActiveSaasProducts(): Promise<SaasProductRow[]> {
  return db
    .select()
    .from(saas_products)
    .where(eq(saas_products.status, "active"))
    .orderBy(asc(saas_products.display_order), asc(saas_products.created_at_ms));
}

export async function getSaasProductSummaryCounts(): Promise<SaasProductSummaryCounts> {
  return {
    activeSubscribers: 0,
    mrrCents: 0,
    newThisMonth: 0,
    churnThisMonth: 0,
  };
}

export async function findSaasProductBySlug(
  slug: string,
): Promise<SaasProductRow | null> {
  const rows = await db
    .select()
    .from(saas_products)
    .where(eq(saas_products.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export type SaasProductDetailTier = {
  row: SaasTierRow;
  limits: Array<{ dimension: SaasUsageDimensionRow; limit: SaasTierLimitRow | null }>;
};

export type SaasProductDetail = {
  row: SaasProductRow;
  dimensions: SaasUsageDimensionRow[];
  tiers: SaasProductDetailTier[];
};

/**
 * Single-pass query for the public pricing grid at `/get-started/pricing`.
 *
 * Returns every `status="active"` product with its dimensions and tiers
 * (including limits + parsed feature flags) in four DB calls — one per
 * table, no per-product N+1. Ordered by `display_order` then
 * `created_at_ms` ascending so the admin's publish order drives the
 * grid column order.
 *
 * Dimension rows are keyed by `dimension_key` for fast join in the
 * consumer; `limit_value === null` surfaces as unlimited.
 *
 * Owner: SB-3. Consumers: `/get-started/pricing` server page (via
 * `buildPricingPageViewModel`), public API (future).
 */
export type PricingTier = {
  row: SaasTierRow;
  limitsByDimensionId: Map<string, SaasTierLimitRow>;
  featureFlags: Record<string, boolean>;
};

export type PricingProduct = {
  row: SaasProductRow;
  dimensions: SaasUsageDimensionRow[];
  tiers: PricingTier[];
};

export async function listActivePricingProducts(): Promise<PricingProduct[]> {
  const products = await db
    .select()
    .from(saas_products)
    .where(eq(saas_products.status, "active"))
    .orderBy(asc(saas_products.display_order), asc(saas_products.created_at_ms));

  if (products.length === 0) return [];

  const productIds = products.map((p) => p.id);

  const dimensionRows = await db
    .select()
    .from(saas_usage_dimensions)
    .where(inArray(saas_usage_dimensions.product_id, productIds))
    .orderBy(
      asc(saas_usage_dimensions.display_order),
      asc(saas_usage_dimensions.created_at_ms),
    );

  const tierRows = await db
    .select()
    .from(saas_tiers)
    .where(inArray(saas_tiers.product_id, productIds))
    .orderBy(asc(saas_tiers.tier_rank));

  const tierIds = tierRows.map((t) => t.id);
  const limitRows = tierIds.length
    ? await db
        .select()
        .from(saas_tier_limits)
        .where(inArray(saas_tier_limits.tier_id, tierIds))
    : [];

  const dimensionsByProduct = new Map<string, SaasUsageDimensionRow[]>();
  for (const d of dimensionRows) {
    const list = dimensionsByProduct.get(d.product_id) ?? [];
    list.push(d);
    dimensionsByProduct.set(d.product_id, list);
  }

  const limitsByTier = new Map<string, Map<string, SaasTierLimitRow>>();
  for (const l of limitRows) {
    let inner = limitsByTier.get(l.tier_id);
    if (!inner) {
      inner = new Map();
      limitsByTier.set(l.tier_id, inner);
    }
    inner.set(l.dimension_id, l);
  }

  const tiersByProduct = new Map<string, PricingTier[]>();
  for (const t of tierRows) {
    const list = tiersByProduct.get(t.product_id) ?? [];
    list.push({
      row: t,
      limitsByDimensionId: limitsByTier.get(t.id) ?? new Map(),
      featureFlags: (t.feature_flags ?? {}) as Record<string, boolean>,
    });
    tiersByProduct.set(t.product_id, list);
  }

  return products.map((p) => ({
    row: p,
    dimensions: dimensionsByProduct.get(p.id) ?? [],
    tiers: tiersByProduct.get(p.id) ?? [],
  }));
}

/**
 * Single-product-and-tier load for `/get-started/checkout`.
 *
 * Resolves `tierId` and validates it belongs to an `active` product with
 * the given slug, and that all three Stripe Price IDs are populated.
 * Returns null for any failed check — the route redirects to
 * `/get-started/pricing` on null.
 *
 * Owner: SB-5.
 */
export type CheckoutTierLoad = {
  product: SaasProductRow;
  tier: SaasTierRow;
};

export async function loadTierForCheckout(
  tierId: string,
  productSlug: string,
): Promise<CheckoutTierLoad | null> {
  const [tier] = await db
    .select()
    .from(saas_tiers)
    .where(eq(saas_tiers.id, tierId))
    .limit(1);
  if (!tier) return null;

  const [product] = await db
    .select()
    .from(saas_products)
    .where(eq(saas_products.id, tier.product_id))
    .limit(1);
  if (!product) return null;

  if (product.slug !== productSlug) return null;
  if (product.status !== "active") return null;
  if (
    !tier.stripe_monthly_price_id ||
    !tier.stripe_annual_price_id ||
    !tier.stripe_upfront_price_id
  ) {
    return null;
  }

  return { product, tier };
}

/**
 * Full Suite highest-tier monthly price (GST-inclusive cents), or null if
 * no Full Suite product is live. Used by the checkout page's second-
 * product nudge line per spec §3.3 and SB-5 brief AC5.
 */
export async function loadFullSuiteTopTierMonthlyCents(): Promise<number | null> {
  const [fs] = await db
    .select()
    .from(saas_products)
    .where(eq(saas_products.slug, "full-suite"))
    .limit(1);
  if (!fs || fs.status !== "active") return null;

  const tiers = await db
    .select()
    .from(saas_tiers)
    .where(eq(saas_tiers.product_id, fs.id))
    .orderBy(asc(saas_tiers.tier_rank));
  if (tiers.length === 0) return null;

  let topCents = tiers[0].monthly_price_cents_inc_gst;
  let topRank = tiers[0].tier_rank;
  for (const t of tiers) {
    if (t.tier_rank > topRank) {
      topRank = t.tier_rank;
      topCents = t.monthly_price_cents_inc_gst;
    }
  }
  return topCents;
}

export async function loadSaasProductDetail(
  productId: string,
): Promise<SaasProductDetail | null> {
  const [row] = await db
    .select()
    .from(saas_products)
    .where(eq(saas_products.id, productId))
    .limit(1);
  if (!row) return null;

  const dimensions = await db
    .select()
    .from(saas_usage_dimensions)
    .where(eq(saas_usage_dimensions.product_id, productId))
    .orderBy(
      asc(saas_usage_dimensions.display_order),
      asc(saas_usage_dimensions.created_at_ms),
    );

  const tierRows = await db
    .select()
    .from(saas_tiers)
    .where(eq(saas_tiers.product_id, productId))
    .orderBy(asc(saas_tiers.tier_rank));

  const tierIds = tierRows.map((t) => t.id);
  const limitRows = tierIds.length
    ? await db
        .select()
        .from(saas_tier_limits)
        .where(inArray(saas_tier_limits.tier_id, tierIds))
    : [];

  const limitsByTier = new Map<string, Map<string, SaasTierLimitRow>>();
  for (const l of limitRows) {
    let inner = limitsByTier.get(l.tier_id);
    if (!inner) {
      inner = new Map();
      limitsByTier.set(l.tier_id, inner);
    }
    inner.set(l.dimension_id, l);
  }

  const tiers: SaasProductDetailTier[] = tierRows.map((t) => {
    const inner = limitsByTier.get(t.id);
    return {
      row: t,
      limits: dimensions.map((d) => ({
        dimension: d,
        limit: inner?.get(d.id) ?? null,
      })),
    };
  });

  return { row, dimensions, tiers };
}
