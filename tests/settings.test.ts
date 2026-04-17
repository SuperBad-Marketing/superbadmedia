import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { runSeeds } from "@/lib/db/migrate";
import { settings as settingsTable } from "@/lib/db/schema/settings";
import { SETTINGS_KEYS, type SettingsKey } from "@/lib/settings";

const TEST_DB = path.join(process.cwd(), "tests/.test-settings.db");

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite);
  const migrationsFolder = path.join(process.cwd(), "lib/db/migrations");
  drizzleMigrate(db, { migrationsFolder });
  runSeeds(sqlite, migrationsFolder);
});

afterAll(() => {
  sqlite.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const wal = `${TEST_DB}-wal`;
  const shm = `${TEST_DB}-shm`;
  if (fs.existsSync(wal)) fs.unlinkSync(wal);
  if (fs.existsSync(shm)) fs.unlinkSync(shm);
});

describe("settings registry + seed migration", () => {
  it("seeds every registered key exactly once", () => {
    const rows = sqlite
      .prepare("SELECT key FROM settings ORDER BY key")
      .all() as Array<{ key: string }>;
    const seeded = new Set(rows.map((r) => r.key));
    expect(seeded.size).toBe(rows.length);
    expect(seeded.size).toBe(SETTINGS_KEYS.length);
    for (const key of SETTINGS_KEYS) {
      expect(seeded.has(key)).toBe(true);
    }
  });

  it("seeds 123 keys total (118 pre-CE-1 + 5 CE-1 content engine keys)", () => {
    const count = sqlite
      .prepare("SELECT count(*) AS n FROM settings")
      .get() as { n: number };
    expect(count.n).toBe(123);
  });

  it("stores portal.magic_link_ttl_hours = 168", () => {
    const row = db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "portal.magic_link_ttl_hours"))
      .all()[0];
    expect(row.value).toBe("168");
  });

  it("stores email.quiet_window_start_hour = 8", () => {
    const row = db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "email.quiet_window_start_hour"))
      .all()[0];
    expect(row.value).toBe("8");
  });

  it("stores alerts.anthropic_daily_cap_aud = 25.00", () => {
    const row = db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "alerts.anthropic_daily_cap_aud"))
      .all()[0];
    expect(Number(row.value)).toBe(25.0);
  });

  it("is idempotent — re-running seeds does not duplicate", () => {
    const migrationsFolder = path.join(process.cwd(), "lib/db/migrations");
    runSeeds(sqlite, migrationsFolder);
    const count = sqlite
      .prepare("SELECT count(*) AS n FROM settings")
      .get() as { n: number };
    expect(count.n).toBe(123);
  });

  it("every SETTINGS_KEYS entry is a string matching the feature.rule shape", () => {
    for (const key of SETTINGS_KEYS as SettingsKey[]) {
      expect(typeof key).toBe("string");
      expect(key).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
    }
  });
});
