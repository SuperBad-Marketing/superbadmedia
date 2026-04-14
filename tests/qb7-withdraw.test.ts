import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(process.cwd(), "tests/.test-qb7-withdraw.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const { withdrawQuote } = await import("@/lib/quote-builder/withdraw");
const { quotes } = await import("@/lib/db/schema/quotes");
const { companies } = await import("@/lib/db/schema/companies");
const { deals } = await import("@/lib/db/schema/deals");
const { activity_log } = await import("@/lib/db/schema/activity-log");
const { scheduled_tasks } = await import("@/lib/db/schema/scheduled-tasks");

const NOW = 1_700_000_000_000;

function seedQuote(
  id: string,
  status: "draft" | "sent" | "viewed" | "accepted" | "withdrawn" = "sent",
) {
  testDb
    .insert(quotes)
    .values({
      id,
      deal_id: "deal-1",
      company_id: "co-1",
      token: `tok-${id}`,
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
      sent_at_ms: status === "draft" ? null : NOW,
    })
    .run();
}

function seedPendingTask(
  id: string,
  task_type:
    | "quote_reminder_3d"
    | "quote_expire"
    | "quote_pdf_render"
    | "quote_email_send",
  quoteId: string,
  suffix?: string,
) {
  const key = suffix
    ? `${task_type}:${quoteId}:${suffix}`
    : `${task_type}:${quoteId}`;
  testDb
    .insert(scheduled_tasks)
    .values({
      id,
      task_type,
      run_at_ms: NOW + 86400_000,
      payload: { quote_id: quoteId },
      status: "pending",
      attempts: 0,
      idempotency_key: key,
      created_at_ms: NOW,
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
  testDb.delete(activity_log).run();
  testDb.delete(scheduled_tasks).run();
  testDb.delete(quotes).run();
});

describe("QB-7 — withdrawQuote", () => {
  it("transitions sent → withdrawn + stamps withdrawn_at_ms", async () => {
    seedQuote("q-1", "sent");
    const result = await withdrawQuote({
      quote_id: "q-1",
      reason: "client ghosted",
      by_user_id: "u-1",
    });
    expect(result.ok).toBe(true);
    const row = testDb.select().from(quotes).where(eq(quotes.id, "q-1")).get();
    expect(row.status).toBe("withdrawn");
    expect(row.withdrawn_at_ms).toBeTypeOf("number");
  });

  it("transitions draft → withdrawn", async () => {
    seedQuote("q-1", "draft");
    const result = await withdrawQuote({ quote_id: "q-1" });
    expect(result.ok).toBe(true);
    const row = testDb.select().from(quotes).where(eq(quotes.id, "q-1")).get();
    expect(row.status).toBe("withdrawn");
  });

  it("transitions viewed → withdrawn", async () => {
    seedQuote("q-1", "viewed");
    const result = await withdrawQuote({ quote_id: "q-1" });
    expect(result.ok).toBe(true);
    const row = testDb.select().from(quotes).where(eq(quotes.id, "q-1")).get();
    expect(row.status).toBe("withdrawn");
  });

  it("flips pending scheduled_tasks for the quote to skipped", async () => {
    seedQuote("q-1", "sent");
    seedPendingTask("t-1", "quote_reminder_3d", "q-1");
    seedPendingTask("t-2", "quote_expire", "q-1");
    seedPendingTask("t-3", "quote_email_send", "q-1");
    // Unrelated quote's pending task — must NOT be touched.
    seedQuote("q-2", "sent");
    seedPendingTask("t-4", "quote_reminder_3d", "q-2");

    await withdrawQuote({ quote_id: "q-1" });

    const task1 = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, "t-1"))
      .get();
    const task2 = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, "t-2"))
      .get();
    const task3 = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, "t-3"))
      .get();
    const task4 = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, "t-4"))
      .get();

    expect(task1.status).toBe("skipped");
    expect(task2.status).toBe("skipped");
    expect(task3.status).toBe("skipped");
    expect(task4.status).toBe("pending");
  });

  it("refuses to withdraw a terminal state (accepted)", async () => {
    seedQuote("q-1", "accepted");
    const result = await withdrawQuote({ quote_id: "q-1" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/illegal_transition/);
    const row = testDb.select().from(quotes).where(eq(quotes.id, "q-1")).get();
    expect(row.status).toBe("accepted");
  });

  it("refuses to re-withdraw an already withdrawn quote", async () => {
    seedQuote("q-1", "withdrawn");
    const result = await withdrawQuote({ quote_id: "q-1" });
    expect(result.ok).toBe(false);
  });

  it("returns quote_not_found for missing id", async () => {
    const result = await withdrawQuote({ quote_id: "missing" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("quote_not_found");
  });

  it("logs quote_withdrawn activity with prior_status + reason", async () => {
    seedQuote("q-1", "sent");
    await withdrawQuote({ quote_id: "q-1", reason: "budget pulled" });
    const logs = testDb.select().from(activity_log).all();
    expect(logs).toHaveLength(1);
    expect(logs[0].kind).toBe("quote_withdrawn");
    expect(logs[0].meta.prior_status).toBe("sent");
    expect(logs[0].meta.reason).toBe("budget pulled");
  });
});
