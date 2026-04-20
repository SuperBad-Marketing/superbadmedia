import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import {
  expenses,
  EXPENSE_CATEGORIES,
  EXPENSE_SOURCES,
  EXPENSE_STATUSES,
  EXPENSE_CATEGORY_LABELS,
} from "@/lib/db/schema/expenses";
import {
  recurring_expenses,
  RECURRING_FREQUENCIES,
  RECURRING_STATUSES,
} from "@/lib/db/schema/recurring-expenses";
import { finance_snapshots } from "@/lib/db/schema/finance-snapshots";
import {
  compliance_milestones,
  COMPLIANCE_MILESTONE_KINDS,
} from "@/lib/db/schema/compliance-milestones";

const TEST_DB = path.join(process.cwd(), "tests/.test-fd1-expenses.db");

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite);
  drizzleMigrate(db, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe("FD-1 — Finance Dashboard data model", () => {
  it("creates and reads an expense", async () => {
    const id = randomUUID();
    const now = Date.now();
    await db.insert(expenses).values({
      id,
      amount_inc_gst: 15000,
      gst_amount: 1364,
      category: "software_subscriptions",
      vendor: "Vercel",
      description: "Pro plan monthly",
      expense_date: "2026-04-01",
      source: "manual",
      status: "confirmed",
      manual_override: false,
      created_at_ms: now,
      updated_at_ms: now,
    });

    const rows = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].amount_inc_gst).toBe(15000);
    expect(rows[0].gst_amount).toBe(1364);
    expect(rows[0].vendor).toBe("Vercel");
    expect(rows[0].category).toBe("software_subscriptions");
    expect(rows[0].status).toBe("confirmed");
  });

  it("enforces unique source+source_ref for rollup idempotency", async () => {
    const now = Date.now();
    const base = {
      amount_inc_gst: 500,
      category: "api_costs" as const,
      vendor: "Anthropic",
      expense_date: "2026-04-15",
      source: "observatory_rollup" as const,
      source_ref: "anthropic_2026-04-15",
      status: "pending_review" as const,
      manual_override: false,
      created_at_ms: now,
      updated_at_ms: now,
    };

    await db.insert(expenses).values({ id: randomUUID(), ...base });

    await expect(
      db.insert(expenses).values({ id: randomUUID(), ...base }),
    ).rejects.toThrow();
  });

  it("creates a recurring expense", async () => {
    const id = randomUUID();
    const now = Date.now();
    await db.insert(recurring_expenses).values({
      id,
      vendor: "Adobe",
      category: "software_subscriptions",
      amount_inc_gst: 8000,
      gst_amount: 727,
      frequency: "monthly",
      next_fire_date: "2026-05-01",
      status: "active",
      created_at_ms: now,
      updated_at_ms: now,
    });

    const rows = await db
      .select()
      .from(recurring_expenses)
      .where(eq(recurring_expenses.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].frequency).toBe("monthly");
    expect(rows[0].status).toBe("active");
  });

  it("creates a finance snapshot", async () => {
    const now = Date.now();
    await db.insert(finance_snapshots).values({
      snapshot_date: "2026-04-20",
      metrics_json: { revenue_mtd_cents: 1200000, expenses_mtd_cents: 400000 },
      projection_json: { contracted_curve: [], pipeline_weighted_curve: [], decay_adjusted_curve: [] },
      created_at_ms: now,
    });

    const rows = await db
      .select()
      .from(finance_snapshots)
      .where(eq(finance_snapshots.snapshot_date, "2026-04-20"));
    expect(rows).toHaveLength(1);
    expect(rows[0].narrative_text).toBeNull();
  });

  it("creates a compliance milestone", async () => {
    const id = randomUUID();
    await db.insert(compliance_milestones).values({
      id,
      kind: "bas_filed",
      period_label: "Q3-2026",
      filed_at_ms: Date.now(),
      note: "Filed via accountant",
    });

    const rows = await db
      .select()
      .from(compliance_milestones)
      .where(eq(compliance_milestones.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("bas_filed");
    expect(rows[0].period_label).toBe("Q3-2026");
  });

  it("has all 9 expense categories with labels", () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(9);
    for (const cat of EXPENSE_CATEGORIES) {
      expect(EXPENSE_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });

  it("has expected enum values", () => {
    expect(EXPENSE_SOURCES).toEqual([
      "manual",
      "recurring",
      "observatory_rollup",
      "stripe_fees",
    ]);
    expect(EXPENSE_STATUSES).toEqual(["pending_review", "confirmed"]);
    expect(RECURRING_FREQUENCIES).toEqual(["monthly", "quarterly", "annual"]);
    expect(RECURRING_STATUSES).toEqual(["active", "paused"]);
    expect(COMPLIANCE_MILESTONE_KINDS).toEqual(["bas_filed", "eofy_filed"]);
  });
});
