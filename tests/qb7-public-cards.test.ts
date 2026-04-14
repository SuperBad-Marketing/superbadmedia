import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(process.cwd(), "tests/.test-qb7-public-cards.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const { loadPublicQuoteByToken } = await import(
  "@/lib/quote-builder/load-public-quote"
);
const { quotes } = await import("@/lib/db/schema/quotes");
const { companies } = await import("@/lib/db/schema/companies");
const { deals } = await import("@/lib/db/schema/deals");

const NOW = 1_700_000_000_000;

function seedQuote(
  id: string,
  token: string,
  status: string,
  overrides: Record<string, unknown> = {},
) {
  testDb
    .insert(quotes)
    .values({
      id,
      deal_id: "deal-1",
      company_id: "co-1",
      token,
      quote_number: `SB-2026-${id}`,
      status,
      structure: "project",
      content_json: null,
      catalogue_snapshot_json: null,
      total_cents_inc_gst: 100000,
      retainer_monthly_cents_inc_gst: null,
      one_off_cents_inc_gst: 100000,
      term_length_months: null,
      buyout_percentage: 50,
      created_at_ms: NOW,
      sent_at_ms: NOW,
      ...overrides,
    })
    .run();
}

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite, { schema });
  drizzleMigrate(testDb, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
  testDb
    .insert(companies)
    .values({
      id: "co-1",
      name: "Acme",
      name_normalised: "acme",
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  testDb
    .insert(deals)
    .values({
      id: "deal-1",
      company_id: "co-1",
      title: "Acme",
      stage: "quoted",
      last_stage_change_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

beforeEach(() => {
  testDb.delete(quotes).run();
});

describe("QB-7 — public quote URL status routing", () => {
  it("returns a bundle for sent / viewed quotes", async () => {
    seedQuote("q-1", "tok-live", "sent");
    const bundle = await loadPublicQuoteByToken("tok-live");
    expect(bundle).toBeTruthy();
    expect(bundle!.quote.status).toBe("sent");
    expect(bundle!.supersededByToken).toBeNull();
  });

  it("returns the bundle for expired / withdrawn statuses (page renders cards)", async () => {
    seedQuote("q-1", "tok-expired", "expired", {
      expired_at_ms: NOW + 86400_000,
    });
    const expired = await loadPublicQuoteByToken("tok-expired");
    expect(expired!.quote.status).toBe("expired");

    seedQuote("q-2", "tok-wd", "withdrawn", { withdrawn_at_ms: NOW });
    const withdrawn = await loadPublicQuoteByToken("tok-wd");
    expect(withdrawn!.quote.status).toBe("withdrawn");
  });

  it("returns the superseder's token for a superseded quote", async () => {
    seedQuote("q-new", "tok-new", "sent");
    seedQuote("q-old", "tok-old", "superseded", {
      superseded_at_ms: NOW,
      superseded_by_quote_id: "q-new",
    });
    const bundle = await loadPublicQuoteByToken("tok-old");
    expect(bundle!.quote.status).toBe("superseded");
    expect(bundle!.supersededByToken).toBe("tok-new");
  });

  it("returns null for drafts (no public URL yet)", async () => {
    seedQuote("q-1", "tok-draft", "draft", { sent_at_ms: null });
    const bundle = await loadPublicQuoteByToken("tok-draft");
    expect(bundle).toBeNull();
  });

  it("returns null for unknown tokens", async () => {
    const bundle = await loadPublicQuoteByToken("nope");
    expect(bundle).toBeNull();
  });
});
