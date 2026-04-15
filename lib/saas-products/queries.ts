/**
 * Server-only queries for SaaS product admin surfaces.
 * Owner: SB-2a. Spec: docs/specs/saas-subscription-billing.md §8.1.
 *
 * `subscriberCount` and `mrrCents` return 0 deterministically in SB-2a —
 * no subscribers exist yet and `usage_records` → MRR aggregation lands in
 * SB-7/SB-8. The shape is stable so callers don't change when those wire in.
 */
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  saas_products,
  type SaasProductRow,
} from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";

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

export async function listSaasProducts(): Promise<SaasProductIndexRow[]> {
  const products = await db
    .select()
    .from(saas_products)
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
    subscriberCount: 0, // SB-2a stub; SB-7/SB-8 fills
    mrrCents: 0, // SB-2a stub; SB-7/SB-8 fills
  }));
}

export async function getSaasProductSummaryCounts(): Promise<SaasProductSummaryCounts> {
  // SB-2a: all zeros (no subscribers yet). Shape stable for SB-7/SB-8.
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
