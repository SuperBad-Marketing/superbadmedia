/**
 * SB-12: spec §4.5 / Q7 invariant guards against the full action path.
 *
 * These complement the pure-function tests on
 * `buildMonthlySetupFeeInvoiceItems` by proving that
 * `createSaasSubscriptionAction` and `applyProductSwitch` wire the
 * helper (or don't) as the spec requires:
 *
 *   - Resubscribe loophole closure: monthly subscription created for a
 *     contact whose company already has a cancelled_post_term deal →
 *     setup fee still charged (no anti-gaming suppression anywhere).
 *   - Annual skip: cadence=annual_monthly → no add_invoice_items.
 *   - Product switch: applyProductSwitch never mounts
 *     add_invoice_items (Stripe items-update only).
 *   - Zero-fee tier: monthly + setup_fee_cents_inc_gst=0 →
 *     add_invoice_items absent (no zero-amount invoice line).
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
import { runSeeds } from "@/lib/db/migrate";

// --- Mocks ---------------------------------------------------------------

const stripeState = vi.hoisted(() => ({
  subscriptionsCreated: 0,
  lastSubscriptionParams: null as unknown,
  itemsUpdateCalls: 0,
  lastItemsUpdateParams: null as unknown,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    customers: {
      search: async () => ({ data: [] }),
      create: async () => ({ id: `cus_fake_${Date.now()}` }),
      update: async (id: string) => ({ id }),
    },
    subscriptions: {
      create: async (params: unknown) => {
        stripeState.subscriptionsCreated++;
        stripeState.lastSubscriptionParams = params;
        const id = `sub_fake_${stripeState.subscriptionsCreated}`;
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
      cancel: async (id: string) => ({ id }),
    },
    subscriptionItems: {
      update: async (_itemId: string, params: unknown) => {
        stripeState.itemsUpdateCalls++;
        stripeState.lastItemsUpdateParams = params;
        return { id: _itemId };
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

const TEST_DB = path.join(process.cwd(), "tests/.test-sb12-invariants.db");
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

// --- Fixture -------------------------------------------------------------

const PRODUCT_ID = "sb12-test-product";
const PRODUCT_SLUG = "sb12-test";
const TIER_ID = "sb12-test-tier";
const MONTHLY_CENTS = 9900;
const SETUP_FEE_CENTS = 9900;

function seedProductAndTier(setupFeeCents = SETUP_FEE_CENTS) {
  const now = Date.now();
  sqlite
    .prepare(
      `INSERT INTO saas_products (id, name, description, slug, status, demo_enabled, demo_config, menu_config, product_config_schema, stripe_product_id, display_order, created_at_ms, updated_at_ms)
       VALUES (?, 'Test', 'Test product', ?, 'active', 0, NULL, NULL, NULL, 'prod_test_sb12', 0, ?, ?)`,
    )
    .run(PRODUCT_ID, PRODUCT_SLUG, now, now);
  sqlite
    .prepare(
      `INSERT INTO saas_tiers (id, product_id, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst, feature_flags, stripe_monthly_price_id, stripe_annual_price_id, stripe_upfront_price_id, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'Standard', 2, ?, ?, '{}', 'price_m', 'price_a', 'price_u', ?, ?)`,
    )
    .run(TIER_ID, PRODUCT_ID, MONTHLY_CENTS, setupFeeCents, now, now);
}

function seedCancelledDeal(email: string, businessName: string) {
  const now = Date.now();
  const userId = `u_${now}`;
  const companyId = `co_${now}`;
  const contactId = `ct_${now}`;
  const dealId = `d_${now}`;
  sqlite
    .prepare(
      `INSERT INTO user (id, email, name, role, created_at_ms) VALUES (?, ?, ?, 'prospect', ?)`,
    )
    .run(userId, email, businessName, now);
  sqlite
    .prepare(
      `INSERT INTO companies (id, name, name_normalised, first_seen_at_ms, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      companyId,
      businessName,
      businessName.toLowerCase(),
      now,
      now,
      now,
    );
  sqlite
    .prepare(
      `INSERT INTO contacts (id, company_id, name, email, email_normalised, is_primary, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(contactId, companyId, businessName, email, email, now, now);
  sqlite
    .prepare(
      `INSERT INTO deals (id, company_id, primary_contact_id, title, stage, last_stage_change_at_ms, won_outcome, billing_cadence, saas_product_id, saas_tier_id, subscription_state, stripe_subscription_id, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, 'Prior cancelled SaaS', 'won', ?, 'saas', 'monthly', ?, ?, 'cancelled_post_term', ?, ?, ?)`,
    )
    .run(
      dealId,
      companyId,
      contactId,
      now,
      PRODUCT_ID,
      TIER_ID,
      `sub_prior_${now}`,
      now,
      now,
    );
  return { userId, companyId, contactId, dealId };
}

beforeEach(() => {
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
  stripeState.subscriptionsCreated = 0;
  stripeState.lastSubscriptionParams = null;
  stripeState.itemsUpdateCalls = 0;
  stripeState.lastItemsUpdateParams = null;
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

describe("SB-12 setup-fee invariants (spec §4.5 / Q7)", () => {
  it("resubscribe loophole: monthly subscription after a prior cancelled deal still charges the setup fee", async () => {
    seedProductAndTier();
    seedCancelledDeal("buyer@example.com", "Buyer Co");

    const { createSaasSubscriptionAction } = await import(
      "@/app/get-started/checkout/actions"
    );
    const result = await createSaasSubscriptionAction({
      ...baseInput(),
      cadence: "monthly",
    });
    expect(result.ok).toBe(true);

    const params = stripeState.lastSubscriptionParams as {
      add_invoice_items?: Array<{ price_data: { unit_amount: number } }>;
    };
    expect(params.add_invoice_items?.[0].price_data.unit_amount).toBe(
      SETUP_FEE_CENTS,
    );
  });

  it("annual_monthly: add_invoice_items absent even when setup fee is set", async () => {
    seedProductAndTier();
    const { createSaasSubscriptionAction } = await import(
      "@/app/get-started/checkout/actions"
    );
    const result = await createSaasSubscriptionAction({
      ...baseInput(),
      cadence: "annual_monthly",
    });
    expect(result.ok).toBe(true);

    const params = stripeState.lastSubscriptionParams as {
      add_invoice_items?: unknown;
    };
    expect(params.add_invoice_items).toBeUndefined();
  });

  it("zero-fee tier on monthly: add_invoice_items absent (no zero-amount line)", async () => {
    seedProductAndTier(0);
    const { createSaasSubscriptionAction } = await import(
      "@/app/get-started/checkout/actions"
    );
    const result = await createSaasSubscriptionAction({
      ...baseInput(),
      cadence: "monthly",
    });
    expect(result.ok).toBe(true);

    const params = stripeState.lastSubscriptionParams as {
      add_invoice_items?: unknown;
    };
    expect(params.add_invoice_items).toBeUndefined();
  });

  it("product switch path never mounts add_invoice_items (items-update only)", async () => {
    // Static-structural guard: re-read the switch handler and confirm it
    // neither imports the setup-fee helper nor references the
    // `add_invoice_items` literal. This catches a future edit that
    // tries to re-charge setup fee on switch (spec Q10b forbids).
    const switchHandler = fs.readFileSync(
      path.join(process.cwd(), "lib/stripe/subscriptions.ts"),
      "utf8",
    );
    const tierChange = fs.readFileSync(
      path.join(process.cwd(), "lib/saas-products/tier-change.ts"),
      "utf8",
    );
    expect(switchHandler).not.toMatch(/add_invoice_items/);
    expect(switchHandler).not.toMatch(/buildMonthlySetupFeeInvoiceItems/);
    expect(tierChange).not.toMatch(/add_invoice_items/);
    expect(tierChange).not.toMatch(/buildMonthlySetupFeeInvoiceItems/);
  });
});
