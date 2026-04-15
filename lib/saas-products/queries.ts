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
