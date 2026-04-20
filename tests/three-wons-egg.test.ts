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

function ensureUser(id: string, role = "admin") {
  const existing = sqlite
    .prepare("SELECT id FROM user WHERE id = ?")
    .get(id);
  if (!existing) {
    sqlite
      .prepare(
        `INSERT INTO user (id, email, role, name, theme_preset, density_preference, typeface_preset, hidden_egg_tricks_enabled, created_at_ms) VALUES (?, ?, ?, ?, 'standard', 'comfortable', 'house', 1, ?)`,
      )
      .run(id, `${id}@test.com`, role, id, Date.now());
  }
}

beforeEach(async () => {
  sqlite.prepare("DELETE FROM hidden_egg_fires").run();
  ensureUser("admin-1");
  authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
});

describe("maybeFireThreeWonsEgg (migrated to hidden_egg_fires)", () => {
  it("fires and writes a row to hidden_egg_fires", async () => {
    const { maybeFireThreeWonsEgg } = await import(
      "@/app/lite/admin/pipeline/three-wons-egg"
    );
    const fired = await maybeFireThreeWonsEgg();
    expect(fired).toBe(true);

    const row = sqlite
      .prepare("SELECT * FROM hidden_egg_fires WHERE egg_id = 'three_wons'")
      .get() as { egg_id: string; actor_type: string; user_id: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.actor_type).toBe("admin");
    expect(row!.user_id).toBe("admin-1");
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
        `INSERT INTO hidden_egg_fires (id, egg_id, actor_type, user_id, fired_at_ms, trigger_evidence) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("hef-old", "three_wons", "admin", "admin-1", longAgo, JSON.stringify({ reason: "test" }));

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

    const rows = sqlite
      .prepare("SELECT * FROM hidden_egg_fires WHERE egg_id = 'three_wons'")
      .all();
    expect(rows.length).toBe(0);
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
