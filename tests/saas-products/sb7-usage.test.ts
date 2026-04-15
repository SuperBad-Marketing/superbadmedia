/**
 * SB-7 — `recordUsage` + `checkUsageLimit` + `loadDashboardUsage`.
 *
 * Hermetic DB. Covers:
 *   - recordUsage idempotency (duplicate key ⇒ no double-insert)
 *   - recordUsage writes contact/company/product + period boundaries
 *   - checkUsageLimit: below cap, approaching warn, at cap, over cap
 *     (with / without enforcement kill switch)
 *   - period boundary math via resolveBillingPeriod (month-length clamp,
 *     usage rolls over when anchor crosses)
 *   - dashboard snapshot anyAtCap + nextTier surfacing
 */
import fs from "node:fs";
import path from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";

let testDb: ReturnType<typeof drizzle>;
vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-sb7-usage.db");
let sqlite: Database.Database;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
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

// Fixture -----------------------------------------------------------------

const PRODUCT_ID = "sb7-prod";
const TIER_SMALL = "sb7-tier-small";
const TIER_LARGE = "sb7-tier-large";
const DIM_ID = "sb7-dim-searches";
const DIM_KEY = "searches";
const LIMIT_SMALL_ID = "sb7-lim-small";
const LIMIT_LARGE_ID = "sb7-lim-large";
const COMPANY_ID = "sb7-co";
const CONTACT_ID = "sb7-contact";
const DEAL_ID = "sb7-deal";
const NOW_MS = Date.UTC(2026, 3, 15, 10, 0, 0); // 2026-04-15T10:00:00Z
const DEAL_CREATED_MS = Date.UTC(2026, 2, 10, 9, 0, 0); // 2026-03-10T09:00:00Z

function seedFixture(opts: { tierId?: string; cap?: number | null } = {}) {
  const now = NOW_MS;
  const tierId = opts.tierId ?? TIER_SMALL;
  const cap = opts.cap === undefined ? 50 : opts.cap;

  sqlite
    .prepare(
      `INSERT INTO saas_products (id, name, slug, status, demo_enabled, display_order, created_at_ms, updated_at_ms)
       VALUES (?, 'Test', 'sb7', 'active', 0, 0, ?, ?)`,
    )
    .run(PRODUCT_ID, now, now);
  sqlite
    .prepare(
      `INSERT INTO saas_tiers (id, product_id, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'Small', 1, 4900, 0, ?, ?),
              (?, ?, 'Large', 3, 19900, 0, ?, ?)`,
    )
    .run(TIER_SMALL, PRODUCT_ID, now, now, TIER_LARGE, PRODUCT_ID, now, now);
  sqlite
    .prepare(
      `INSERT INTO saas_usage_dimensions (id, product_id, dimension_key, display_name, display_order, created_at_ms)
       VALUES (?, ?, ?, 'Searches', 0, ?)`,
    )
    .run(DIM_ID, PRODUCT_ID, DIM_KEY, now);
  sqlite
    .prepare(
      `INSERT INTO saas_tier_limits (id, tier_id, dimension_id, limit_value)
       VALUES (?, ?, ?, ?),
              (?, ?, ?, 500)`,
    )
    .run(
      LIMIT_SMALL_ID,
      TIER_SMALL,
      DIM_ID,
      cap,
      LIMIT_LARGE_ID,
      TIER_LARGE,
      DIM_ID,
    );

  sqlite
    .prepare(
      `INSERT INTO companies (id, name, name_normalised, shape, billing_mode, first_seen_at_ms, created_at_ms, updated_at_ms)
       VALUES (?, 'Co', 'co', 'solo', 'stripe', ?, ?, ?)`,
    )
    .run(COMPANY_ID, now, now, now);
  sqlite
    .prepare(
      `INSERT INTO contacts (id, company_id, name, email, email_normalised, email_status, is_primary, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'C', 'c@co', 'c@co', 'unknown', 1, ?, ?)`,
    )
    .run(CONTACT_ID, COMPANY_ID, now, now);
  sqlite
    .prepare(
      `INSERT INTO deals (id, company_id, primary_contact_id, title, stage, value_estimated, pause_used_this_commitment, last_stage_change_at_ms, subscription_state, saas_product_id, saas_tier_id, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, 'Test', 'won', 1, 0, ?, 'active', ?, ?, ?, ?)`,
    )
    .run(DEAL_ID, COMPANY_ID, CONTACT_ID, now, PRODUCT_ID, tierId, DEAL_CREATED_MS, now);
}

function cleanState() {
  for (const table of [
    "usage_records",
    "activity_log",
    "scheduled_tasks",
    "deals",
    "contacts",
    "companies",
    "saas_tier_limits",
    "saas_usage_dimensions",
    "saas_tiers",
    "saas_products",
  ]) {
    sqlite.prepare(`DELETE FROM ${table}`).run();
  }
}

beforeEach(() => {
  cleanState();
});

// Tests -------------------------------------------------------------------

describe("resolveBillingPeriod", () => {
  it("returns the most recent anniversary <= now as startMs", async () => {
    const { resolveBillingPeriod } = await import("@/lib/saas-products/usage");
    const { startMs, endMs } = resolveBillingPeriod(DEAL_CREATED_MS, NOW_MS);
    // Anchor day 10, now=2026-04-15 → period starts 2026-04-10, ends 2026-05-10.
    expect(new Date(startMs).toISOString()).toBe("2026-04-10T09:00:00.000Z");
    expect(new Date(endMs).toISOString()).toBe("2026-05-10T09:00:00.000Z");
  });

  it("clamps to end-of-month when target month is shorter than anchor day", async () => {
    const { resolveBillingPeriod } = await import("@/lib/saas-products/usage");
    const anchor = Date.UTC(2026, 0, 31, 0, 0, 0); // Jan 31
    const now = Date.UTC(2026, 1, 15, 0, 0, 0); // Feb 15
    const { startMs, endMs } = resolveBillingPeriod(anchor, now);
    // Start: most recent anniversary ≤ Feb 15 → clamped to Jan 31.
    // End: next anniversary → Feb 28 (2026 not leap).
    expect(new Date(startMs).toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(new Date(endMs).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("rolls forward when now passes the anniversary", async () => {
    const { resolveBillingPeriod } = await import("@/lib/saas-products/usage");
    const anchor = Date.UTC(2026, 0, 10, 0, 0, 0);
    const before = Date.UTC(2026, 0, 9, 12, 0, 0);
    const after = Date.UTC(2026, 0, 11, 12, 0, 0);
    const p1 = resolveBillingPeriod(anchor, before);
    const p2 = resolveBillingPeriod(anchor, after);
    // Before anniversary: period started in December.
    expect(new Date(p1.startMs).toISOString()).toBe("2025-12-10T00:00:00.000Z");
    // After anniversary: period started Jan 10.
    expect(new Date(p2.startMs).toISOString()).toBe("2026-01-10T00:00:00.000Z");
  });
});

describe("recordUsage", () => {
  it("writes a row with contact/company/product/period boundaries", async () => {
    seedFixture();
    const { recordUsage } = await import("@/lib/saas-products/usage");
    const res = await recordUsage(CONTACT_ID, PRODUCT_ID, DIM_KEY, {
      nowMs: NOW_MS,
    });
    expect(res.recorded).toBe(true);
    const rows = sqlite
      .prepare(
        "SELECT contact_id, company_id, product_id, dimension_key, amount, billing_period_start_ms, billing_period_end_ms FROM usage_records",
      )
      .all() as Array<{
      contact_id: string;
      company_id: string;
      product_id: string;
      dimension_key: string;
      amount: number;
      billing_period_start_ms: number;
      billing_period_end_ms: number;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].contact_id).toBe(CONTACT_ID);
    expect(rows[0].company_id).toBe(COMPANY_ID);
    expect(rows[0].product_id).toBe(PRODUCT_ID);
    expect(rows[0].amount).toBe(1);
    expect(new Date(rows[0].billing_period_start_ms).toISOString()).toBe(
      "2026-04-10T09:00:00.000Z",
    );
    expect(new Date(rows[0].billing_period_end_ms).toISOString()).toBe(
      "2026-05-10T09:00:00.000Z",
    );
  });

  it("idempotency_key dedupes second call", async () => {
    seedFixture();
    const { recordUsage } = await import("@/lib/saas-products/usage");
    const key = "outreach-send:abc-123";
    const r1 = await recordUsage(CONTACT_ID, PRODUCT_ID, DIM_KEY, {
      idempotencyKey: key,
      nowMs: NOW_MS,
    });
    const r2 = await recordUsage(CONTACT_ID, PRODUCT_ID, DIM_KEY, {
      idempotencyKey: key,
      nowMs: NOW_MS,
    });
    expect(r1.recorded).toBe(true);
    expect(r2.recorded).toBe(false);
    expect(r2.reason).toBe("duplicate");
    const count = sqlite
      .prepare("SELECT COUNT(*) as c FROM usage_records")
      .get() as { c: number };
    expect(count.c).toBe(1);
  });

  it("rejects unknown subscription", async () => {
    seedFixture();
    const { recordUsage } = await import("@/lib/saas-products/usage");
    const res = await recordUsage("ghost", PRODUCT_ID, DIM_KEY, {
      nowMs: NOW_MS,
    });
    expect(res.recorded).toBe(false);
    expect(res.reason).toBe("unknown_subscription");
  });

  it("rejects unknown dimension", async () => {
    seedFixture();
    const { recordUsage } = await import("@/lib/saas-products/usage");
    const res = await recordUsage(CONTACT_ID, PRODUCT_ID, "bogus", {
      nowMs: NOW_MS,
    });
    expect(res.recorded).toBe(false);
    expect(res.reason).toBe("unknown_dimension");
  });

  it("records amount > 1 correctly", async () => {
    seedFixture();
    const { recordUsage } = await import("@/lib/saas-products/usage");
    await recordUsage(CONTACT_ID, PRODUCT_ID, DIM_KEY, {
      amount: 7,
      nowMs: NOW_MS,
    });
    const row = sqlite
      .prepare("SELECT amount FROM usage_records")
      .get() as { amount: number };
    expect(row.amount).toBe(7);
  });
});

describe("checkUsageLimit", () => {
  it("calm when below warn threshold", async () => {
    seedFixture({ cap: 50 });
    const { recordUsage, checkUsageLimit } = await import(
      "@/lib/saas-products/usage"
    );
    for (let i = 0; i < 10; i++) {
      await recordUsage(CONTACT_ID, PRODUCT_ID, DIM_KEY, { nowMs: NOW_MS });
    }
    const res = await checkUsageLimit(CONTACT_ID, PRODUCT_ID, DIM_KEY, {
      nowMs: NOW_MS,
    });
    expect(res.allowed).toBe(true);
    expect(res.used).toBe(10);
    expect(res.limit).toBe(50);
    expect(res.status).toBe("calm");
  });

  it("warn when ≥80%", async () => {
    seedFixture({ cap: 50 });
    const { recordUsage, checkUsageLimit } = await import(
      "@/lib/saas-products/usage"
    );
    for (let i = 0; i < 40; i++) {
      await recordUsage(CONTACT_ID, PRODUCT_ID, DIM_KEY, { nowMs: NOW_MS });
    }
    const res = await checkUsageLimit(CONTACT_ID, PRODUCT_ID, DIM_KEY, {
      nowMs: NOW_MS,
    });
    expect(res.status).toBe("warn");
    expect(res.allowed).toBe(true);
  });

  it("at_cap blocks when enforcement is on; surfaces next tier", async () => {
    seedFixture({ cap: 5 });
    const { recordUsage, checkUsageLimit } = await import(
      "@/lib/saas-products/usage"
    );
    const { killSwitches } = await import("@/lib/kill-switches");
    const prior = killSwitches.saas_usage_enforcement_enabled;
    killSwitches.saas_usage_enforcement_enabled = true;
    try {
      for (let i = 0; i < 5; i++) {
        await recordUsage(CONTACT_ID, PRODUCT_ID, DIM_KEY, { nowMs: NOW_MS });
      }
      const res = await checkUsageLimit(CONTACT_ID, PRODUCT_ID, DIM_KEY, {
        nowMs: NOW_MS,
      });
      expect(res.status).toBe("at_cap");
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe("at_cap");
      expect(res.nextTier?.name).toBe("Large");
      expect(res.nextTier?.limit).toBe(500);
    } finally {
      killSwitches.saas_usage_enforcement_enabled = prior;
    }
  });

  it("at_cap allows when enforcement kill-switch is off", async () => {
    seedFixture({ cap: 3 });
    const { recordUsage, checkUsageLimit } = await import(
      "@/lib/saas-products/usage"
    );
    const { killSwitches } = await import("@/lib/kill-switches");
    killSwitches.saas_usage_enforcement_enabled = false;
    for (let i = 0; i < 3; i++) {
      await recordUsage(CONTACT_ID, PRODUCT_ID, DIM_KEY, { nowMs: NOW_MS });
    }
    const res = await checkUsageLimit(CONTACT_ID, PRODUCT_ID, DIM_KEY, {
      nowMs: NOW_MS,
    });
    expect(res.status).toBe("at_cap");
    expect(res.allowed).toBe(true);
  });

  it("null limit (unlimited top-tier) is always calm + allowed", async () => {
    seedFixture({ tierId: TIER_LARGE, cap: null });
    // Re-seed with null cap on Large only.
    sqlite.prepare("DELETE FROM saas_tier_limits").run();
    sqlite
      .prepare(
        "INSERT INTO saas_tier_limits (id, tier_id, dimension_id, limit_value) VALUES (?, ?, ?, NULL)",
      )
      .run(LIMIT_LARGE_ID, TIER_LARGE, DIM_ID);
    const { recordUsage, checkUsageLimit } = await import(
      "@/lib/saas-products/usage"
    );
    for (let i = 0; i < 100; i++) {
      await recordUsage(CONTACT_ID, PRODUCT_ID, DIM_KEY, { nowMs: NOW_MS });
    }
    const res = await checkUsageLimit(CONTACT_ID, PRODUCT_ID, DIM_KEY, {
      nowMs: NOW_MS,
    });
    expect(res.allowed).toBe(true);
    expect(res.status).toBe("calm");
    expect(res.limit).toBeNull();
    expect(res.nextTier).toBeNull();
  });

  it("period reset: usage from prior cycle doesn't count", async () => {
    seedFixture({ cap: 10 });
    const { recordUsage, checkUsageLimit } = await import(
      "@/lib/saas-products/usage"
    );
    // Record 10 in March cycle (anniversary 2026-03-10 → period started then).
    const MARCH_MS = Date.UTC(2026, 2, 20, 0, 0, 0);
    for (let i = 0; i < 10; i++) {
      await recordUsage(CONTACT_ID, PRODUCT_ID, DIM_KEY, { nowMs: MARCH_MS });
    }
    // Now in April cycle — tally should be 0.
    const res = await checkUsageLimit(CONTACT_ID, PRODUCT_ID, DIM_KEY, {
      nowMs: NOW_MS,
    });
    expect(res.used).toBe(0);
    expect(res.status).toBe("calm");
    expect(res.allowed).toBe(true);
  });
});

describe("loadDashboardUsage", () => {
  it("surfaces anyAtCap + nextTier when a dimension hits the wall", async () => {
    seedFixture({ cap: 2 });
    const { recordUsage, loadDashboardUsage } = await import(
      "@/lib/saas-products/usage"
    );
    for (let i = 0; i < 2; i++) {
      await recordUsage(CONTACT_ID, PRODUCT_ID, DIM_KEY, { nowMs: NOW_MS });
    }
    const snap = await loadDashboardUsage(CONTACT_ID, PRODUCT_ID, {
      nowMs: NOW_MS,
    });
    expect(snap).not.toBeNull();
    expect(snap!.anyAtCap).toBe(true);
    expect(snap!.dimensions[0].status).toBe("at_cap");
    expect(snap!.nextTier?.name).toBe("Large");
  });

  it("returns null when contact has no SaaS deal on file", async () => {
    seedFixture();
    sqlite.prepare("DELETE FROM deals").run();
    const { loadDashboardUsage } = await import("@/lib/saas-products/usage");
    const snap = await loadDashboardUsage(CONTACT_ID, PRODUCT_ID, {
      nowMs: NOW_MS,
    });
    expect(snap).toBeNull();
  });
});
