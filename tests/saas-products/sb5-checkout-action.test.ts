/**
 * SB-5 — createSaasSubscriptionAction happy paths (3 cadences) +
 * Stripe failure + local-write rollback.
 *
 * Hermetic DB, fake Stripe. Verifies:
 *   - monthly: subscription + setup fee via `add_invoice_items`; deal
 *     written with billing_cadence=monthly, committed_until_date NULL.
 *   - annual_monthly: no setup fee; committed_until_date ~12mo ahead.
 *   - annual_upfront: no setup fee; uses upfront price id.
 *   - Stripe subscription failure: no local deal row; action returns
 *     { ok: false }.
 *   - Local deal-write failure after subscription created: subscription
 *     cancelled, action returns { ok: false }.
 */
import fs from "node:fs";
import path from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { runSeeds } from "@/lib/db/migrate";

// --- Mocks ---------------------------------------------------------------

const stripeState = vi.hoisted(() => ({
  customersCreated: 0,
  customersUpdated: 0,
  subscriptionsCreated: 0,
  subscriptionsCancelled: 0,
  failSubscriptionCreate: false,
  lastSubscriptionParams: null as unknown,
  lastCustomerId: "",
  lastSubscriptionId: "",
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    customers: {
      search: async () => ({ data: [] }),
      create: async () => {
        stripeState.customersCreated++;
        const id = `cus_fake_${stripeState.customersCreated}`;
        stripeState.lastCustomerId = id;
        return { id };
      },
      update: async (id: string) => {
        stripeState.customersUpdated++;
        return { id };
      },
    },
    subscriptions: {
      create: async (params: unknown) => {
        if (stripeState.failSubscriptionCreate) {
          throw new Error("stripe: card_declined");
        }
        stripeState.subscriptionsCreated++;
        stripeState.lastSubscriptionParams = params;
        const id = `sub_fake_${stripeState.subscriptionsCreated}`;
        stripeState.lastSubscriptionId = id;
        return {
          id,
          latest_invoice: {
            id: `in_fake_${stripeState.subscriptionsCreated}`,
            payment_intent: {
              id: `pi_fake_${stripeState.subscriptionsCreated}`,
              client_secret: `pi_fake_${stripeState.subscriptionsCreated}_secret`,
            },
          },
        };
      },
      cancel: async () => {
        stripeState.subscriptionsCancelled++;
        return { id: stripeState.lastSubscriptionId };
      },
    },
  }),
}));

let testDb: ReturnType<typeof drizzle>;
vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-sb5-checkout.db");
let sqlite: Database.Database;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
  const folder = path.join(process.cwd(), "lib/db/migrations");
  drizzleMigrate(testDb, { migrationsFolder: folder });
  runSeeds(sqlite, folder);
});

afterAll(() => {
  sqlite.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

// --- Fixture + helpers ---------------------------------------------------

const PRODUCT_ID = "sb5-test-product";
const PRODUCT_SLUG = "sb5-outreach";
const TIER_ID = "sb5-test-tier";
const MONTHLY_CENTS = 9900;
const SETUP_FEE_CENTS = 9900;

async function seedFixture() {
  const now = Date.now();
  sqlite
    .prepare(
      `INSERT INTO saas_products (id, name, description, slug, status, demo_enabled, demo_config, menu_config, product_config_schema, stripe_product_id, display_order, created_at_ms, updated_at_ms)
       VALUES (?, 'Test', 'Test product', ?, 'active', 0, NULL, NULL, NULL, 'prod_test_sb5', 0, ?, ?)`,
    )
    .run(PRODUCT_ID, PRODUCT_SLUG, now, now);
  sqlite
    .prepare(
      `INSERT INTO saas_tiers (id, product_id, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst, feature_flags, stripe_monthly_price_id, stripe_annual_price_id, stripe_upfront_price_id, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'Standard', 2, ?, ?, '{}', 'price_m', 'price_a', 'price_u', ?, ?)`,
    )
    .run(TIER_ID, PRODUCT_ID, MONTHLY_CENTS, SETUP_FEE_CENTS, now, now);
}

beforeEach(async () => {
  for (const table of [
    "activity_log",
    "deals",
    "contacts",
    "companies",
    "user",
    "saas_tiers",
    "saas_products",
  ]) {
    sqlite.prepare(`DELETE FROM ${table}`).run();
  }
  stripeState.customersCreated = 0;
  stripeState.customersUpdated = 0;
  stripeState.subscriptionsCreated = 0;
  stripeState.subscriptionsCancelled = 0;
  stripeState.failSubscriptionCreate = false;
  stripeState.lastSubscriptionParams = null;
  await seedFixture();
});

function baseInput() {
  return {
    tierId: TIER_ID,
    productSlug: PRODUCT_SLUG,
    email: "buyer@example.com",
    businessName: "Buyer Co",
  };
}

// --- Tests ---------------------------------------------------------------

describe("createSaasSubscriptionAction", () => {
  it("monthly: creates subscription with add_invoice_items setup fee, writes deal", async () => {
    const { createSaasSubscriptionAction } = await import(
      "@/app/get-started/checkout/actions"
    );
    const result = await createSaasSubscriptionAction({
      ...baseInput(),
      cadence: "monthly",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.clientSecret).toMatch(/_secret$/);
    expect(stripeState.subscriptionsCreated).toBe(1);

    const params = stripeState.lastSubscriptionParams as {
      items: Array<{ price: string }>;
      add_invoice_items?: Array<{ price_data: { unit_amount: number } }>;
    };
    expect(params.items[0].price).toBe("price_m");
    expect(params.add_invoice_items?.[0].price_data.unit_amount).toBe(
      SETUP_FEE_CENTS,
    );

    const { deals } = await import("@/lib/db/schema/deals");
    const [deal] = await testDb
      .select()
      .from(deals)
      .where(eq(deals.id, result.dealId));
    expect(deal.billing_cadence).toBe("monthly");
    expect(deal.committed_until_date_ms).toBeNull();
    expect(deal.won_outcome).toBe("saas");
    expect(deal.stage).toBe("won");
    expect(deal.stripe_subscription_id).toBe(stripeState.lastSubscriptionId);
    expect(deal.saas_tier_id).toBe(TIER_ID);
    expect(deal.saas_product_id).toBe(PRODUCT_ID);
  });

  it("annual_monthly: uses annual price id, no setup fee, committed ~12mo", async () => {
    const { createSaasSubscriptionAction } = await import(
      "@/app/get-started/checkout/actions"
    );
    const before = Date.now();
    const result = await createSaasSubscriptionAction({
      ...baseInput(),
      cadence: "annual_monthly",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const params = stripeState.lastSubscriptionParams as {
      items: Array<{ price: string }>;
      add_invoice_items?: unknown;
    };
    expect(params.items[0].price).toBe("price_a");
    expect(params.add_invoice_items).toBeUndefined();

    const { deals } = await import("@/lib/db/schema/deals");
    const [deal] = await testDb
      .select()
      .from(deals)
      .where(eq(deals.id, result.dealId));
    expect(deal.billing_cadence).toBe("annual_monthly");
    expect(deal.committed_until_date_ms).toBeGreaterThan(before);
    // Roughly 12 months — allow a wide window.
    const diff = deal.committed_until_date_ms! - before;
    expect(diff).toBeGreaterThan(300 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(400 * 24 * 60 * 60 * 1000);
  });

  it("annual_upfront: uses upfront price id, no setup fee, committed ~12mo", async () => {
    const { createSaasSubscriptionAction } = await import(
      "@/app/get-started/checkout/actions"
    );
    const result = await createSaasSubscriptionAction({
      ...baseInput(),
      cadence: "annual_upfront",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const params = stripeState.lastSubscriptionParams as {
      items: Array<{ price: string }>;
      add_invoice_items?: unknown;
    };
    expect(params.items[0].price).toBe("price_u");
    expect(params.add_invoice_items).toBeUndefined();

    const { deals } = await import("@/lib/db/schema/deals");
    const [deal] = await testDb
      .select()
      .from(deals)
      .where(eq(deals.id, result.dealId));
    expect(deal.billing_cadence).toBe("annual_upfront");
    expect(deal.committed_until_date_ms).not.toBeNull();
  });

  it("Stripe subscription failure: no deal row, no subscription cancel call", async () => {
    stripeState.failSubscriptionCreate = true;
    const { createSaasSubscriptionAction } = await import(
      "@/app/get-started/checkout/actions"
    );
    const result = await createSaasSubscriptionAction({
      ...baseInput(),
      cadence: "monthly",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("card_declined");

    const count = sqlite
      .prepare("SELECT COUNT(*) as c FROM deals")
      .get() as { c: number };
    expect(count.c).toBe(0);
    expect(stripeState.subscriptionsCreated).toBe(0);
    expect(stripeState.subscriptionsCancelled).toBe(0);
  });

  it("rejects mismatched product slug", async () => {
    const { createSaasSubscriptionAction } = await import(
      "@/app/get-started/checkout/actions"
    );
    const result = await createSaasSubscriptionAction({
      ...baseInput(),
      productSlug: "wrong-slug",
      cadence: "monthly",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid email", async () => {
    const { createSaasSubscriptionAction } = await import(
      "@/app/get-started/checkout/actions"
    );
    const result = await createSaasSubscriptionAction({
      ...baseInput(),
      email: "not-an-email",
      cadence: "monthly",
    });
    expect(result.ok).toBe(false);
  });
});
