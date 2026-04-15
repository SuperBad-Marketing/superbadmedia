/**
 * SB-6b onboarding-gate E2E fixture.
 *
 * Seeds two SaaS subscribers in distinct subscription states against the
 * hermetic Playwright DB:
 *   - `active`   → asserts full dashboard + Brand DNA CTA
 *   - `past_due` → asserts billing-portal hero
 *
 * Each subscriber gets its own:
 *   - `user` row (role=prospect; redeem promotes to client)
 *   - `companies` + `contacts` row (email matches user email)
 *   - `deals` row with subscription_state + saas_product_id + tier + stripe_customer_id
 *   - `subscriber_magic_link_tokens` row (hashed raw token)
 *
 * Returns the raw tokens for direct redeem via
 * `/api/auth/magic-link?token=...` in test steps.
 *
 * Owner: SB-6b. Consumer: tests/e2e/saas-onboarding-gate.spec.ts.
 */
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { subscriber_magic_link_tokens } from "@/lib/db/schema/subscriber-magic-link-tokens";
import { user as userTable } from "@/lib/db/schema/user";

type DB = ReturnType<typeof drizzle<typeof schema>>;

const NOW = 1_700_000_000_000;

export const SB6B_E2E = {
  productId: "e2e-sb6b-product",
  productSlug: "sb6b-product",
  productName: "Outreach (SB-6b)",
  tierId: "e2e-sb6b-product-t2",
  tierName: "Standard",
  active: {
    userId: "e2e-sb6b-user-active",
    email: "sb6b-active@example.com",
    companyId: "e2e-sb6b-co-active",
    contactId: "e2e-sb6b-contact-active",
    dealId: "e2e-sb6b-deal-active",
    tokenId: "e2e-sb6b-token-active",
  },
  pastDue: {
    userId: "e2e-sb6b-user-pastdue",
    email: "sb6b-pastdue@example.com",
    companyId: "e2e-sb6b-co-pastdue",
    contactId: "e2e-sb6b-contact-pastdue",
    dealId: "e2e-sb6b-deal-pastdue",
    tokenId: "e2e-sb6b-token-pastdue",
  },
} as const;

type Variant = "active" | "past_due";

async function seedSubscriber(
  db: DB,
  cfg: {
    userId: string;
    email: string;
    companyId: string;
    contactId: string;
    dealId: string;
    tokenId: string;
    state: Variant;
  },
): Promise<string> {
  await db.insert(userTable).values({
    id: cfg.userId,
    email: cfg.email,
    name: cfg.email.split("@")[0]!,
    role: "prospect",
    timezone: "Australia/Melbourne",
    motion_preference: "full",
    sounds_enabled: true,
    density_preference: "comfortable",
    text_size_preference: "default",
    theme_preset: "base-nova",
    typeface_preset: "default",
    created_at_ms: NOW,
  });

  await db.insert(companies).values({
    id: cfg.companyId,
    name: cfg.email.split("@")[0]!,
    name_normalised: cfg.email.split("@")[0]!.toLowerCase(),
    billing_mode: "stripe",
    do_not_contact: false,
    trial_shoot_status: "none",
    first_seen_at_ms: NOW,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  });

  await db.insert(contacts).values({
    id: cfg.contactId,
    company_id: cfg.companyId,
    name: cfg.email.split("@")[0]!,
    email: cfg.email,
    email_normalised: cfg.email.toLowerCase(),
    email_status: "valid",
    is_primary: true,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  });

  await db.insert(deals).values({
    id: cfg.dealId,
    company_id: cfg.companyId,
    primary_contact_id: cfg.contactId,
    title: `${cfg.state} subscription`,
    stage: "won",
    won_outcome: "saas",
    value_estimated: false,
    subscription_state: cfg.state,
    billing_cadence: "monthly",
    stripe_customer_id: `cus_test_${cfg.userId}`,
    stripe_subscription_id: `sub_test_${cfg.userId}`,
    saas_product_id: SB6B_E2E.productId,
    saas_tier_id: SB6B_E2E.tierId,
    last_stage_change_at_ms: NOW,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  });

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await db.insert(subscriber_magic_link_tokens).values({
    id: cfg.tokenId,
    user_id: cfg.userId,
    token_hash: tokenHash,
    issued_for: "subscriber_login",
    // Long-lived: keep usable beyond the Jan-2024-anchored fixture NOW.
    expires_at_ms: Date.now() + 24 * 60 * 60 * 1000 * 365,
    consumed_at_ms: null,
    created_at_ms: NOW,
  });

  return rawToken;
}

async function clearFixture(db: DB) {
  for (const who of [SB6B_E2E.active, SB6B_E2E.pastDue]) {
    await db
      .delete(subscriber_magic_link_tokens)
      .where(eq(subscriber_magic_link_tokens.id, who.tokenId));
    await db.delete(deals).where(eq(deals.id, who.dealId));
    await db.delete(contacts).where(eq(contacts.id, who.contactId));
    await db.delete(companies).where(eq(companies.id, who.companyId));
    await db.delete(userTable).where(eq(userTable.id, who.userId));
  }
  await db
    .delete(saas_tiers)
    .where(eq(saas_tiers.product_id, SB6B_E2E.productId));
  await db.delete(saas_products).where(eq(saas_products.id, SB6B_E2E.productId));
}

export type Sb6bE2eTokens = {
  active: string;
  pastDue: string;
};

export async function seedSb6bE2e(db: DB): Promise<Sb6bE2eTokens> {
  await clearFixture(db);

  await db.insert(saas_products).values({
    id: SB6B_E2E.productId,
    name: SB6B_E2E.productName,
    description: null,
    slug: SB6B_E2E.productSlug,
    status: "active",
    demo_enabled: false,
    demo_config: null,
    menu_config: null,
    product_config_schema: null,
    stripe_product_id: `prod_test_${SB6B_E2E.productId}`,
    display_order: 42,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  });

  await db.insert(saas_tiers).values({
    id: SB6B_E2E.tierId,
    product_id: SB6B_E2E.productId,
    name: SB6B_E2E.tierName,
    tier_rank: 2,
    monthly_price_cents_inc_gst: 9900,
    setup_fee_cents_inc_gst: 0,
    feature_flags: {},
    stripe_monthly_price_id: `price_test_m_${SB6B_E2E.tierId}`,
    stripe_annual_price_id: `price_test_a_${SB6B_E2E.tierId}`,
    stripe_upfront_price_id: `price_test_u_${SB6B_E2E.tierId}`,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  });

  const active = await seedSubscriber(db, {
    ...SB6B_E2E.active,
    state: "active",
  });
  const pastDue = await seedSubscriber(db, {
    ...SB6B_E2E.pastDue,
    state: "past_due",
  });

  return { active, pastDue };
}

if (require.main === module) {
  void (async () => {
    const { db } = await import("@/lib/db");
    const tokens = await seedSb6bE2e(db as unknown as DB);
    // eslint-disable-next-line no-console
    console.error("SB-6b E2E fixture seeded.", tokens);
  })();
}
