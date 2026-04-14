import fs from "node:fs";
import path from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

// Mock settings so createDraftQuote doesn't touch the global dev.db.
vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "quote.default_expiry_days") return 14;
      throw new Error(`Unexpected settings key in test: ${key}`);
    }),
  },
}));

const {
  createDraftQuote,
  findOpenDraftForDeal,
  updateDraftQuote,
  QuoteNotDraftError,
} = await import("@/lib/quote-builder/draft");
const { quotes } = await import("@/lib/db/schema/quotes");
const { companies } = await import("@/lib/db/schema/companies");
const { deals } = await import("@/lib/db/schema/deals");
const { emptyQuoteContent } = await import("@/lib/quote-builder/content-shape");
const { user } = await import("@/lib/db/schema/user");

const TEST_DB = path.join(process.cwd(), "tests/.test-qb2a-draft.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite);
  drizzleMigrate(db, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });

  const now = Date.now();
  db.insert(user)
    .values({
      id: "u-1",
      email: "a@example.com",
      role: "admin",
      created_at_ms: now,
      updated_at_ms: now,
    })
    .run();
  db.insert(user)
    .values({
      id: "u-2",
      email: "b@example.com",
      role: "admin",
      created_at_ms: now,
      updated_at_ms: now,
    })
    .run();
  db.insert(companies)
    .values({
      id: "co-1",
      name: "Acme",
      name_normalised: "acme",
      first_seen_at_ms: now,
      created_at_ms: now,
      updated_at_ms: now,
    })
    .run();
  db.insert(deals)
    .values({
      id: "deal-1",
      company_id: "co-1",
      title: "Acme retainer",
      stage: "quoted",
      last_stage_change_at_ms: now,
      created_at_ms: now,
      updated_at_ms: now,
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

describe("QB-2a — createDraftQuote", () => {
  it("creates a draft row with an allocated SB-YYYY-NNNN number", async () => {
    const quote = await createDraftQuote(
      { deal_id: "deal-1", company_id: "co-1", user_id: "u-1" },
      db,
    );
    expect(quote.status).toBe("draft");
    expect(quote.quote_number).toMatch(/^SB-\d{4}-\d{4}$/);
    expect(quote.deal_id).toBe("deal-1");
    expect(quote.total_cents_inc_gst).toBe(0);
    expect(quote.structure).toBe("project");
    expect(quote.token).toBeTruthy();
    expect(quote.last_edited_by_user_id).toBe("u-1");
  });

  it("is idempotent when an open draft already exists on the deal", async () => {
    const a = await findOpenDraftForDeal("deal-1", db);
    expect(a).not.toBeNull();
    const b = await createDraftQuote(
      { deal_id: "deal-1", company_id: "co-1", user_id: "u-1" },
      db,
    );
    expect(b.id).toBe(a!.id);
  });
});

describe("QB-2a — updateDraftQuote", () => {
  it("recomputes totals + structure from content", async () => {
    const draft = await findOpenDraftForDeal("deal-1", db);
    const content = emptyQuoteContent(14);
    content.sections.whatWellDo.line_items.push(
      {
        id: "li-1",
        kind: "retainer",
        snapshot: {
          catalogue_item_id: null,
          name: "Social retainer",
          category: "retainer",
          unit: "month",
          base_price_cents_inc_gst: 350000,
          tier_rank: 2,
        },
        qty: 1,
        unit_price_cents_inc_gst: 350000,
      },
      {
        id: "li-2",
        kind: "one_off",
        snapshot: {
          catalogue_item_id: null,
          name: "Brand DNA workshop",
          category: "strategy",
          unit: "project",
          base_price_cents_inc_gst: 150000,
          tier_rank: null,
        },
        qty: 1,
        unit_price_cents_inc_gst: 150000,
      },
    );
    content.term_length_months = 6;

    const row = await updateDraftQuote(
      { quote_id: draft!.id, content, user_id: "u-2" },
      db,
    );
    expect(row.structure).toBe("mixed");
    expect(row.retainer_monthly_cents_inc_gst).toBe(350000);
    expect(row.one_off_cents_inc_gst).toBe(150000);
    expect(row.total_cents_inc_gst).toBe(500000);
    expect(row.term_length_months).toBe(6);
    expect(row.last_edited_by_user_id).toBe("u-2");
  });

  it("rejects edits on non-draft rows", async () => {
    const draft = await findOpenDraftForDeal("deal-1", db);
    // Flip status directly in the DB (we're simulating a sent quote).
    db.update(quotes)
      .set({ status: "sent", sent_at_ms: Date.now() })
      .where(eq(quotes.id, draft!.id))
      .run();

    await expect(
      updateDraftQuote(
        {
          quote_id: draft!.id,
          content: emptyQuoteContent(14),
          user_id: "u-1",
        },
        db,
      ),
    ).rejects.toBeInstanceOf(QuoteNotDraftError);
  });
});
