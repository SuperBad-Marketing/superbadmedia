/**
 * SB-E2E signup golden-path fixture — seeds one active SaaS product + one
 * Medium tier wired to a real Stripe test-mode product + monthly price.
 *
 * Only used by `tests/e2e/saas-signup.spec.ts`. Unlike the SB-5 stub seed
 * (`seed-sb5-checkout.ts`), the Stripe IDs passed in here are LIVE
 * test-mode IDs created by the spec's `beforeAll` via the Stripe API —
 * so `stripe.subscriptions.create` inside `createSaasSubscriptionAction`
 * will actually resolve against Stripe.
 *
 * Owner: SB-E2E.
 */
import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";

type DB = ReturnType<typeof drizzle<typeof schema>>;

export const SBE2E = {
  productId: "e2e-sbe2e-outreach",
  productSlug: "outreach-sbe2e",
  productName: "Outreach",
  tierId: "e2e-sbe2e-outreach-medium",
  tierName: "Standard",
  tierRank: 2,
  monthlyPriceCents: 9900,
  setupFeeCents: 9900,
} as const;

const NOW = 1_700_000_000_000;

export type SbE2eStripeIds = {
  stripeProductId: string;
  stripeMonthlyPriceId: string;
};

async function clearFixture(db: DB) {
  await db.delete(saas_tiers).where(eq(saas_tiers.product_id, SBE2E.productId));
  await db.delete(saas_products).where(eq(saas_products.id, SBE2E.productId));
}

export async function seedSbE2e(db: DB, stripe: SbE2eStripeIds) {
  await clearFixture(db);

  await db.insert(saas_products).values({
    id: SBE2E.productId,
    name: SBE2E.productName,
    description: "Find them, write to them, follow up while you sleep.",
    slug: SBE2E.productSlug,
    status: "active",
    demo_enabled: false,
    demo_config: null,
    menu_config: null,
    product_config_schema: null,
    stripe_product_id: stripe.stripeProductId,
    display_order: 0,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  });

  // Three tiers so the pricing page renders a normal column. Only the
  // Medium tier has a live Stripe price — the others reuse placeholder
  // IDs so the spec never clicks into them.
  const tiers = [
    {
      id: `${SBE2E.productId}-t1`,
      rank: 1,
      name: "Starter",
      monthlyCents: 4900,
      setupFeeCents: 9900,
      monthlyPriceId: `price_test_placeholder_${SBE2E.productId}_t1`,
    },
    {
      id: SBE2E.tierId,
      rank: SBE2E.tierRank,
      name: SBE2E.tierName,
      monthlyCents: SBE2E.monthlyPriceCents,
      setupFeeCents: SBE2E.setupFeeCents,
      monthlyPriceId: stripe.stripeMonthlyPriceId,
    },
    {
      id: `${SBE2E.productId}-t3`,
      rank: 3,
      name: "Full",
      monthlyCents: 19900,
      setupFeeCents: 9900,
      monthlyPriceId: `price_test_placeholder_${SBE2E.productId}_t3`,
    },
  ];

  for (const t of tiers) {
    await db.insert(saas_tiers).values({
      id: t.id,
      product_id: SBE2E.productId,
      name: t.name,
      tier_rank: t.rank,
      monthly_price_cents_inc_gst: t.monthlyCents,
      setup_fee_cents_inc_gst: t.setupFeeCents,
      feature_flags: {},
      stripe_monthly_price_id: t.monthlyPriceId,
      stripe_annual_price_id: `${t.monthlyPriceId}_a`,
      stripe_upfront_price_id: `${t.monthlyPriceId}_u`,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
  }

  return SBE2E;
}
