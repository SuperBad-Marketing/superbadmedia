/**
 * SB-2b — publishSaasProductAction happy path + Stripe-rollback path.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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

const authMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ user: { id: "admin-1", role: "admin" } }),
);
vi.mock("@/lib/auth/auth", () => ({ auth: authMock }));
vi.mock("@/lib/auth/session", () => ({ auth: authMock }));

const stripeState = vi.hoisted(() => ({
  failOnPriceCreate: false,
  productsCreated: 0,
  pricesCreated: 0,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    products: {
      create: async (_body: unknown) => {
        stripeState.productsCreated++;
        return { id: `prod_fake_${stripeState.productsCreated}` };
      },
      update: async (_id: string, _body: unknown) => ({ id: _id }),
    },
    prices: {
      create: async (_body: unknown) => {
        if (stripeState.failOnPriceCreate) {
          throw new Error("stripe price creation blew up");
        }
        stripeState.pricesCreated++;
        return { id: `price_fake_${stripeState.pricesCreated}` };
      },
      update: async (_id: string, _body: unknown) => ({ id: _id }),
    },
  }),
}));

let testDb: ReturnType<typeof drizzle>;
vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-sb2b-publish.db");
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

beforeEach(() => {
  sqlite.prepare("DELETE FROM wizard_completions").run();
  sqlite.prepare("DELETE FROM saas_tier_limits").run();
  sqlite.prepare("DELETE FROM saas_tiers").run();
  sqlite.prepare("DELETE FROM activity_log").run();
  sqlite.prepare("DELETE FROM saas_usage_dimensions").run();
  sqlite.prepare("DELETE FROM saas_products").run();
  authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  stripeState.failOnPriceCreate = false;
  stripeState.productsCreated = 0;
  stripeState.pricesCreated = 0;
});

async function seedDraft(): Promise<{
  productId: string;
  dimensionKeys: string[];
}> {
  const { persistSaasProductDraftAction } = await import(
    "@/app/lite/setup/admin/[key]/actions-saas-product"
  );
  const r = await persistSaasProductDraftAction({
    name: "Popcorn Pro",
    description: "Tasty.",
    slug: `popcorn-${randomUUID().slice(0, 8)}`,
    dimensions: [
      { key: "api_calls", displayName: "API calls" },
      { key: "active_campaigns", displayName: "Active campaigns" },
    ],
  });
  if (!r.ok) throw new Error("seed failed: " + r.reason);
  return {
    productId: r.productId,
    dimensionKeys: ["api_calls", "active_campaigns"],
  };
}

function threeTiers(dimKeys: string[]) {
  const mk = (rank: 1 | 2 | 3, monthly: number) => ({
    tierRank: rank,
    name: ["Small", "Medium", "Large"][rank - 1],
    monthlyCents: monthly,
    setupFeeCents: 0,
    featureFlags: {},
    limits: dimKeys.map((k) => ({ dimensionKey: k, value: 1000 * rank })),
  });
  return [mk(1, 2900), mk(2, 9900), mk(3, 29900)];
}

describe("publishSaasProductAction", () => {
  it("happy path: flips draft→active, writes tiers + limits + completion", async () => {
    const { publishSaasProductAction } = await import(
      "@/app/lite/setup/admin/[key]/actions-saas-product"
    );
    const { productId, dimensionKeys } = await seedDraft();

    const r = await publishSaasProductAction({
      productId,
      tiers: threeTiers(dimensionKeys),
      demo: { enabled: false, config: {} },
    });
    expect(r.ok).toBe(true);

    const product = sqlite
      .prepare("SELECT status, stripe_product_id FROM saas_products WHERE id = ?")
      .get(productId) as { status: string; stripe_product_id: string | null };
    expect(product.status).toBe("active");
    expect(product.stripe_product_id).toMatch(/^prod_fake_/);

    const tiers = sqlite
      .prepare("SELECT tier_rank, name FROM saas_tiers WHERE product_id = ? ORDER BY tier_rank")
      .all(productId) as Array<{ tier_rank: number; name: string }>;
    expect(tiers.map((t) => t.tier_rank)).toEqual([1, 2, 3]);

    const limits = sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM saas_tier_limits WHERE tier_id IN (SELECT id FROM saas_tiers WHERE product_id = ?)",
      )
      .get(productId) as { c: number };
    expect(limits.c).toBe(6); // 3 tiers × 2 dimensions

    const completion = sqlite
      .prepare(
        "SELECT wizard_key, user_id FROM wizard_completions WHERE wizard_key = 'saas-product-setup'",
      )
      .get() as { wizard_key: string; user_id: string } | undefined;
    expect(completion?.user_id).toBe("admin-1");

    const published = sqlite
      .prepare(
        "SELECT kind FROM activity_log WHERE kind = 'saas_product_published'",
      )
      .get() as { kind: string } | undefined;
    expect(published).toBeDefined();

    expect(stripeState.pricesCreated).toBe(9); // 3 tiers × 3 cadences
  });

  it("Stripe failure reverts product to draft and logs error", async () => {
    const { publishSaasProductAction } = await import(
      "@/app/lite/setup/admin/[key]/actions-saas-product"
    );
    const { productId, dimensionKeys } = await seedDraft();

    stripeState.failOnPriceCreate = true;
    const r = await publishSaasProductAction({
      productId,
      tiers: threeTiers(dimensionKeys),
      demo: { enabled: false, config: {} },
    });
    expect(r.ok).toBe(false);

    const product = sqlite
      .prepare("SELECT status FROM saas_products WHERE id = ?")
      .get(productId) as { status: string };
    expect(product.status).toBe("draft");

    const notes = sqlite
      .prepare("SELECT meta FROM activity_log WHERE kind = 'note'")
      .all() as Array<{ meta: string }>;
    const hasFailLog = notes.some((n) =>
      String(n.meta).includes("saas_product_publish_stripe_failed"),
    );
    expect(hasFailLog).toBe(true);
  });

  it("rejects non-admin callers", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "c-1", role: "client" } });
    const { publishSaasProductAction } = await import(
      "@/app/lite/setup/admin/[key]/actions-saas-product"
    );
    const r = await publishSaasProductAction({
      productId: "does-not-matter",
      tiers: threeTiers(["a"]),
      demo: { enabled: false, config: {} },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects wrong tier count", async () => {
    const { publishSaasProductAction } = await import(
      "@/app/lite/setup/admin/[key]/actions-saas-product"
    );
    const { productId, dimensionKeys } = await seedDraft();
    const r = await publishSaasProductAction({
      productId,
      tiers: threeTiers(dimensionKeys).slice(0, 2),
      demo: { enabled: false, config: {} },
    });
    expect(r.ok).toBe(false);
  });
});
