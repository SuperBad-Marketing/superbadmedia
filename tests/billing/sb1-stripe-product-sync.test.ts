/**
 * SB-1: `syncProductToStripe` + `syncTierPricesToStripe` +
 * `archiveTierPrices` tests. Hermetic sqlite + injected Stripe mock via
 * the `stripeOverride` argument.
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
import type Stripe from "stripe";

const TEST_DB = path.join(
  process.cwd(),
  "tests/.test-sb1-stripe-product-sync.db",
);
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const {
  syncProductToStripe,
  syncTierPricesToStripe,
  archiveTierPrices,
} = await import("@/lib/billing/stripe-product-sync");
const { saas_products } = await import("@/lib/db/schema/saas-products");
const { saas_tiers } = await import("@/lib/db/schema/saas-tiers");

const NOW = 1_700_000_000_000;

type MockStripe = Pick<Stripe, "products" | "prices">;

function makeMockStripe(opts: {
  createProductId?: string;
  priceIds?: { monthly?: string; annual?: string; upfront?: string };
}) {
  const mock = {
    products: {
      create: vi.fn().mockResolvedValue({ id: opts.createProductId ?? "prod_X" }),
      update: vi.fn().mockResolvedValue({}),
    },
    prices: {
      create: vi
        .fn()
        .mockImplementation(async (args: { metadata: { cadence: string } }) => {
          const c = args.metadata.cadence;
          return {
            id:
              c === "monthly"
                ? opts.priceIds?.monthly ?? "price_M"
                : c === "annual_monthly"
                  ? opts.priceIds?.annual ?? "price_A"
                  : opts.priceIds?.upfront ?? "price_U",
          };
        }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return mock as unknown as MockStripe & {
    products: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    prices: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  };
}

function seedProduct(
  overrides: Partial<{
    id: string;
    status: "draft" | "active" | "archived";
    stripe_product_id: string | null;
  }> = {},
) {
  const id = overrides.id ?? "p_test";
  testDb
    .insert(saas_products)
    .values({
      id,
      name: "Test Product",
      description: "desc",
      slug: `slug-${id}`,
      status: overrides.status ?? "active",
      demo_enabled: false,
      display_order: 0,
      stripe_product_id: overrides.stripe_product_id ?? null,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return id;
}

function seedTier(productId: string, overrides: Partial<{
  id: string;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
  stripe_upfront_price_id: string | null;
}> = {}) {
  const id = overrides.id ?? "t_test";
  testDb
    .insert(saas_tiers)
    .values({
      id,
      product_id: productId,
      name: "Small",
      tier_rank: 1,
      monthly_price_cents_inc_gst: 4900,
      setup_fee_cents_inc_gst: 0,
      stripe_monthly_price_id: overrides.stripe_monthly_price_id ?? null,
      stripe_annual_price_id: overrides.stripe_annual_price_id ?? null,
      stripe_upfront_price_id: overrides.stripe_upfront_price_id ?? null,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return id;
}

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
  drizzleMigrate(testDb, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

beforeEach(() => {
  sqlite.exec("DELETE FROM saas_tier_limits");
  sqlite.exec("DELETE FROM saas_usage_dimensions");
  sqlite.exec("DELETE FROM saas_tiers");
  sqlite.exec("DELETE FROM saas_products");
});

describe("syncProductToStripe", () => {
  it("creates a new Stripe product when stripe_product_id is null", async () => {
    const id = seedProduct({ id: "p_new", stripe_product_id: null });
    const stripe = makeMockStripe({ createProductId: "prod_abc" });

    const result = await syncProductToStripe(id, stripe);

    expect(result).toEqual({ stripeProductId: "prod_abc", created: true });
    expect(stripe.products.create).toHaveBeenCalledTimes(1);
    expect(stripe.products.create.mock.calls[0][1]).toEqual({
      idempotencyKey: `saas_product:${id}`,
    });

    const [row] = await testDb
      .select()
      .from(saas_products)
      .where(eq(saas_products.id, id));
    expect(row.stripe_product_id).toBe("prod_abc");
  });

  it("updates the existing Stripe product on re-sync (idempotent)", async () => {
    const id = seedProduct({
      id: "p_existing",
      stripe_product_id: "prod_existing",
    });
    const stripe = makeMockStripe({});

    const result = await syncProductToStripe(id, stripe);

    expect(result).toEqual({
      stripeProductId: "prod_existing",
      created: false,
    });
    expect(stripe.products.create).not.toHaveBeenCalled();
    expect(stripe.products.update).toHaveBeenCalledWith(
      "prod_existing",
      expect.objectContaining({ active: true }),
    );
  });

  it("sets active=false for archived products on update", async () => {
    const id = seedProduct({
      id: "p_arch",
      status: "archived",
      stripe_product_id: "prod_arch",
    });
    const stripe = makeMockStripe({});

    await syncProductToStripe(id, stripe);

    expect(stripe.products.update).toHaveBeenCalledWith(
      "prod_arch",
      expect.objectContaining({ active: false }),
    );
  });

  it("throws when product row missing", async () => {
    const stripe = makeMockStripe({});
    await expect(syncProductToStripe("p_missing", stripe)).rejects.toThrow(
      /not found/,
    );
  });
});

describe("syncTierPricesToStripe", () => {
  it("creates three Prices with correct cadence + idempotency keys", async () => {
    const productId = seedProduct({
      id: "p_t",
      stripe_product_id: "prod_t",
    });
    const tierId = seedTier(productId, { id: "t_full" });
    const stripe = makeMockStripe({
      priceIds: { monthly: "pm_m", annual: "pm_a", upfront: "pm_u" },
    });

    const result = await syncTierPricesToStripe(tierId, stripe);

    expect(result).toEqual({
      stripeMonthlyPriceId: "pm_m",
      stripeAnnualPriceId: "pm_a",
      stripeUpfrontPriceId: "pm_u",
      createdAny: true,
    });
    expect(stripe.prices.create).toHaveBeenCalledTimes(3);

    const calls = stripe.prices.create.mock.calls;
    const keys = calls.map((c) => c[1].idempotencyKey).sort();
    expect(keys).toEqual([
      `saas_tier_price:${tierId}:annual_monthly`,
      `saas_tier_price:${tierId}:annual_upfront`,
      `saas_tier_price:${tierId}:monthly`,
    ]);

    const upfrontCall = calls.find(
      (c) => c[0].metadata.cadence === "annual_upfront",
    )!;
    expect(upfrontCall[0].unit_amount).toBe(4900 * 12);
    expect(upfrontCall[0].recurring).toEqual({ interval: "year" });

    const [row] = await testDb
      .select()
      .from(saas_tiers)
      .where(eq(saas_tiers.id, tierId));
    expect(row.stripe_monthly_price_id).toBe("pm_m");
    expect(row.stripe_annual_price_id).toBe("pm_a");
    expect(row.stripe_upfront_price_id).toBe("pm_u");
  });

  it("is a no-op when all three price IDs already persisted", async () => {
    const productId = seedProduct({
      id: "p_idem",
      stripe_product_id: "prod_idem",
    });
    const tierId = seedTier(productId, {
      id: "t_idem",
      stripe_monthly_price_id: "pm_m_old",
      stripe_annual_price_id: "pm_a_old",
      stripe_upfront_price_id: "pm_u_old",
    });
    const stripe = makeMockStripe({});

    const result = await syncTierPricesToStripe(tierId, stripe);

    expect(result.createdAny).toBe(false);
    expect(stripe.prices.create).not.toHaveBeenCalled();
    expect(result.stripeMonthlyPriceId).toBe("pm_m_old");
  });

  it("only creates the missing Price when two of three are already persisted", async () => {
    const productId = seedProduct({
      id: "p_partial",
      stripe_product_id: "prod_partial",
    });
    const tierId = seedTier(productId, {
      id: "t_partial",
      stripe_monthly_price_id: "pm_m_kept",
      stripe_annual_price_id: "pm_a_kept",
    });
    const stripe = makeMockStripe({ priceIds: { upfront: "pm_u_new" } });

    const result = await syncTierPricesToStripe(tierId, stripe);

    expect(result.createdAny).toBe(true);
    expect(stripe.prices.create).toHaveBeenCalledTimes(1);
    expect(stripe.prices.create.mock.calls[0][0].metadata.cadence).toBe(
      "annual_upfront",
    );
    expect(result.stripeUpfrontPriceId).toBe("pm_u_new");
  });

  it("throws when parent product hasn't been synced", async () => {
    const productId = seedProduct({ id: "p_unsynced", stripe_product_id: null });
    const tierId = seedTier(productId, { id: "t_unsynced" });
    const stripe = makeMockStripe({});

    await expect(syncTierPricesToStripe(tierId, stripe)).rejects.toThrow(
      /syncProductToStripe first/,
    );
  });
});

describe("archiveTierPrices", () => {
  it("sets active=false on every persisted Stripe Price", async () => {
    const productId = seedProduct({
      id: "p_archv",
      stripe_product_id: "prod_archv",
    });
    const tierId = seedTier(productId, {
      id: "t_archv",
      stripe_monthly_price_id: "pm_m",
      stripe_annual_price_id: "pm_a",
      stripe_upfront_price_id: "pm_u",
    });
    const stripe = makeMockStripe({});

    await archiveTierPrices(tierId, stripe);

    expect(stripe.prices.update).toHaveBeenCalledTimes(3);
    const calls = stripe.prices.update.mock.calls.map((c) => c[0]).sort();
    expect(calls).toEqual(["pm_a", "pm_m", "pm_u"]);
    expect(stripe.prices.update.mock.calls[0][1]).toEqual({ active: false });
  });

  it("skips null price IDs without throwing", async () => {
    const productId = seedProduct({
      id: "p_archnull",
      stripe_product_id: "prod_archnull",
    });
    const tierId = seedTier(productId, {
      id: "t_archnull",
      stripe_monthly_price_id: "pm_only",
    });
    const stripe = makeMockStripe({});

    await archiveTierPrices(tierId, stripe);

    expect(stripe.prices.update).toHaveBeenCalledTimes(1);
    expect(stripe.prices.update).toHaveBeenCalledWith("pm_only", {
      active: false,
    });
  });
});
