/**
 * SB-5 checkout-page E2E fixtures — deterministic + idempotent.
 *
 * Seeds ONE active product (`outreach-sb5`) with three tiers (all three
 * Stripe Price IDs populated as stubs) plus one active Full Suite
 * product so the second-product nudge can render in tests that
 * exercise the authed-subscriber path.
 *
 * Callable from:
 *   - Playwright `test.beforeAll` via `seedSb5Checkout(db)` (hermetic DB).
 *   - CLI for local inspection:
 *       DB_FILE_PATH=./dev.db npx tsx scripts/seed-sb5-checkout.ts
 *
 * Owner: SB-5. Consumer: tests/e2e/saas-checkout-page.spec.ts.
 */
import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";

type DB = ReturnType<typeof drizzle<typeof schema>>;

export const SB5_CHECKOUT = {
  outreachId: "e2e-sb5-outreach",
  outreachSlug: "outreach-sb5",
  mediumTierId: "e2e-sb5-outreach-t2",
  fullSuiteId: "e2e-sb5-full-suite",
} as const;

const NOW = 1_700_000_000_000;

async function clearFixture(db: DB) {
  for (const id of [SB5_CHECKOUT.outreachId, SB5_CHECKOUT.fullSuiteId]) {
    await db.delete(saas_tiers).where(eq(saas_tiers.product_id, id));
    await db.delete(saas_products).where(eq(saas_products.id, id));
  }
}

async function seedProduct(
  db: DB,
  args: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    order: number;
    tiers: Array<{
      id: string;
      rank: number;
      name: string;
      monthlyCents: number;
      setupFeeCents: number;
    }>;
  },
) {
  await db.insert(saas_products).values({
    id: args.id,
    name: args.name,
    description: args.description,
    slug: args.slug,
    status: "active",
    demo_enabled: false,
    demo_config: null,
    menu_config: null,
    product_config_schema: null,
    stripe_product_id: `prod_test_${args.id}`,
    display_order: args.order,
    created_at_ms: NOW + args.order,
    updated_at_ms: NOW + args.order,
  });
  for (const t of args.tiers) {
    await db.insert(saas_tiers).values({
      id: t.id,
      product_id: args.id,
      name: t.name,
      tier_rank: t.rank,
      monthly_price_cents_inc_gst: t.monthlyCents,
      setup_fee_cents_inc_gst: t.setupFeeCents,
      feature_flags: {},
      stripe_monthly_price_id: `price_test_m_${t.id}`,
      stripe_annual_price_id: `price_test_a_${t.id}`,
      stripe_upfront_price_id: `price_test_u_${t.id}`,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
  }
}

export async function seedSb5Checkout(db: DB) {
  await clearFixture(db);
  await seedProduct(db, {
    id: SB5_CHECKOUT.outreachId,
    slug: SB5_CHECKOUT.outreachSlug,
    name: "Outreach",
    description: "Find them, write to them, follow up while you sleep.",
    order: 0,
    tiers: [
      {
        id: `${SB5_CHECKOUT.outreachId}-t1`,
        rank: 1,
        name: "Starter",
        monthlyCents: 4900,
        setupFeeCents: 9900,
      },
      {
        id: SB5_CHECKOUT.mediumTierId,
        rank: 2,
        name: "Standard",
        monthlyCents: 9900,
        setupFeeCents: 9900,
      },
      {
        id: `${SB5_CHECKOUT.outreachId}-t3`,
        rank: 3,
        name: "Full",
        monthlyCents: 19900,
        setupFeeCents: 9900,
      },
    ],
  });
  await seedProduct(db, {
    id: SB5_CHECKOUT.fullSuiteId,
    slug: "full-suite",
    name: "Full Suite",
    description: "Every tool in one.",
    order: 1,
    tiers: [
      {
        id: `${SB5_CHECKOUT.fullSuiteId}-t1`,
        rank: 1,
        name: "Starter",
        monthlyCents: 7900,
        setupFeeCents: 0,
      },
      {
        id: `${SB5_CHECKOUT.fullSuiteId}-t2`,
        rank: 2,
        name: "Standard",
        monthlyCents: 14900,
        setupFeeCents: 0,
      },
      {
        id: `${SB5_CHECKOUT.fullSuiteId}-t3`,
        rank: 3,
        name: "Full",
        monthlyCents: 29900,
        setupFeeCents: 0,
      },
    ],
  });
  return SB5_CHECKOUT;
}

if (require.main === module) {
  void (async () => {
    const { db } = await import("@/lib/db");
    await seedSb5Checkout(db as unknown as DB);
    // eslint-disable-next-line no-console
    console.error("SB-5 checkout fixture seeded.");
  })();
}
