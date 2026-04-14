import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(process.cwd(), "tests/.test-qb8-early-cancel.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const {
  beginEarlyCancelIntent,
  abandonEarlyCancelIntent,
  finaliseEarlyCancelPaidRemainder,
  finaliseEarlyCancelBuyout,
} = await import("@/lib/subscription/early-cancel");
const { companies } = await import("@/lib/db/schema/companies");
const { deals } = await import("@/lib/db/schema/deals");
const { activity_log } = await import("@/lib/db/schema/activity-log");
const { scheduled_tasks } = await import("@/lib/db/schema/scheduled-tasks");

const NOW = 1_700_000_000_000;

function seedDeal(
  id: string,
  subscription_state:
    | "active"
    | "pending_early_exit"
    | "cancelled_paid_remainder"
    | "cancelled_buyout"
    | null = "active",
) {
  testDb
    .insert(deals)
    .values({
      id,
      company_id: "co-1",
      title: `Deal ${id}`,
      stage: "won",
      subscription_state,
      billing_cadence: "monthly",
      committed_until_date_ms: NOW + 3 * 30 * 24 * 60 * 60 * 1000,
      last_stage_change_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
}

function seedPendingTask(
  id: string,
  task_type:
    | "subscription_pause_resume"
    | "subscription_pause_resume_reminder",
  dealId: string,
  suffix?: string,
) {
  const key = suffix
    ? `${task_type}:${dealId}:${suffix}`
    : `${task_type}:${dealId}`;
  testDb
    .insert(scheduled_tasks)
    .values({
      id,
      task_type,
      run_at_ms: NOW + 86400_000,
      payload: { deal_id: dealId },
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
  testDb.delete(deals).run();
});

describe("QB-8 — beginEarlyCancelIntent", () => {
  it("flips active → pending_early_exit", async () => {
    seedDeal("d-1", "active");
    const result = await beginEarlyCancelIntent({ deal_id: "d-1" });
    expect(result.ok).toBe(true);
    expect(result.deal?.subscription_state).toBe("pending_early_exit");
  });

  it("refuses when deal is not in active", async () => {
    seedDeal("d-1", "pending_early_exit");
    const result = await beginEarlyCancelIntent({ deal_id: "d-1" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/illegal_transition/);
  });

  it("returns deal_not_found for missing id", async () => {
    const result = await beginEarlyCancelIntent({ deal_id: "missing" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("deal_not_found");
  });

  it("does not log activity on begin (state flip only)", async () => {
    seedDeal("d-1", "active");
    await beginEarlyCancelIntent({ deal_id: "d-1" });
    const logs = testDb.select().from(activity_log).all();
    expect(logs).toHaveLength(0);
  });
});

describe("QB-8 — abandonEarlyCancelIntent", () => {
  it("flips pending_early_exit → active", async () => {
    seedDeal("d-1", "pending_early_exit");
    const result = await abandonEarlyCancelIntent({ deal_id: "d-1" });
    expect(result.ok).toBe(true);
    expect(result.deal?.subscription_state).toBe("active");
  });

  it("refuses if deal is already active", async () => {
    seedDeal("d-1", "active");
    const result = await abandonEarlyCancelIntent({ deal_id: "d-1" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/illegal_transition/);
  });
});

describe("QB-8 — finaliseEarlyCancelPaidRemainder", () => {
  it("flips pending_early_exit → cancelled_paid_remainder + logs + cancels tasks", async () => {
    seedDeal("d-1", "pending_early_exit");
    seedPendingTask("t-1", "subscription_pause_resume", "d-1");
    seedPendingTask("t-2", "subscription_pause_resume_reminder", "d-1", "42");
    // Unrelated deal's pending task — must not be touched.
    seedDeal("d-2", "pending_early_exit");
    seedPendingTask("t-3", "subscription_pause_resume", "d-2");

    const result = await finaliseEarlyCancelPaidRemainder({
      deal_id: "d-1",
      by_user_id: "u-1",
    });
    expect(result.ok).toBe(true);
    expect(result.deal?.subscription_state).toBe("cancelled_paid_remainder");

    const logs = testDb.select().from(activity_log).all();
    expect(logs).toHaveLength(1);
    expect(logs[0].kind).toBe("subscription_early_cancel_paid_remainder");
    expect(logs[0].meta.deal_id).toBe("d-1");

    const t1 = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, "t-1"))
      .get();
    const t2 = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, "t-2"))
      .get();
    const t3 = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, "t-3"))
      .get();
    expect(t1.status).toBe("skipped");
    expect(t2.status).toBe("skipped");
    expect(t3.status).toBe("pending");
  });

  it("refuses when deal is not in pending_early_exit", async () => {
    seedDeal("d-1", "active");
    const result = await finaliseEarlyCancelPaidRemainder({ deal_id: "d-1" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/illegal_transition/);
    const row = testDb.select().from(deals).where(eq(deals.id, "d-1")).get();
    expect(row.subscription_state).toBe("active");
  });
});

describe("QB-8 — finaliseEarlyCancelBuyout", () => {
  it("flips pending_early_exit → cancelled_buyout + logs buyout_50pct kind", async () => {
    seedDeal("d-1", "pending_early_exit");
    const result = await finaliseEarlyCancelBuyout({
      deal_id: "d-1",
      by_user_id: "u-1",
    });
    expect(result.ok).toBe(true);
    expect(result.deal?.subscription_state).toBe("cancelled_buyout");
    const logs = testDb.select().from(activity_log).all();
    expect(logs).toHaveLength(1);
    expect(logs[0].kind).toBe("subscription_early_cancel_buyout_50pct");
  });

  it("refuses when deal is already a terminal state", async () => {
    seedDeal("d-1", "cancelled_buyout");
    const result = await finaliseEarlyCancelBuyout({ deal_id: "d-1" });
    expect(result.ok).toBe(false);
  });
});
