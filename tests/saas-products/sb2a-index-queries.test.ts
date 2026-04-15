/**
 * SB-2a — index query helpers (`listSaasProducts`,
 * `getSaasProductSummaryCounts`, `findSaasProductBySlug`).
 *
 * Hermetic sqlite, no auth involved (queries are server-only but
 * impartial — the admin-gate lives on the page).
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

const TEST_DB = path.join(process.cwd(), "tests/.test-sb2a-index.db");
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
  sqlite.prepare("DELETE FROM saas_tiers").run();
  sqlite.prepare("DELETE FROM saas_usage_dimensions").run();
  sqlite.prepare("DELETE FROM saas_products").run();
});

function seedProduct(row: {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "archived";
  display_order?: number;
}) {
  sqlite
    .prepare(
      `INSERT INTO saas_products (id, name, description, slug, status, demo_enabled, display_order, created_at_ms, updated_at_ms)
       VALUES (?, ?, NULL, ?, ?, 0, ?, ?, ?)`,
    )
    .run(
      row.id,
      row.name,
      row.slug,
      row.status,
      row.display_order ?? 0,
      NOW,
      NOW,
    );
}

function seedTier(productId: string, id: string, rank: number) {
  sqlite
    .prepare(
      `INSERT INTO saas_tiers (id, product_id, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(id, productId, `Tier ${rank}`, rank, 4900, NOW, NOW);
}

describe("SB-2a index queries", () => {
  it("listSaasProducts returns both draft and active rows with tier counts", async () => {
    seedProduct({
      id: "p_draft",
      name: "Draft Product",
      slug: "draft-product",
      status: "draft",
      display_order: 0,
    });
    seedProduct({
      id: "p_active",
      name: "Active Product",
      slug: "active-product",
      status: "active",
      display_order: 1,
    });
    seedTier("p_active", "t_1", 1);
    seedTier("p_active", "t_2", 2);

    const { listSaasProducts } = await import("@/lib/saas-products/queries");
    const rows = await listSaasProducts();
    expect(rows).toHaveLength(2);
    const byId = new Map(rows.map((r) => [r.row.id, r]));
    expect(byId.get("p_draft")!.tierCount).toBe(0);
    expect(byId.get("p_active")!.tierCount).toBe(2);
    for (const r of rows) {
      expect(r.subscriberCount).toBe(0);
      expect(r.mrrCents).toBe(0);
    }
  });

  // SB-10 replaced the `getSaasProductSummaryCounts` stub with
  // `getSaasHeadlineSignals` (tests/saas-products/sb10-headline-signals.test.ts).

it("findSaasProductBySlug resolves hits and misses", async () => {
    seedProduct({
      id: "p_hit",
      name: "Hit",
      slug: "hit-slug",
      status: "draft",
    });
    const { findSaasProductBySlug } = await import(
      "@/lib/saas-products/queries"
    );
    const hit = await findSaasProductBySlug("hit-slug");
    expect(hit?.id).toBe("p_hit");
    const miss = await findSaasProductBySlug("nope");
    expect(miss).toBeNull();
  });
});
