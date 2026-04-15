/**
 * SB-1 schema shape test.
 *
 * Hermetic Drizzle migration into an on-disk sqlite file; asserts all
 * five new SaaS tables, their indices + UNIQUE constraints, and the two
 * new nullable `deals` columns exist. Confirms migration 0021 lands
 * cleanly on top of the existing chain.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";

const TEST_DB = path.join(process.cwd(), "tests/.test-sb1-schema.db");

let sqlite: Database.Database;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  drizzleMigrate(db, {
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

function tableExists(name: string): boolean {
  const row = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    )
    .get(name);
  return Boolean(row);
}

function indexExists(name: string): boolean {
  const row = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
    )
    .get(name);
  return Boolean(row);
}

function columnNames(table: string): string[] {
  return sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((r) => (r as { name: string }).name);
}

describe("SB-1 schema shape", () => {
  it("creates the five new SaaS tables", () => {
    expect(tableExists("saas_products")).toBe(true);
    expect(tableExists("saas_tiers")).toBe(true);
    expect(tableExists("saas_usage_dimensions")).toBe(true);
    expect(tableExists("saas_tier_limits")).toBe(true);
    expect(tableExists("usage_records")).toBe(true);
  });

  it("creates the expected indices", () => {
    expect(indexExists("saas_products_status_idx")).toBe(true);
    expect(indexExists("saas_tiers_product_idx")).toBe(true);
    expect(indexExists("saas_usage_dimensions_product_key_idx")).toBe(true);
    expect(indexExists("saas_tier_limits_tier_dim_idx")).toBe(true);
    expect(indexExists("usage_records_lookup_idx")).toBe(true);
  });

  it("enforces UNIQUE on saas_products.slug", () => {
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO saas_products (id, name, slug, status, created_at_ms, updated_at_ms)
         VALUES ('p1','One','product-one','draft',?,?)`,
      )
      .run(now, now);
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO saas_products (id, name, slug, status, created_at_ms, updated_at_ms)
           VALUES ('p2','Two','product-one','draft',?,?)`,
        )
        .run(now, now),
    ).toThrow(/UNIQUE/);
  });

  it("enforces UNIQUE(product_id, dimension_key) on saas_usage_dimensions", () => {
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO saas_usage_dimensions (id, product_id, dimension_key, display_name, created_at_ms)
         VALUES ('d1','p1','api_calls','API calls',?)`,
      )
      .run(now);
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO saas_usage_dimensions (id, product_id, dimension_key, display_name, created_at_ms)
           VALUES ('d2','p1','api_calls','Again',?)`,
        )
        .run(now),
    ).toThrow(/UNIQUE/);
  });

  it("enforces UNIQUE(tier_id, dimension_id) on saas_tier_limits", () => {
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO saas_tiers (id, product_id, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst, created_at_ms, updated_at_ms)
         VALUES ('t1','p1','Small',1,4900,0,?,?)`,
      )
      .run(now, now);
    sqlite
      .prepare(
        `INSERT INTO saas_tier_limits (id, tier_id, dimension_id, limit_value)
         VALUES ('l1','t1','d1',1000)`,
      )
      .run();
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO saas_tier_limits (id, tier_id, dimension_id, limit_value)
           VALUES ('l2','t1','d1',2000)`,
        )
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it("allows null limit_value on saas_tier_limits (= unlimited)", () => {
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO saas_usage_dimensions (id, product_id, dimension_key, display_name, created_at_ms)
         VALUES ('d2','p1','seats','Seats',?)`,
      )
      .run(now);
    sqlite
      .prepare(
        `INSERT INTO saas_tier_limits (id, tier_id, dimension_id, limit_value)
         VALUES ('l3','t1','d2',NULL)`,
      )
      .run();
    const row = sqlite
      .prepare("SELECT limit_value FROM saas_tier_limits WHERE id='l3'")
      .get() as { limit_value: number | null };
    expect(row.limit_value).toBeNull();
  });

  it("adds saas_product_id and saas_tier_id to deals", () => {
    const cols = columnNames("deals");
    expect(cols).toContain("saas_product_id");
    expect(cols).toContain("saas_tier_id");
    expect(cols).toContain("billing_cadence");
  });
});
