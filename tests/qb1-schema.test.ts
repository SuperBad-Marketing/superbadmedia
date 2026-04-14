import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";

const TEST_DB = path.join(process.cwd(), "tests/.test-qb1-schema.db");
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

describe("QB-1 — migration 0016 schema", () => {
  it("creates the four new tables", () => {
    const names = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as { name: string }[];
    const set = new Set(names.map((r) => r.name));
    expect(set.has("quotes")).toBe(true);
    expect(set.has("quote_templates")).toBe(true);
    expect(set.has("catalogue_items")).toBe(true);
    expect(set.has("sequences")).toBe(true);
  });

  it("adds gst_applicable + abn to companies with the right defaults", () => {
    const cols = sqlite
      .prepare("PRAGMA table_info(companies)")
      .all() as { name: string; dflt_value: unknown; notnull: number }[];
    const gst = cols.find((c) => c.name === "gst_applicable");
    const abn = cols.find((c) => c.name === "abn");
    expect(gst).toBeTruthy();
    expect(gst?.notnull).toBe(1);
    expect(String(gst?.dflt_value)).toBe("1");
    expect(abn).toBeTruthy();
    expect(abn?.notnull).toBe(0);
  });

  it("seeds all Quote Builder settings keys (QB-1 + QB-4b)", () => {
    const rows = sqlite
      .prepare(
        "SELECT key, value FROM settings WHERE key LIKE 'quote.%' ORDER BY key",
      )
      .all() as { key: string; value: string }[];
    expect(rows).toEqual([
      { key: "quote.default_expiry_days", value: "14" },
      { key: "quote.intro_paragraph_redraft_hourly_cap", value: "5" },
      { key: "quote.reminder_days", value: "3" },
      { key: "quote.setup_fee_monthly_saas", value: "0" },
    ]);
  });

  it("enforces UNIQUE on quotes.quote_number", () => {
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO companies (id, name, name_normalised, billing_mode, do_not_contact, trial_shoot_status, gst_applicable, first_seen_at_ms, created_at_ms, updated_at_ms)
         VALUES (?, ?, ?, 'stripe', 0, 'none', 1, ?, ?, ?)`,
      )
      .run("c1", "Co", "co", now, now, now);
    sqlite
      .prepare(
        `INSERT INTO deals (id, company_id, title, stage, value_estimated, pause_used_this_commitment, last_stage_change_at_ms, created_at_ms, updated_at_ms)
         VALUES (?, 'c1', 'Deal', 'lead', 1, 0, ?, ?, ?)`,
      )
      .run("d1", now, now, now);
    const insert = sqlite.prepare(
      `INSERT INTO quotes (id, deal_id, company_id, token, quote_number, structure, total_cents_inc_gst, buyout_percentage, created_at_ms)
       VALUES (?, 'd1', 'c1', ?, ?, 'project', 100000, 50, ?)`,
    );
    insert.run("q1", "t1", "SB-2026-0001", now);
    expect(() => insert.run("q2", "t2", "SB-2026-0001", now)).toThrow(
      /UNIQUE/,
    );
  });
});
