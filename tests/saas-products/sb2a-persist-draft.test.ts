/**
 * SB-2a — `persistSaasProductDraftAction` transactional behaviour.
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

const authMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ user: { id: "admin-1", role: "admin" } }),
);
vi.mock("@/lib/auth/auth", () => ({ auth: authMock }));
vi.mock("@/lib/auth/session", () => ({ auth: authMock }));

let testDb: ReturnType<typeof drizzle>;
vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-sb2a-persist.db");
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
  sqlite.prepare("DELETE FROM activity_log").run();
  sqlite.prepare("DELETE FROM saas_usage_dimensions").run();
  sqlite.prepare("DELETE FROM saas_products").run();
  authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
});

async function callAction(input: {
  name: string;
  description: string | null;
  slug: string;
  dimensions: Array<{ key: string; displayName: string }>;
}) {
  const { persistSaasProductDraftAction } = await import(
    "@/app/lite/setup/admin/[key]/actions-saas-product"
  );
  return persistSaasProductDraftAction(input);
}

describe("persistSaasProductDraftAction", () => {
  it("writes product + dimensions + activity_log row on clean input", async () => {
    const result = await callAction({
      name: "Popcorn Pro",
      description: "The corn that pops.",
      slug: "popcorn-pro",
      dimensions: [
        { key: "api_calls", displayName: "API calls" },
        { key: "active_campaigns", displayName: "Active campaigns" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const product = sqlite
      .prepare("SELECT * FROM saas_products WHERE id = ?")
      .get(result.productId) as { name: string; status: string; slug: string };
    expect(product.name).toBe("Popcorn Pro");
    expect(product.status).toBe("draft");
    expect(product.slug).toBe("popcorn-pro");

    const dims = sqlite
      .prepare(
        "SELECT dimension_key, display_name, display_order FROM saas_usage_dimensions WHERE product_id = ? ORDER BY display_order",
      )
      .all(result.productId) as Array<{
      dimension_key: string;
      display_name: string;
      display_order: number;
    }>;
    expect(dims).toHaveLength(2);
    expect(dims[0].dimension_key).toBe("api_calls");
    expect(dims[1].dimension_key).toBe("active_campaigns");

    const act = sqlite
      .prepare(
        "SELECT kind, body, created_by FROM activity_log WHERE kind = 'saas_product_created'",
      )
      .get() as { kind: string; body: string; created_by: string };
    expect(act.kind).toBe("saas_product_created");
    expect(act.created_by).toBe("admin-1");
    expect(act.body).toContain("Popcorn Pro");
  });

  it("rejects a duplicate slug", async () => {
    await callAction({
      name: "First",
      description: null,
      slug: "same-slug",
      dimensions: [{ key: "calls", displayName: "Calls" }],
    });
    const second = await callAction({
      name: "Second",
      description: null,
      slug: "same-slug",
      dimensions: [{ key: "calls", displayName: "Calls" }],
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toMatch(/already in use/i);
  });

  it("rejects more than 3 dimensions", async () => {
    const r = await callAction({
      name: "Too Many",
      description: null,
      slug: "too-many",
      dimensions: [
        { key: "a", displayName: "A" },
        { key: "b", displayName: "B" },
        { key: "c", displayName: "C" },
        { key: "d", displayName: "D" },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects duplicate dimension keys", async () => {
    const r = await callAction({
      name: "Dup Dims",
      description: null,
      slug: "dup-dims",
      dimensions: [
        { key: "same", displayName: "One" },
        { key: "same", displayName: "Two" },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("refuses a non-admin session", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: "client-1", role: "client" },
    });
    const r = await callAction({
      name: "Denied",
      description: null,
      slug: "denied",
      dimensions: [{ key: "calls", displayName: "Calls" }],
    });
    expect(r.ok).toBe(false);
  });
});
