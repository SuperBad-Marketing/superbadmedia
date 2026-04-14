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

vi.mock("@/lib/auth/session", () => ({ auth: authMock }));

let testDb: ReturnType<typeof drizzle>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-three-wons-egg.db");
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

beforeEach(async () => {
  // Reset cooldown stamp between cases + clear in-memory settings cache.
  sqlite
    .prepare(
      "UPDATE settings SET value = '0' WHERE key = 'pipeline.sd_three_wons_last_fired_ms'",
    )
    .run();
  const settings = await import("@/lib/settings");
  settings.default.invalidateCache();
  authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
});

describe("maybeFireThreeWonsEgg", () => {
  it("fires and stamps the cooldown on a fresh admin call", async () => {
    const { maybeFireThreeWonsEgg } = await import(
      "@/app/lite/admin/pipeline/three-wons-egg"
    );
    const fired = await maybeFireThreeWonsEgg();
    expect(fired).toBe(true);

    const row = sqlite
      .prepare(
        "SELECT value FROM settings WHERE key = 'pipeline.sd_three_wons_last_fired_ms'",
      )
      .get() as { value: string };
    expect(Number(row.value)).toBeGreaterThan(0);
  });

  it("does not re-fire within the 30-day cooldown", async () => {
    const { maybeFireThreeWonsEgg } = await import(
      "@/app/lite/admin/pipeline/three-wons-egg"
    );
    const first = await maybeFireThreeWonsEgg();
    expect(first).toBe(true);
    const second = await maybeFireThreeWonsEgg();
    expect(second).toBe(false);
  });

  it("fires again once the cooldown has elapsed", async () => {
    const { maybeFireThreeWonsEgg } = await import(
      "@/app/lite/admin/pipeline/three-wons-egg"
    );
    const longAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    sqlite
      .prepare(
        "UPDATE settings SET value = ? WHERE key = 'pipeline.sd_three_wons_last_fired_ms'",
      )
      .run(String(longAgo));
    const settings = await import("@/lib/settings");
    settings.default.invalidateCache();

    const fired = await maybeFireThreeWonsEgg();
    expect(fired).toBe(true);
  });

  it("refuses for non-admin sessions", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: "client-1", role: "client" },
    });
    const { maybeFireThreeWonsEgg } = await import(
      "@/app/lite/admin/pipeline/three-wons-egg"
    );
    const fired = await maybeFireThreeWonsEgg();
    expect(fired).toBe(false);

    const row = sqlite
      .prepare(
        "SELECT value FROM settings WHERE key = 'pipeline.sd_three_wons_last_fired_ms'",
      )
      .get() as { value: string };
    expect(Number(row.value)).toBe(0);
  });

  it("refuses when unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null);
    const { maybeFireThreeWonsEgg } = await import(
      "@/app/lite/admin/pipeline/three-wons-egg"
    );
    const fired = await maybeFireThreeWonsEgg();
    expect(fired).toBe(false);
  });
});
