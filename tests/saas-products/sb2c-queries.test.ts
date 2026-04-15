/**
 * SB-2c — detail query + archive-filter + active-only listing.
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

let testDb: ReturnType<typeof drizzle>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-sb2c-queries.db");
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
  sqlite.prepare("DELETE FROM saas_tier_limits").run();
  sqlite.prepare("DELETE FROM saas_tiers").run();
  sqlite.prepare("DELETE FROM saas_usage_dimensions").run();
  sqlite.prepare("DELETE FROM saas_products").run();
});

function seedProduct(
  id: string,
  slug: string,
  status: "draft" | "active" | "archived",
  order = 0,
) {
  sqlite
    .prepare(
      `INSERT INTO saas_products (id, name, description, slug, status, demo_enabled, display_order, created_at_ms, updated_at_ms)
       VALUES (?, ?, NULL, ?, ?, 0, ?, ?, ?)`,
    )
    .run(id, `Product ${id}`, slug, status, order, NOW, NOW);
}

function seedDimension(id: string, productId: string, key: string, order = 0) {
  sqlite
    .prepare(
      `INSERT INTO saas_usage_dimensions (id, product_id, dimension_key, display_name, display_order, created_at_ms)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, productId, key, `Display ${key}`, order, NOW);
}

function seedTier(
  id: string,
  productId: string,
  rank: number,
  monthlyCents = 4900,
) {
  sqlite
    .prepare(
      `INSERT INTO saas_tiers (id, product_id, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst, feature_flags, stripe_monthly_price_id, stripe_annual_price_id, stripe_upfront_price_id, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      productId,
      `Tier ${rank}`,
      rank,
      monthlyCents,
      JSON.stringify({ flag_a: true }),
      `price_m_${id}`,
      `price_a_${id}`,
      `price_u_${id}`,
      NOW,
      NOW,
    );
}

function seedLimit(
  id: string,
  tierId: string,
  dimensionId: string,
  value: number | null,
) {
  sqlite
    .prepare(
      `INSERT INTO saas_tier_limits (id, tier_id, dimension_id, limit_value)
       VALUES (?, ?, ?, ?)`,
    )
    .run(id, tierId, dimensionId, value);
}

describe("SB-2c queries", () => {
  it("listSaasProducts hides archived by default", async () => {
    seedProduct("p_draft", "draft", "draft", 0);
    seedProduct("p_active", "active", "active", 1);
    seedProduct("p_archived", "archived", "archived", 2);

    const { listSaasProducts } = await import("@/lib/saas-products/queries");
    const rows = await listSaasProducts();
    const ids = rows.map((r) => r.row.id).sort();
    expect(ids).toEqual(["p_active", "p_draft"]);
  });

  it("listSaasProducts includes archived when flag set", async () => {
    seedProduct("p_draft", "draft", "draft");
    seedProduct("p_active", "active", "active", 1);
    seedProduct("p_archived", "archived", "archived", 2);

    const { listSaasProducts } = await import("@/lib/saas-products/queries");
    const rows = await listSaasProducts({ includeArchived: true });
    expect(rows.map((r) => r.row.id).sort()).toEqual([
      "p_active",
      "p_archived",
      "p_draft",
    ]);
  });

  it("listActiveSaasProducts returns only active rows", async () => {
    seedProduct("p_draft", "draft", "draft");
    seedProduct("p_active_1", "active-1", "active", 1);
    seedProduct("p_archived", "archived", "archived", 2);
    seedProduct("p_active_2", "active-2", "active", 3);

    const { listActiveSaasProducts } = await import(
      "@/lib/saas-products/queries"
    );
    const rows = await listActiveSaasProducts();
    expect(rows.map((r) => r.id)).toEqual(["p_active_1", "p_active_2"]);
  });

  it("loadSaasProductDetail returns null for missing product", async () => {
    const { loadSaasProductDetail } = await import(
      "@/lib/saas-products/queries"
    );
    const detail = await loadSaasProductDetail("does-not-exist");
    expect(detail).toBeNull();
  });

  it("loadSaasProductDetail returns the full shape with dimensions + tiers + limits", async () => {
    seedProduct("p_1", "full", "active");
    seedDimension("d_1", "p_1", "api_calls", 0);
    seedDimension("d_2", "p_1", "seats", 1);
    seedTier("t_1", "p_1", 1, 2900);
    seedTier("t_2", "p_1", 2, 9900);
    seedLimit("l_1", "t_1", "d_1", 1000);
    seedLimit("l_2", "t_1", "d_2", 3);
    seedLimit("l_3", "t_2", "d_1", null); // unlimited
    // t_2 × d_2 limit missing → detail should surface as null

    const { loadSaasProductDetail } = await import(
      "@/lib/saas-products/queries"
    );
    const detail = await loadSaasProductDetail("p_1");
    expect(detail).not.toBeNull();
    expect(detail!.row.id).toBe("p_1");
    expect(detail!.dimensions.map((d) => d.dimension_key)).toEqual([
      "api_calls",
      "seats",
    ]);
    expect(detail!.tiers.map((t) => t.row.tier_rank)).toEqual([1, 2]);

    const tier1 = detail!.tiers[0];
    expect(tier1.limits).toHaveLength(2);
    expect(tier1.limits[0].limit?.limit_value).toBe(1000);
    expect(tier1.limits[1].limit?.limit_value).toBe(3);

    const tier2 = detail!.tiers[1];
    expect(tier2.limits[0].limit?.limit_value).toBeNull();
    expect(tier2.limits[1].limit).toBeNull();
  });
});
