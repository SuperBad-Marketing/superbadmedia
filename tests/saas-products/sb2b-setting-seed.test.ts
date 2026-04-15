/**
 * SB-2b — migration 0022 seeds the setup-fee setting row with default 0.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";

const TEST_DB = path.join(process.cwd(), "tests/.test-sb2b-seed.db");
let sqlite: Database.Database;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const testDb = drizzle(sqlite);
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

describe("settings seed — billing.saas.monthly_setup_fee_cents", () => {
  it("writes the row with default 0 / integer type", () => {
    const row = sqlite
      .prepare(
        "SELECT key, value, type FROM settings WHERE key = 'billing.saas.monthly_setup_fee_cents'",
      )
      .get() as { key: string; value: string; type: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.value).toBe("0");
    expect(row!.type).toBe("integer");
  });
});
