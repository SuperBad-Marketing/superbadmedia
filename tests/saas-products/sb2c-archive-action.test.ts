/**
 * SB-2c — archive / un-archive actions.
 *
 * Verifies: happy archive flips status + calls archiveTierPrices once
 * per tier; Stripe failure leaves local status archived (+ logs note);
 * un-archive flips status back; admin gate denies non-admins.
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
  failOnPriceUpdate: false,
  priceUpdates: [] as string[],
  productUpdates: [] as string[],
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    products: {
      create: async () => ({ id: "prod_fake" }),
      update: async (id: string, _body: unknown) => {
        stripeState.productUpdates.push(id);
        return { id };
      },
    },
    prices: {
      create: async () => ({ id: "price_fake" }),
      update: async (id: string, _body: unknown) => {
        if (stripeState.failOnPriceUpdate) {
          throw new Error("stripe price update blew up");
        }
        stripeState.priceUpdates.push(id);
        return { id };
      },
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

let testDb: ReturnType<typeof drizzle>;
vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-sb2c-archive.db");
let sqlite: Database.Database;
const NOW = 1_700_000_000_000;

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
  sqlite.prepare("DELETE FROM activity_log").run();
  sqlite.prepare("DELETE FROM saas_tier_limits").run();
  sqlite.prepare("DELETE FROM saas_tiers").run();
  sqlite.prepare("DELETE FROM saas_usage_dimensions").run();
  sqlite.prepare("DELETE FROM saas_products").run();
  authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  stripeState.failOnPriceUpdate = false;
  stripeState.priceUpdates = [];
  stripeState.productUpdates = [];
});

function seedActiveProduct(): { productId: string; tierIds: string[] } {
  const productId = randomUUID();
  sqlite
    .prepare(
      `INSERT INTO saas_products (id, name, description, slug, status, demo_enabled, display_order, stripe_product_id, created_at_ms, updated_at_ms)
       VALUES (?, 'Popcorn', NULL, 'popcorn', 'active', 0, 0, 'prod_existing', ?, ?)`,
    )
    .run(productId, NOW, NOW);
  const tierIds: string[] = [];
  for (const rank of [1, 2, 3]) {
    const id = randomUUID();
    tierIds.push(id);
    sqlite
      .prepare(
        `INSERT INTO saas_tiers (id, product_id, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst, stripe_monthly_price_id, stripe_annual_price_id, stripe_upfront_price_id, created_at_ms, updated_at_ms)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        productId,
        `Tier ${rank}`,
        rank,
        4900 * rank,
        `price_m_${rank}`,
        `price_a_${rank}`,
        `price_u_${rank}`,
        NOW,
        NOW,
      );
  }
  return { productId, tierIds };
}

describe("archiveSaasProductAction", () => {
  it("happy path: flips active→archived, logs, archives all three Prices per tier", async () => {
    const { productId } = seedActiveProduct();
    const { archiveSaasProductAction } = await import(
      "@/app/lite/admin/products/actions-archive"
    );
    const r = await archiveSaasProductAction(productId);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.stripeSynced).toBe(true);

    const row = sqlite
      .prepare("SELECT status FROM saas_products WHERE id = ?")
      .get(productId) as { status: string };
    expect(row.status).toBe("archived");

    const archivedLog = sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM activity_log WHERE kind = 'saas_product_archived'",
      )
      .get() as { c: number };
    expect(archivedLog.c).toBe(1);

    // 3 tiers × 3 Prices = 9 updates, plus 1 product update.
    expect(stripeState.priceUpdates).toHaveLength(9);
    expect(stripeState.productUpdates).toHaveLength(1);
  });

  it("Stripe failure leaves local status archived + logs failure note", async () => {
    const { productId } = seedActiveProduct();
    stripeState.failOnPriceUpdate = true;
    const { archiveSaasProductAction } = await import(
      "@/app/lite/admin/products/actions-archive"
    );
    const r = await archiveSaasProductAction(productId);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.stripeSynced).toBe(false);

    const row = sqlite
      .prepare("SELECT status FROM saas_products WHERE id = ?")
      .get(productId) as { status: string };
    expect(row.status).toBe("archived");

    const notes = sqlite
      .prepare("SELECT meta FROM activity_log WHERE kind = 'note'")
      .all() as Array<{ meta: string }>;
    const hasFailLog = notes.some((n) =>
      String(n.meta).includes("saas_product_archive_stripe_failed"),
    );
    expect(hasFailLog).toBe(true);
  });

  it("refuses non-admin", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "c-1", role: "client" } });
    const { archiveSaasProductAction } = await import(
      "@/app/lite/admin/products/actions-archive"
    );
    const r = await archiveSaasProductAction("does-not-matter");
    expect(r.ok).toBe(false);
  });

  it("refuses when product already archived", async () => {
    const { productId } = seedActiveProduct();
    sqlite
      .prepare("UPDATE saas_products SET status = 'archived' WHERE id = ?")
      .run(productId);
    const { archiveSaasProductAction } = await import(
      "@/app/lite/admin/products/actions-archive"
    );
    const r = await archiveSaasProductAction(productId);
    expect(r.ok).toBe(false);
  });
});

describe("unarchiveSaasProductAction", () => {
  it("happy path: flips archived→active", async () => {
    const { productId } = seedActiveProduct();
    sqlite
      .prepare("UPDATE saas_products SET status = 'archived' WHERE id = ?")
      .run(productId);

    const { unarchiveSaasProductAction } = await import(
      "@/app/lite/admin/products/actions-archive"
    );
    const r = await unarchiveSaasProductAction(productId);
    expect(r.ok).toBe(true);

    const row = sqlite
      .prepare("SELECT status FROM saas_products WHERE id = ?")
      .get(productId) as { status: string };
    expect(row.status).toBe("active");

    // Stripe Product flipped back to active=true.
    expect(stripeState.productUpdates).toContain("prod_existing");
  });

  it("refuses when product is active", async () => {
    const { productId } = seedActiveProduct();
    const { unarchiveSaasProductAction } = await import(
      "@/app/lite/admin/products/actions-archive"
    );
    const r = await unarchiveSaasProductAction(productId);
    expect(r.ok).toBe(false);
  });

  it("refuses non-admin", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "c-1", role: "client" } });
    const { unarchiveSaasProductAction } = await import(
      "@/app/lite/admin/products/actions-archive"
    );
    const r = await unarchiveSaasProductAction("does-not-matter");
    expect(r.ok).toBe(false);
  });
});
