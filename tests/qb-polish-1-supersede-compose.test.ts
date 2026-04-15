import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(
  process.cwd(),
  "tests/.test-qb-polish-1-supersede-compose.db",
);
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { llm_calls_enabled: false },
}));

const { composeQuoteSendEmail } = await import(
  "@/lib/quote-builder/compose-send-email"
);
const { seedQbE2e, QB_E2E } = await import("@/scripts/seed-qb-e2e");
const { quotes } = await import("@/lib/db/schema/quotes");

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = OFF");
  testDb = drizzle(sqlite, { schema });
  drizzleMigrate(testDb, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
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

describe("QB-POLISH-1 — composeQuoteSendEmail supersede variant (fallback path)", () => {
  it("fallback paragraphs name the superseded quote number", async () => {
    await seedQbE2e(testDb);

    // Seed a draft fork that supersedes the original sent quote.
    const forkId = "fork-quote-1";
    await testDb.insert(quotes).values({
      id: forkId,
      deal_id: QB_E2E.dealId,
      company_id: QB_E2E.companyId,
      token: "forktoken0000000000000000000000",
      quote_number: "SB-2026-9002",
      status: "draft",
      structure: "project",
      content_json: {
        version: 1,
        sections: {
          whatYouToldUs: {
            prose: "Replaced scope — trimmer.",
            provenance: null,
            confidence: "high",
          },
          whatWellDo: {
            prose: "Trimmed project.",
            line_items: [
              {
                id: "fork-line-1",
                kind: "one_off",
                snapshot: {
                  catalogue_item_id: null,
                  name: "Trimmed deliverable",
                  category: "project",
                  unit: "project",
                  base_price_cents_inc_gst: 180_000,
                  tier_rank: null,
                },
                qty: 1,
                unit_price_cents_inc_gst: 180_000,
              },
            ],
          },
          terms: { template_id: null, overrides_prose: "" },
        },
        term_length_months: null,
        expiry_days: 14,
      },
      catalogue_snapshot_json: null,
      total_cents_inc_gst: 180_000,
      retainer_monthly_cents_inc_gst: null,
      one_off_cents_inc_gst: 180_000,
      term_length_months: null,
      buyout_percentage: 50,
      supersedes_quote_id: QB_E2E.quoteId,
      created_at_ms: Date.now(),
    });

    const composed = await composeQuoteSendEmail({ quote_id: forkId }, testDb);

    expect(composed.fallbackUsed).toBe(true);
    expect(composed.subject).toContain("updated quote");
    const joined = composed.bodyParagraphs.join("\n");
    expect(joined).toContain(QB_E2E.quoteNumber); // e.g. "SB-2026-9001"
    expect(joined.toLowerCase()).toContain("replaces");
  });

  it("non-supersede fresh send keeps the standard fallback copy", async () => {
    const composed = await composeQuoteSendEmail(
      { quote_id: QB_E2E.quoteId },
      testDb,
    );

    expect(composed.fallbackUsed).toBe(true);
    expect(composed.subject).toContain("quote ready");
    const joined = composed.bodyParagraphs.join("\n").toLowerCase();
    expect(joined).not.toContain("replaces");
  });
});
