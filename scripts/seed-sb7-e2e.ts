/**
 * SB-7 usage metering E2E fixture.
 *
 * Seeds two SaaS subscribers against the hermetic Playwright DB, both
 * `subscription_state = "active"` but on opposite sides of their tier
 * cap for one usage dimension (`e2e_actions`, limit 10):
 *   - `warn`  → 8 recorded usage events (80% → warn status)
 *   - `at_cap`→ 10 recorded usage events (100% → at_cap takeover)
 *
 * Product has two tiers so the at_cap hero's upgrade-card has a
 * `nextTier` to render. Uses `Date.now()` as the anchor so
 * `resolveBillingPeriod()` always lands the records inside the current
 * window regardless of wall-clock skew.
 *
 * Consumer: tests/e2e/saas-usage-sticky-bar.spec.ts.
 * Owner: SB-7.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { saas_products } from "@/lib/db/schema/saas-products";

/** Inline copy of resolveBillingPeriod — can't import usage.ts into
 * test fixtures (it pulls `server-only` via `@/lib/db`). */
function resolveBillingPeriod(anchorMs: number, nowMs: number) {
  const anchor = new Date(anchorMs);
  const anchorDay = anchor.getUTCDate();
  const anniversaryFor = (y: number, m: number) => {
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(
      y,
      m,
      Math.min(anchorDay, daysInMonth),
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds(),
    );
  };
  const now = new Date(nowMs);
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  let startMs = anniversaryFor(y, m);
  if (startMs > nowMs) {
    if (m === 0) { y -= 1; m = 11; } else { m -= 1; }
    startMs = anniversaryFor(y, m);
  }
  const nextY = m === 11 ? y + 1 : y;
  const nextM = m === 11 ? 0 : m + 1;
  return { startMs, endMs: anniversaryFor(nextY, nextM) };
}
import { saas_tier_limits } from "@/lib/db/schema/saas-tier-limits";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { saas_usage_dimensions } from "@/lib/db/schema/saas-usage-dimensions";
import { subscriber_magic_link_tokens } from "@/lib/db/schema/subscriber-magic-link-tokens";
import { usage_records } from "@/lib/db/schema/usage-records";
import { user as userTable } from "@/lib/db/schema/user";

type DB = ReturnType<typeof drizzle<typeof schema>>;

export const SB7_E2E = {
  productId: "e2e-sb7-product",
  productSlug: "sb7-product",
  productName: "Metered (SB-7)",
  dimensionId: "e2e-sb7-dim",
  dimensionKey: "e2e_actions",
  dimensionDisplay: "Actions",
  tier1Id: "e2e-sb7-product-t1",
  tier1Name: "Starter",
  tier2Id: "e2e-sb7-product-t2",
  tier2Name: "Scale",
  limit: 10,
  warn: {
    userId: "e2e-sb7-user-warn",
    email: "sb7-warn@example.com",
    companyId: "e2e-sb7-co-warn",
    contactId: "e2e-sb7-contact-warn",
    dealId: "e2e-sb7-deal-warn",
    tokenId: "e2e-sb7-token-warn",
    usage: 8,
  },
  atCap: {
    userId: "e2e-sb7-user-atcap",
    email: "sb7-atcap@example.com",
    companyId: "e2e-sb7-co-atcap",
    contactId: "e2e-sb7-contact-atcap",
    dealId: "e2e-sb7-deal-atcap",
    tokenId: "e2e-sb7-token-atcap",
    usage: 10,
  },
} as const;

async function seedSubscriber(
  db: DB,
  cfg: {
    userId: string;
    email: string;
    companyId: string;
    contactId: string;
    dealId: string;
    tokenId: string;
    usage: number;
  },
  nowMs: number,
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
    created_at_ms: nowMs,
  });

  await db.insert(companies).values({
    id: cfg.companyId,
    name: cfg.email.split("@")[0]!,
    name_normalised: cfg.email.split("@")[0]!.toLowerCase(),
    billing_mode: "stripe",
    do_not_contact: false,
    trial_shoot_status: "none",
    first_seen_at_ms: nowMs,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  await db.insert(contacts).values({
    id: cfg.contactId,
    company_id: cfg.companyId,
    name: cfg.email.split("@")[0]!,
    email: cfg.email,
    email_normalised: cfg.email.toLowerCase(),
    email_status: "valid",
    is_primary: true,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  await db.insert(deals).values({
    id: cfg.dealId,
    company_id: cfg.companyId,
    primary_contact_id: cfg.contactId,
    title: "SB-7 usage subscription",
    stage: "won",
    won_outcome: "saas",
    value_estimated: false,
    subscription_state: "active",
    billing_cadence: "monthly",
    stripe_customer_id: `cus_test_${cfg.userId}`,
    stripe_subscription_id: `sub_test_${cfg.userId}`,
    saas_product_id: SB7_E2E.productId,
    saas_tier_id: SB7_E2E.tier1Id,
    last_stage_change_at_ms: nowMs,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  const period = resolveBillingPeriod(nowMs, nowMs);
  for (let i = 0; i < cfg.usage; i++) {
    await db.insert(usage_records).values({
      id: randomUUID(),
      contact_id: cfg.contactId,
      company_id: cfg.companyId,
      product_id: SB7_E2E.productId,
      dimension_key: SB7_E2E.dimensionKey,
      amount: 1,
      idempotency_key: null,
      billing_period_start_ms: period.startMs,
      billing_period_end_ms: period.endMs,
      recorded_at_ms: nowMs,
    });
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await db.insert(subscriber_magic_link_tokens).values({
    id: cfg.tokenId,
    user_id: cfg.userId,
    token_hash: tokenHash,
    issued_for: "subscriber_login",
    expires_at_ms: Date.now() + 24 * 60 * 60 * 1000 * 365,
    consumed_at_ms: null,
    created_at_ms: nowMs,
  });

  return rawToken;
}

async function clearFixture(db: DB) {
  for (const who of [SB7_E2E.warn, SB7_E2E.atCap]) {
    await db
      .delete(subscriber_magic_link_tokens)
      .where(eq(subscriber_magic_link_tokens.id, who.tokenId));
    await db
      .delete(usage_records)
      .where(eq(usage_records.contact_id, who.contactId));
    await db.delete(deals).where(eq(deals.id, who.dealId));
    await db.delete(contacts).where(eq(contacts.id, who.contactId));
    await db.delete(companies).where(eq(companies.id, who.companyId));
    await db.delete(userTable).where(eq(userTable.id, who.userId));
  }
  await db
    .delete(saas_tier_limits)
    .where(eq(saas_tier_limits.tier_id, SB7_E2E.tier1Id));
  await db
    .delete(saas_tier_limits)
    .where(eq(saas_tier_limits.tier_id, SB7_E2E.tier2Id));
  await db
    .delete(saas_usage_dimensions)
    .where(eq(saas_usage_dimensions.id, SB7_E2E.dimensionId));
  await db.delete(saas_tiers).where(eq(saas_tiers.id, SB7_E2E.tier1Id));
  await db.delete(saas_tiers).where(eq(saas_tiers.id, SB7_E2E.tier2Id));
  await db.delete(saas_products).where(eq(saas_products.id, SB7_E2E.productId));
}

export type Sb7E2eTokens = { warn: string; atCap: string };

export async function seedSb7E2e(db: DB): Promise<Sb7E2eTokens> {
  await clearFixture(db);

  const nowMs = Date.now();

  await db.insert(saas_products).values({
    id: SB7_E2E.productId,
    name: SB7_E2E.productName,
    description: null,
    slug: SB7_E2E.productSlug,
    status: "active",
    demo_enabled: false,
    demo_config: null,
    menu_config: null,
    product_config_schema: null,
    stripe_product_id: `prod_test_${SB7_E2E.productId}`,
    display_order: 43,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  for (const t of [
    { id: SB7_E2E.tier1Id, name: SB7_E2E.tier1Name, rank: 1, price: 4900 },
    { id: SB7_E2E.tier2Id, name: SB7_E2E.tier2Name, rank: 2, price: 9900 },
  ]) {
    await db.insert(saas_tiers).values({
      id: t.id,
      product_id: SB7_E2E.productId,
      name: t.name,
      tier_rank: t.rank,
      monthly_price_cents_inc_gst: t.price,
      setup_fee_cents_inc_gst: 0,
      feature_flags: {},
      stripe_monthly_price_id: `price_test_m_${t.id}`,
      stripe_annual_price_id: `price_test_a_${t.id}`,
      stripe_upfront_price_id: `price_test_u_${t.id}`,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    });
  }

  await db.insert(saas_usage_dimensions).values({
    id: SB7_E2E.dimensionId,
    product_id: SB7_E2E.productId,
    dimension_key: SB7_E2E.dimensionKey,
    display_name: SB7_E2E.dimensionDisplay,
    display_order: 0,
    created_at_ms: nowMs,
  });

  await db.insert(saas_tier_limits).values({
    id: `${SB7_E2E.tier1Id}-${SB7_E2E.dimensionId}`,
    tier_id: SB7_E2E.tier1Id,
    dimension_id: SB7_E2E.dimensionId,
    limit_value: SB7_E2E.limit,
  });
  await db.insert(saas_tier_limits).values({
    id: `${SB7_E2E.tier2Id}-${SB7_E2E.dimensionId}`,
    tier_id: SB7_E2E.tier2Id,
    dimension_id: SB7_E2E.dimensionId,
    limit_value: 100,
  });

  const warn = await seedSubscriber(db, { ...SB7_E2E.warn }, nowMs);
  const atCap = await seedSubscriber(db, { ...SB7_E2E.atCap }, nowMs);
  return { warn, atCap };
}
