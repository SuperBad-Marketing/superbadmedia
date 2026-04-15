import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(
  process.cwd(),
  "tests/.test-qb-polish-1-manual-settled.db",
);
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const { acceptQuote } = await import("@/lib/quote-builder/accept");
const { seedQbE2e, QB_E2E } = await import("@/scripts/seed-qb-e2e");
const { activity_log } = await import("@/lib/db/schema/activity-log");

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  // FK off — seedQbE2e references an `e2e-admin-user` id that the
  // Playwright globalSetup seeds; this hermetic unit test skips that
  // dependency chain. FK coverage lives in qb-e2e.spec.ts.
  sqlite.pragma("foreign_keys = OFF");
  testDb = drizzle(sqlite, { schema });
  drizzleMigrate(testDb, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
  // Apply seed-only migrations the migrator skips (see bi-e2e infra note).
  const migDir = path.join(process.cwd(), "lib/db/migrations");
  const journalPath = path.join(migDir, "meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: { tag: string }[];
  };
  const applied = new Set(journal.entries.map((e) => e.tag));
  for (const file of fs.readdirSync(migDir).sort()) {
    if (!file.endsWith(".sql")) continue;
    const tag = file.replace(/\.sql$/, "");
    if (applied.has(tag)) continue;
    const sql = fs.readFileSync(path.join(migDir, file), "utf8");
    sqlite.exec(sql);
  }
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe("QB-POLISH-1 — manual-mode acceptQuote logs quote_settled", () => {
  it("writes a quote_settled activity row with paidVia=manual", async () => {
    await seedQbE2e(testDb);

    const result = await acceptQuote(
      {
        quote_id: QB_E2E.quoteId,
        ip: "127.0.0.1",
        userAgent: "vitest",
      },
      testDb,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paymentMode).toBe("manual");

    const settled = testDb
      .select()
      .from(activity_log)
      .where(eq(activity_log.kind, "quote_settled"))
      .all();

    expect(settled).toHaveLength(1);
    const row = settled[0];
    expect(row.company_id).toBe(QB_E2E.companyId);
    expect(row.deal_id).toBe(QB_E2E.dealId);
    expect(row.meta).toMatchObject({
      quote_id: QB_E2E.quoteId,
      paidVia: "manual",
      amount_total: 250_000,
    });
  });
});
