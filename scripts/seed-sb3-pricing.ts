/**
 * SB-3 pricing-page E2E fixtures — deterministic + idempotent.
 *
 * Seeds two active products (`outreach` + `ads`) each with three tiers
 * (ranks 1/2/3) + one usage dimension + one limit row per (tier,
 * dimension). Adds a `full-suite` active product with three tiers.
 * Also seeds one archived product that MUST NOT render in the grid.
 *
 * Callable from:
 *   - Playwright `test.beforeAll` via `seedSb3Pricing(db)` (hermetic DB).
 *   - CLI for local inspection:
 *       DB_FILE_PATH=./dev.db npx tsx scripts/seed-sb3-pricing.ts
 *
 * Stripe Price IDs are stubbed (`price_test_*`); the public page only
 * checks presence for the "available" flag, not Stripe reachability.
 *
 * Owner: SB-3. Consumer: tests/e2e/saas-pricing-page.spec.ts.
 */
import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { saas_tier_limits } from "@/lib/db/schema/saas-tier-limits";
import { saas_usage_dimensions } from "@/lib/db/schema/saas-usage-dimensions";

type DB = ReturnType<typeof drizzle<typeof schema>>;

export const SB3_PRICING = {
  outreachId: "e2e-sb3-outreach",
  adsId: "e2e-sb3-ads",
  fullSuiteId: "e2e-sb3-full",
  archivedId: "e2e-sb3-archived",
} as const;

const NOW = 1_700_000_000_000;

async function clearFixture(db: DB) {
  const ids = [
    SB3_PRICING.outreachId,
    SB3_PRICING.adsId,
    SB3_PRICING.fullSuiteId,
    SB3_PRICING.archivedId,
  ];
  for (const id of ids) {
    await db.delete(saas_tier_limits);
    await db.delete(saas_tiers).where(eq(saas_tiers.product_id, id));
    await db
      .delete(saas_usage_dimensions)
      .where(eq(saas_usage_dimensions.product_id, id));
    await db.delete(saas_products).where(eq(saas_products.id, id));
  }
}

async function seedProduct(
  db: DB,
  args: {
    id: string;
    slug: string;
    name: string;
    status: "draft" | "active" | "archived";
    order: number;
    description: string | null;
    dimensionKey: string | null;
    dimensionDisplay: string | null;
    tiers: Array<{
      rank: number;
      name: string;
      monthlyCents: number;
      setupFeeCents: number;
      flags: Record<string, boolean>;
      limit: number | null;
      hasStripePrice: boolean;
    }>;
  },
) {
  await db.insert(saas_products).values({
    id: args.id,
    name: args.name,
    description: args.description,
    slug: args.slug,
    status: args.status,
    demo_enabled: false,
    demo_config: null,
    menu_config: null,
    product_config_schema: null,
    stripe_product_id: `prod_test_${args.id}`,
    display_order: args.order,
    created_at_ms: NOW + args.order,
    updated_at_ms: NOW + args.order,
  });

  let dimensionId: string | null = null;
  if (args.dimensionKey && args.dimensionDisplay) {
    dimensionId = `${args.id}-dim`;
    await db.insert(saas_usage_dimensions).values({
      id: dimensionId,
      product_id: args.id,
      dimension_key: args.dimensionKey,
      display_name: args.dimensionDisplay,
      display_order: 0,
      created_at_ms: NOW,
    });
  }

  for (const t of args.tiers) {
    const tierId = `${args.id}-t${t.rank}`;
    await db.insert(saas_tiers).values({
      id: tierId,
      product_id: args.id,
      name: t.name,
      tier_rank: t.rank,
      monthly_price_cents_inc_gst: t.monthlyCents,
      setup_fee_cents_inc_gst: t.setupFeeCents,
      feature_flags: t.flags,
      stripe_monthly_price_id: t.hasStripePrice
        ? `price_test_m_${tierId}`
        : null,
      stripe_annual_price_id: t.hasStripePrice
        ? `price_test_a_${tierId}`
        : null,
      stripe_upfront_price_id: t.hasStripePrice
        ? `price_test_u_${tierId}`
        : null,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
    if (dimensionId) {
      await db.insert(saas_tier_limits).values({
        id: `${tierId}-lim`,
        tier_id: tierId,
        dimension_id: dimensionId,
        limit_value: t.limit,
      });
    }
  }
}

export async function seedSb3Pricing(db: DB) {
  await clearFixture(db);

  await seedProduct(db, {
    id: SB3_PRICING.outreachId,
    slug: "outreach",
    name: "Outreach",
    status: "active",
    order: 0,
    description: "Find them, write to them, follow up while you sleep.",
    dimensionKey: "sends",
    dimensionDisplay: "Outreach sends",
    tiers: [
      {
        rank: 1,
        name: "Starter",
        monthlyCents: 4900,
        setupFeeCents: 9900,
        flags: { api_access: true, priority_support: false },
        limit: 100,
        hasStripePrice: true,
      },
      {
        rank: 2,
        name: "Standard",
        monthlyCents: 9900,
        setupFeeCents: 9900,
        flags: { api_access: true, ai_drafts: true },
        limit: 500,
        hasStripePrice: true,
      },
      {
        rank: 3,
        name: "Full",
        monthlyCents: 19900,
        setupFeeCents: 9900,
        flags: { api_access: true, ai_drafts: true, priority_support: true },
        limit: null,
        hasStripePrice: true,
      },
    ],
  });

  await seedProduct(db, {
    id: SB3_PRICING.adsId,
    slug: "ads",
    name: "Ads",
    status: "active",
    order: 1,
    description: "Paid campaigns with a rationale doc that actually exists.",
    dimensionKey: "campaigns",
    dimensionDisplay: "Active campaigns",
    tiers: [
      {
        rank: 1,
        name: "Starter",
        monthlyCents: 3900,
        setupFeeCents: 0,
        flags: { meta_ads: true },
        limit: 2,
        hasStripePrice: true,
      },
      {
        rank: 2,
        name: "Standard",
        monthlyCents: 7900,
        setupFeeCents: 0,
        flags: { meta_ads: true, google_ads: true },
        limit: 5,
        hasStripePrice: true,
      },
      {
        rank: 3,
        name: "Full",
        monthlyCents: 14900,
        setupFeeCents: 0,
        flags: { meta_ads: true, google_ads: true, ai_drafts: true },
        limit: null,
        hasStripePrice: true,
      },
    ],
  });

  await seedProduct(db, {
    id: SB3_PRICING.fullSuiteId,
    slug: "full-suite",
    name: "Full Suite",
    status: "active",
    order: 2,
    description: "Every tool SuperBad makes, in one subscription.",
    dimensionKey: null,
    dimensionDisplay: null,
    tiers: [
      {
        rank: 1,
        name: "Starter",
        monthlyCents: 7900,
        setupFeeCents: 0,
        flags: { api_access: true, meta_ads: true },
        limit: null,
        hasStripePrice: true,
      },
      {
        rank: 2,
        name: "Standard",
        monthlyCents: 14900,
        setupFeeCents: 0,
        flags: {
          api_access: true,
          meta_ads: true,
          google_ads: true,
          ai_drafts: true,
        },
        limit: null,
        hasStripePrice: true,
      },
      {
        rank: 3,
        name: "Full",
        monthlyCents: 29900,
        setupFeeCents: 0,
        flags: {
          api_access: true,
          meta_ads: true,
          google_ads: true,
          ai_drafts: true,
          priority_support: true,
        },
        limit: null,
        hasStripePrice: true,
      },
    ],
  });

  await seedProduct(db, {
    id: SB3_PRICING.archivedId,
    slug: "retired-thing",
    name: "Retired Thing",
    status: "archived",
    order: 99,
    description: null,
    dimensionKey: null,
    dimensionDisplay: null,
    tiers: [
      {
        rank: 1,
        name: "Only Tier",
        monthlyCents: 4900,
        setupFeeCents: 0,
        flags: {},
        limit: null,
        hasStripePrice: true,
      },
    ],
  });

  return SB3_PRICING;
}

// CLI entry — lets Andy inspect the fixture on dev.db.
if (require.main === module) {
  void (async () => {
    const { db } = await import("@/lib/db");
    await seedSb3Pricing(db as unknown as DB);
    // eslint-disable-next-line no-console
    console.error("SB-3 pricing fixture seeded.");
  })();
}
