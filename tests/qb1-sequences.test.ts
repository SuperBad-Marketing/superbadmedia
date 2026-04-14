import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";
import { allocateQuoteNumber } from "@/lib/quote-builder/sequences";

const TEST_DB = path.join(process.cwd(), "tests/.test-qb1-sequences.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

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

describe("QB-1 — allocateQuoteNumber", () => {
  it("allocates monotonic, padded numbers for a year", async () => {
    const a = await allocateQuoteNumber({ year: 2099, db: testDb });
    const b = await allocateQuoteNumber({ year: 2099, db: testDb });
    const c = await allocateQuoteNumber({ year: 2099, db: testDb });
    expect(a).toBe("SB-2099-0001");
    expect(b).toBe("SB-2099-0002");
    expect(c).toBe("SB-2099-0003");
  });

  it("isolates counters per year", async () => {
    const a = await allocateQuoteNumber({ year: 2100, db: testDb });
    const b = await allocateQuoteNumber({ year: 2101, db: testDb });
    expect(a).toBe("SB-2100-0001");
    expect(b).toBe("SB-2101-0001");
  });

  it("produces unique results under sequential concurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        allocateQuoteNumber({ year: 2200, db: testDb }),
      ),
    );
    expect(new Set(results).size).toBe(20);
    const nums = results
      .map((s) => Number(s.split("-").at(-1)))
      .sort((a, b) => a - b);
    expect(nums[0]).toBe(1);
    expect(nums[nums.length - 1]).toBe(20);
  });
});
