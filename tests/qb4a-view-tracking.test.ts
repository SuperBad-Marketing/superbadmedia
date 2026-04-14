import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(process.cwd(), "tests/.test-qb4a-view-tracking.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const { markQuoteViewed } = await import("@/lib/quote-builder/view-tracking");
const { quotes } = await import("@/lib/db/schema/quotes");
const { companies } = await import("@/lib/db/schema/companies");
const { deals } = await import("@/lib/db/schema/deals");
const { activity_log } = await import("@/lib/db/schema/activity-log");
const { scheduled_tasks } = await import("@/lib/db/schema/scheduled-tasks");

const NOW = 1_700_000_000_000;

function seedQuote(status: "sent" | "viewed" | "accepted" = "sent") {
  testDb
    .insert(quotes)
    .values({
      id: "q-1",
      deal_id: "deal-1",
      company_id: "co-1",
      token: "tok-1",
      quote_number: "SB-2026-0001",
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

async function reset() {
  testDb.delete(activity_log).run();
  testDb.delete(scheduled_tasks).run();
  testDb.delete(quotes).run();
}

describe("QB-4a — markQuoteViewed", () => {
  it("flips sent → viewed and stamps viewed_at_ms", async () => {
    await reset();
    seedQuote("sent");

    await markQuoteViewed({
      id: "q-1",
      status: "sent",
      company_id: "co-1",
      deal_id: "deal-1",
    });

    const row = testDb.select().from(quotes).where(eq(quotes.id, "q-1")).get();
    expect(row.status).toBe("viewed");
    expect(row.viewed_at_ms).toBeTypeOf("number");
  });

  it("logs a quote_viewed activity row scoped to the company + deal", async () => {
    await reset();
    seedQuote("sent");

    await markQuoteViewed({
      id: "q-1",
      status: "sent",
      company_id: "co-1",
      deal_id: "deal-1",
    });

    const rows = testDb.select().from(activity_log).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("quote_viewed");
    expect(rows[0].company_id).toBe("co-1");
    expect(rows[0].deal_id).toBe("deal-1");
  });

  it("flips a pending quote_reminder_3d row to skipped", async () => {
    await reset();
    seedQuote("sent");
    testDb
      .insert(scheduled_tasks)
      .values({
        id: "t-1",
        task_type: "quote_reminder_3d",
        run_at_ms: NOW + 86_400_000 * 3,
        payload: { quote_id: "q-1" },
        status: "pending",
        attempts: 0,
        idempotency_key: "quote_reminder_3d:q-1",
        created_at_ms: NOW,
      })
      .run();

    await markQuoteViewed({
      id: "q-1",
      status: "sent",
      company_id: "co-1",
      deal_id: "deal-1",
    });

    const task = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, "t-1"))
      .get();
    expect(task.status).toBe("skipped");
    expect(task.done_at_ms).toBeTypeOf("number");
  });

  it("is idempotent — second call on a viewed row is a no-op", async () => {
    await reset();
    seedQuote("viewed");

    await markQuoteViewed({
      id: "q-1",
      status: "viewed",
      company_id: "co-1",
      deal_id: "deal-1",
    });

    const rows = testDb.select().from(activity_log).all();
    expect(rows).toHaveLength(0);
  });

  it("does not log when called with status accepted (defensive)", async () => {
    await reset();
    seedQuote("accepted");

    await markQuoteViewed({
      id: "q-1",
      status: "accepted",
      company_id: "co-1",
      deal_id: "deal-1",
    });

    const rows = testDb.select().from(activity_log).all();
    expect(rows).toHaveLength(0);
  });
});
