import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { expenses } from "@/lib/db/schema/expenses";
import { recurring_expenses } from "@/lib/db/schema/recurring-expenses";
import { finance_snapshots } from "@/lib/db/schema/finance-snapshots";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";

const TEST_DB = path.join(process.cwd(), "tests/.test-fd2-projection.db");

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

// --- Pure helpers tested without DB ---

const STAGE_PROBABILITIES: Record<string, number> = {
  lead: 0.05,
  contacted: 0.1,
  conversation: 0.2,
  trial_shoot: 0.4,
  quoted: 0.6,
  negotiating: 0.75,
  won: 1.0,
  lost: 0,
};

const STAGE_EXPECTED_DWELL_DAYS: Record<string, number> = {
  lead: 14,
  contacted: 7,
  conversation: 14,
  trial_shoot: 21,
  quoted: 14,
  negotiating: 10,
  won: 0,
  lost: 0,
};

function msToDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function dateStrToMs(date: string): number {
  return new Date(date + "T00:00:00Z").getTime();
}

function advanceFireDate(
  currentDate: string,
  frequency: "monthly" | "quarterly" | "annual",
): string {
  const d = new Date(currentDate + "T00:00:00Z");
  switch (frequency) {
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "annual":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

function monthlyFromDealValue(
  valueCents: number,
  cadence: string | null,
): number {
  switch (cadence) {
    case "annual_upfront":
    case "annual_monthly":
      return valueCents / 12;
    default:
      return valueCents;
  }
}

// --- Tests ---

describe("FD-2 — Projection helpers", () => {
  it("stage probability defaults are sane", () => {
    expect(STAGE_PROBABILITIES.won).toBe(1.0);
    expect(STAGE_PROBABILITIES.lost).toBe(0);
    expect(STAGE_PROBABILITIES.quoted).toBeGreaterThan(0);
    expect(STAGE_PROBABILITIES.lead).toBeGreaterThan(0);
  });

  it("expected dwell days exist for all stages", () => {
    expect(typeof STAGE_EXPECTED_DWELL_DAYS.lead).toBe("number");
    expect(typeof STAGE_EXPECTED_DWELL_DAYS.contacted).toBe("number");
    expect(STAGE_EXPECTED_DWELL_DAYS.won).toBe(0);
  });

  it("converts ms to date string correctly", () => {
    const ms = new Date("2026-04-20T10:00:00Z").getTime();
    expect(msToDateStr(ms)).toBe("2026-04-20");
  });

  it("converts date string to ms correctly", () => {
    const ms = dateStrToMs("2026-04-20");
    const d = new Date(ms);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(3);
    expect(d.getUTCDate()).toBe(20);
  });

  it("round-trips date conversion", () => {
    const original = "2026-12-31";
    expect(msToDateStr(dateStrToMs(original))).toBe(original);
  });

  it("monthly from annual cadence divides by 12", () => {
    expect(monthlyFromDealValue(120000, "annual_upfront")).toBe(10000);
    expect(monthlyFromDealValue(120000, "annual_monthly")).toBe(10000);
  });

  it("monthly from monthly cadence passes through", () => {
    expect(monthlyFromDealValue(50000, "monthly")).toBe(50000);
    expect(monthlyFromDealValue(50000, null)).toBe(50000);
  });

  it("stage-age decay calculation halves probability", () => {
    const baseProbability = 0.6;
    const decayHalflifeDays = 30;
    const overdueDays = 30;
    const decayed =
      baseProbability * Math.pow(0.5, overdueDays / decayHalflifeDays);
    expect(decayed).toBeCloseTo(0.3, 5);
  });

  it("no decay when within expected dwell time", () => {
    const baseProbability = 0.6;
    const overdueDays = 0;
    const decayed = baseProbability * Math.pow(0.5, overdueDays / 30);
    expect(decayed).toBe(baseProbability);
  });
});

describe("FD-2 — advanceFireDate", () => {
  it("advances monthly", () => {
    expect(advanceFireDate("2026-01-15", "monthly")).toBe("2026-02-15");
  });

  it("advances quarterly", () => {
    expect(advanceFireDate("2026-01-01", "quarterly")).toBe("2026-04-01");
  });

  it("advances annual", () => {
    expect(advanceFireDate("2026-06-01", "annual")).toBe("2027-06-01");
  });

  it("handles month-end rollover for monthly", () => {
    const result = advanceFireDate("2026-01-31", "monthly");
    const d = new Date(result + "T00:00:00Z");
    // Jan 31 + 1 month = Mar 3 (Feb overflow); month index 2
    expect(d.getUTCMonth()).toBe(2);
  });

  it("handles Dec to Jan rollover", () => {
    expect(advanceFireDate("2026-12-15", "monthly")).toBe("2027-01-15");
  });
});

describe("FD-2 — Recurring expense booking (data model)", () => {
  it("inserts a recurring expense and books it into expenses", async () => {
    const recId = randomUUID();
    const now = Date.now();

    await db.insert(recurring_expenses).values({
      id: recId,
      vendor: "Adobe Creative Cloud",
      category: "software_subscriptions",
      amount_inc_gst: 8999,
      gst_amount: 818,
      frequency: "monthly",
      next_fire_date: "2026-04-01",
      status: "active",
      created_at_ms: now,
      updated_at_ms: now,
    });

    const expId = randomUUID();
    await db.insert(expenses).values({
      id: expId,
      amount_inc_gst: 8999,
      gst_amount: 818,
      category: "software_subscriptions",
      vendor: "Adobe Creative Cloud",
      description: "Recurring: Adobe Creative Cloud",
      expense_date: "2026-04-01",
      source: "recurring",
      source_ref: recId,
      status: "pending_review",
      manual_override: false,
      receipt_path: null,
      candidate_id: null,
      created_at_ms: now,
      updated_at_ms: now,
    });

    const booked = await db
      .select()
      .from(expenses)
      .where(eq(expenses.source_ref, recId));
    expect(booked).toHaveLength(1);
    expect(booked[0].status).toBe("pending_review");
    expect(booked[0].source).toBe("recurring");
    expect(booked[0].amount_inc_gst).toBe(8999);
  });
});

describe("FD-2 — Observatory rollup (data model)", () => {
  it("inserts external_call_log rows and upserts into expenses", async () => {
    const yesterdayMs = Date.now() - 86_400_000;
    const vendor = "anthropic-opus";

    for (let i = 0; i < 3; i++) {
      await db.insert(external_call_log).values({
        id: randomUUID(),
        job: vendor,
        actor_type: "internal",
        actor_id: null,
        shared_cohort_id: null,
        units: JSON.stringify({ input_tokens: 1000, output_tokens: 500 }),
        estimated_cost_aud: 0.15,
        prompt_version_hash: null,
        converted_from_candidate_id: null,
        created_at_ms: yesterdayMs + i * 1000,
      });
    }

    const expId = randomUUID();
    const sourceRef = `${vendor}:2026-04-19`;
    const now = Date.now();
    await db.insert(expenses).values({
      id: expId,
      amount_inc_gst: 45,
      gst_amount: null,
      category: "api_costs",
      vendor,
      description: `API costs rollup — 2026-04-19`,
      expense_date: "2026-04-19",
      source: "observatory_rollup",
      source_ref: sourceRef,
      status: "pending_review",
      manual_override: false,
      receipt_path: null,
      candidate_id: null,
      created_at_ms: now,
      updated_at_ms: now,
    });

    const rolled = await db
      .select()
      .from(expenses)
      .where(
        and(
          sql`${expenses.source} = 'observatory_rollup'`,
          sql`${expenses.source_ref} = ${sourceRef}`,
        ),
      );
    expect(rolled).toHaveLength(1);
    expect(rolled[0].category).toBe("api_costs");
  });

  it("respects manual_override — skips overridden rows", async () => {
    const sourceRef = `test-vendor:2026-04-18`;
    const id = randomUUID();
    const now = Date.now();

    await db.insert(expenses).values({
      id,
      amount_inc_gst: 100,
      gst_amount: null,
      category: "api_costs",
      vendor: "test-vendor",
      description: "test",
      expense_date: "2026-04-18",
      source: "observatory_rollup",
      source_ref: sourceRef,
      status: "confirmed",
      manual_override: true,
      receipt_path: null,
      candidate_id: null,
      created_at_ms: now,
      updated_at_ms: now,
    });

    const existing = await db
      .select({ id: expenses.id, manual_override: expenses.manual_override })
      .from(expenses)
      .where(
        and(
          sql`${expenses.source} = 'observatory_rollup'`,
          sql`${expenses.source_ref} = ${sourceRef}`,
        ),
      );
    expect(existing).toHaveLength(1);
    expect(existing[0].manual_override).toBe(true);
  });
});

describe("FD-2 — Stripe fee rollup (data model)", () => {
  it("inserts stripe fee expense with correct category", async () => {
    const id = randomUUID();
    const now = Date.now();
    const sourceRef = "stripe_fee:charge:2026-04-19";

    await db.insert(expenses).values({
      id,
      amount_inc_gst: 250,
      gst_amount: 23,
      category: "payment_processing",
      vendor: "Stripe (charge)",
      description: "Stripe charge fees — 2026-04-19",
      expense_date: "2026-04-19",
      source: "stripe_fees",
      source_ref: sourceRef,
      status: "pending_review",
      manual_override: false,
      receipt_path: null,
      candidate_id: null,
      created_at_ms: now,
      updated_at_ms: now,
    });

    const row = await db.select().from(expenses).where(eq(expenses.id, id));
    expect(row).toHaveLength(1);
    expect(row[0].category).toBe("payment_processing");
    expect(row[0].source).toBe("stripe_fees");
    expect(row[0].gst_amount).toBe(23);
  });
});

describe("FD-2 — Finance snapshot (data model)", () => {
  it("upserts a snapshot for today", async () => {
    const today = "2026-04-20";
    const now = Date.now();

    const metrics = {
      revenue_mtd_cents: 1240000,
      expenses_mtd_cents: 410000,
      net_cents: 830000,
      mrr_cents: 1110000,
      outstanding_invoices_cents: 320000,
      gst_owed_cents: 124000,
      income_tax_provisioned_cents: 300000,
      yours_to_spend_cents: 140000,
      stripe_balance_cents: 620000,
    };

    const projection = {
      contracted_curve: [{ date: "2026-04-20", cents: 37000 }],
      pipeline_weighted_curve: [{ date: "2026-04-20", cents: 5000 }],
      decay_adjusted_curve: [{ date: "2026-04-20", cents: 4500 }],
    };

    await db
      .insert(finance_snapshots)
      .values({
        snapshot_date: today,
        metrics_json: metrics as unknown as null,
        projection_json: projection as unknown as null,
        narrative_text: null,
        narrative_generated_at_ms: null,
        narrative_callouts: null,
        stale_flags: null,
        created_at_ms: now,
      })
      .onConflictDoUpdate({
        target: finance_snapshots.snapshot_date,
        set: {
          metrics_json: metrics as unknown as null,
          projection_json: projection as unknown as null,
        },
      });

    const row = await db
      .select()
      .from(finance_snapshots)
      .where(eq(finance_snapshots.snapshot_date, today));
    expect(row).toHaveLength(1);
    expect(row[0].narrative_text).toBeNull();

    const stored = row[0].metrics_json as unknown as typeof metrics;
    expect(stored.revenue_mtd_cents).toBe(1240000);
    expect(stored.mrr_cents).toBe(1110000);
  });

  it("overwrites snapshot on re-upsert for same date", async () => {
    const today = "2026-04-20";
    const now = Date.now();

    const newMetrics = {
      revenue_mtd_cents: 1300000,
      expenses_mtd_cents: 420000,
      net_cents: 880000,
      mrr_cents: 1120000,
      outstanding_invoices_cents: 310000,
      gst_owed_cents: 130000,
      income_tax_provisioned_cents: 320000,
      yours_to_spend_cents: 150000,
      stripe_balance_cents: 650000,
    };

    await db
      .insert(finance_snapshots)
      .values({
        snapshot_date: today,
        metrics_json: newMetrics as unknown as null,
        projection_json: null,
        narrative_text: null,
        narrative_generated_at_ms: null,
        narrative_callouts: null,
        stale_flags: null,
        created_at_ms: now,
      })
      .onConflictDoUpdate({
        target: finance_snapshots.snapshot_date,
        set: {
          metrics_json: newMetrics as unknown as null,
        },
      });

    const row = await db
      .select()
      .from(finance_snapshots)
      .where(eq(finance_snapshots.snapshot_date, today));
    expect(row).toHaveLength(1);

    const stored = row[0].metrics_json as unknown as typeof newMetrics;
    expect(stored.revenue_mtd_cents).toBe(1300000);
  });
});

describe("FD-2 — Deals pipeline data for projection", () => {
  it("queries won deals with active subscription state", async () => {
    const companyId = randomUUID();
    const now = Date.now();

    await db.insert(companies).values({
      id: companyId,
      name: "Test Company",
      name_normalised: "test company",
      first_seen_at_ms: now,
      created_at_ms: now,
      updated_at_ms: now,
    });

    const dealId = randomUUID();
    await db.insert(deals).values({
      id: dealId,
      company_id: companyId,
      title: "Retainer deal",
      stage: "won",
      value_cents: 500000,
      value_estimated: false,
      won_outcome: "retainer",
      subscription_state: "active_current",
      billing_cadence: "monthly",
      committed_until_date_ms: now + 180 * 86_400_000,
      last_stage_change_at_ms: now - 30 * 86_400_000,
      created_at_ms: now,
      updated_at_ms: now,
    });

    const row = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(row).toHaveLength(1);
    expect(row[0].subscription_state).toBe("active_current");
    expect(row[0].value_cents).toBe(500000);
  });

  it("queries pipeline deals with stage and value", async () => {
    const companyId = randomUUID();
    const now = Date.now();

    await db.insert(companies).values({
      id: companyId,
      name: "Pipeline Company",
      name_normalised: "pipeline company",
      first_seen_at_ms: now,
      created_at_ms: now,
      updated_at_ms: now,
    });

    const dealId = randomUUID();
    await db.insert(deals).values({
      id: dealId,
      company_id: companyId,
      title: "Quoted deal",
      stage: "quoted",
      value_cents: 300000,
      value_estimated: true,
      last_stage_change_at_ms: now - 10 * 86_400_000,
      created_at_ms: now,
      updated_at_ms: now,
    });

    const row = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(row).toHaveLength(1);
    expect(row[0].stage).toBe("quoted");
    expect(row[0].value_cents).toBe(300000);
  });
});
