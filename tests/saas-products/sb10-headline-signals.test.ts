/**
 * SB-10 — SaaS admin cockpit headline signals.
 *
 * Covers `getSaasHeadlineSignals`, `getSaasHeadlineSignalsForProduct`, and
 * `getSaasHealthBanners` per brief AC 12. Hermetic sqlite with seeded
 * deals / tiers / dimensions / usage / activity-log fixtures.
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
  afterEach,
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

import {
  getSaasHeadlineSignals,
  getSaasHeadlineSignalsForProduct,
  getSaasHealthBanners,
} from "@/lib/saas-products/headline-signals";
import { killSwitches, resetKillSwitchesToDefaults } from "@/lib/kill-switches";
import settings from "@/lib/settings";

const TEST_DB = path.join(process.cwd(), "tests/.test-sb10-headlines.db");
let sqlite: Database.Database;

const NOW = Date.UTC(2026, 3, 15, 12, 0, 0); // 2026-04-15T12:00:00Z
const DAY = 86_400_000;
const WINDOW_DAYS = 30;
const WINDOW_START = NOW - WINDOW_DAYS * DAY;

const PRODUCT_A = "sb10-prod-a";
const PRODUCT_B = "sb10-prod-b";
const TIER_A_SMALL = "sb10-tier-a-small";
const TIER_A_LARGE = "sb10-tier-a-large";
const TIER_B_SMALL = "sb10-tier-b-small";
const DIM_A = "sb10-dim-a";
const DIM_B = "sb10-dim-b";

beforeAll(() => {
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
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
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

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
  settings.invalidateCache();
}

function seedProducts() {
  sqlite
    .prepare(
      `INSERT INTO saas_products (id, name, slug, status, demo_enabled, display_order, created_at_ms, updated_at_ms)
       VALUES (?, 'A', 'a', 'active', 0, 0, ?, ?),
              (?, 'B', 'b', 'active', 0, 1, ?, ?)`,
    )
    .run(PRODUCT_A, NOW, NOW, PRODUCT_B, NOW, NOW);
  sqlite
    .prepare(
      `INSERT INTO saas_tiers (id, product_id, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'Small', 1, 5000, 0, ?, ?),
              (?, ?, 'Large', 3, 20000, 0, ?, ?),
              (?, ?, 'Small', 1, 7500, 0, ?, ?)`,
    )
    .run(
      TIER_A_SMALL,
      PRODUCT_A,
      NOW,
      NOW,
      TIER_A_LARGE,
      PRODUCT_A,
      NOW,
      NOW,
      TIER_B_SMALL,
      PRODUCT_B,
      NOW,
      NOW,
    );
  sqlite
    .prepare(
      `INSERT INTO saas_usage_dimensions (id, product_id, dimension_key, display_name, display_order, created_at_ms)
       VALUES (?, ?, 'searches', 'Searches', 0, ?),
              (?, ?, 'posts', 'Posts', 0, ?)`,
    )
    .run(DIM_A, PRODUCT_A, NOW, DIM_B, PRODUCT_B, NOW);
  // Tier limits — small A caps 100 searches, large A unlimited; small B caps 10 posts.
  sqlite
    .prepare(
      `INSERT INTO saas_tier_limits (id, tier_id, dimension_id, limit_value)
       VALUES ('lim-a-small', ?, ?, 100),
              ('lim-a-large', ?, ?, NULL),
              ('lim-b-small', ?, ?, 10)`,
    )
    .run(TIER_A_SMALL, DIM_A, TIER_A_LARGE, DIM_A, TIER_B_SMALL, DIM_B);
}

interface DealFixture {
  id: string;
  productId: string;
  tierId: string;
  state:
    | "active"
    | "past_due"
    | "paused"
    | "cancelled_paid_remainder"
    | "cancelled_buyout"
    | "cancelled_post_term"
    | "ended_gracefully";
  createdAtMs: number;
  updatedAtMs?: number;
}

function seedDeal(f: DealFixture) {
  const companyId = `co_${f.id}`;
  const contactId = `ct_${f.id}`;
  sqlite
    .prepare(
      `INSERT INTO companies (id, name, name_normalised, shape, billing_mode, first_seen_at_ms, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, 'solo', 'stripe', ?, ?, ?)`,
    )
    .run(companyId, f.id, f.id, f.createdAtMs, f.createdAtMs, f.createdAtMs);
  sqlite
    .prepare(
      `INSERT INTO contacts (id, company_id, name, email, email_normalised, email_status, is_primary, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, 'unknown', 1, ?, ?)`,
    )
    .run(
      contactId,
      companyId,
      f.id,
      `${f.id}@x.test`,
      `${f.id}@x.test`,
      f.createdAtMs,
      f.createdAtMs,
    );
  sqlite
    .prepare(
      `INSERT INTO deals (id, company_id, primary_contact_id, title, stage, value_estimated, pause_used_this_commitment, last_stage_change_at_ms, subscription_state, saas_product_id, saas_tier_id, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, ?, 'won', 1, 0, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      f.id,
      companyId,
      contactId,
      f.id,
      f.createdAtMs,
      f.state,
      f.productId,
      f.tierId,
      f.createdAtMs,
      f.updatedAtMs ?? f.createdAtMs,
    );
}

function seedUsage(
  dealId: string,
  productId: string,
  dimKey: string,
  amount: number,
) {
  const contactId = `ct_${dealId}`;
  const companyId = `co_${dealId}`;
  // Match the deal's billing period (anchor = createdAtMs). Just write an
  // inclusive row in the active period — use NOW as the billing_period_start
  // proxy; `loadDashboardUsage` uses `resolveBillingPeriod` against the
  // deal.created_at_ms anchor. For hermetic seeding we set broad bounds.
  sqlite
    .prepare(
      `INSERT INTO usage_records (id, contact_id, company_id, product_id, dimension_key, amount, idempotency_key, billing_period_start_ms, billing_period_end_ms, recorded_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    )
    .run(
      `ur_${dealId}_${dimKey}`,
      contactId,
      companyId,
      productId,
      dimKey,
      amount,
      NOW - 15 * DAY,
      NOW + 15 * DAY,
      NOW - DAY,
    );
}

function seedActivity(
  dealId: string,
  kind: string,
  createdAtMs: number,
) {
  sqlite
    .prepare(
      `INSERT INTO activity_log (id, deal_id, kind, body, meta, created_at_ms)
       VALUES (?, ?, ?, '', ?, ?)`,
    )
    .run(
      `al_${kind}_${dealId}_${createdAtMs}`,
      dealId,
      kind,
      JSON.stringify({}),
      createdAtMs,
    );
}

beforeEach(() => {
  cleanState();
  resetKillSwitchesToDefaults();
  seedProducts();
});

afterEach(() => {
  resetKillSwitchesToDefaults();
});

describe("SB-10 getSaasHeadlineSignals — MRR + cadence + cancel exclusion", () => {
  it("MRR sums active + past_due at monthly price; excludes cancelled + paused", async () => {
    seedDeal({
      id: "d_active",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 60 * DAY,
    });
    seedDeal({
      id: "d_pastdue",
      productId: PRODUCT_A,
      tierId: TIER_A_LARGE,
      state: "past_due",
      createdAtMs: NOW - 90 * DAY,
    });
    seedDeal({
      id: "d_cancelled",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "cancelled_post_term",
      createdAtMs: NOW - 120 * DAY,
      updatedAtMs: NOW - 40 * DAY,
    });
    seedDeal({
      id: "d_paused",
      productId: PRODUCT_B,
      tierId: TIER_B_SMALL,
      state: "paused",
      createdAtMs: NOW - 60 * DAY,
    });

    const s = await getSaasHeadlineSignals({ nowMs: NOW });
    expect(s.activeSubscribers).toBe(2);
    expect(s.mrrCents).toBe(5000 + 20000); // small A + large A
    expect(s.pastDueCount).toBe(1);
  });
});

describe("SB-10 getSaasHeadlineSignals — new / churn windows", () => {
  it("newThisWindow only counts SaaS deals inside window", async () => {
    seedDeal({
      id: "d_new_in",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 5 * DAY,
    });
    seedDeal({
      id: "d_new_out",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 60 * DAY,
    });
    const s = await getSaasHeadlineSignals({ nowMs: NOW });
    expect(s.newThisWindow).toBe(1);
  });

  it("churnThisWindow counts cancellations inside window; doesn't double-count re-subscribe", async () => {
    // Cancelled inside window.
    seedDeal({
      id: "d_churn",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "cancelled_buyout",
      createdAtMs: NOW - 180 * DAY,
      updatedAtMs: NOW - 10 * DAY,
    });
    // Cancelled outside window.
    seedDeal({
      id: "d_old_churn",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "cancelled_post_term",
      createdAtMs: NOW - 400 * DAY,
      updatedAtMs: NOW - 90 * DAY,
    });
    // Re-subscribe: a new deal in active state created inside window.
    seedDeal({
      id: "d_resub",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 3 * DAY,
    });
    const s = await getSaasHeadlineSignals({ nowMs: NOW });
    expect(s.churnThisWindow).toBe(1);
  });
});

describe("SB-10 getSaasHeadlineSignals — MRR delta", () => {
  it("delta = currentMRR - priorMRR for a known timeline", async () => {
    // Existed before window, still active → counted in prior AND current.
    seedDeal({
      id: "d_stay",
      productId: PRODUCT_A,
      tierId: TIER_A_LARGE,
      state: "active",
      createdAtMs: NOW - 90 * DAY,
    });
    // New inside window → not in prior, yes in current.
    seedDeal({
      id: "d_new",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 5 * DAY,
    });
    // Cancelled inside window → in prior (was active at window start), not in current.
    seedDeal({
      id: "d_drop",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "cancelled_buyout",
      createdAtMs: NOW - 200 * DAY,
      updatedAtMs: NOW - 5 * DAY,
    });
    const priorMrr = 20000 /* stay */ + 5000 /* drop counted at start */;
    const currentMrr = 20000 /* stay */ + 5000 /* new */;
    const s = await getSaasHeadlineSignals({ nowMs: NOW });
    expect(s.mrrCents).toBe(currentMrr);
    expect(s.mrrDeltaCents).toBe(currentMrr - priorMrr);
    expect(s.mrrDeltaPct).toBeCloseTo((currentMrr - priorMrr) / priorMrr, 6);
  });

  it("mrrDeltaPct returns null when prior MRR was 0", async () => {
    seedDeal({
      id: "d_first",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 5 * DAY,
    });
    const s = await getSaasHeadlineSignals({ nowMs: NOW });
    expect(s.mrrCents).toBe(5000);
    expect(s.mrrDeltaCents).toBe(5000);
    expect(s.mrrDeltaPct).toBeNull();
  });
});

describe("SB-10 getSaasHeadlineSignals — past_due + activity-log windows", () => {
  it("pastDueCount matches deals.subscription_state='past_due'", async () => {
    seedDeal({
      id: "d_pd1",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "past_due",
      createdAtMs: NOW - 60 * DAY,
    });
    seedDeal({
      id: "d_pd2",
      productId: PRODUCT_B,
      tierId: TIER_B_SMALL,
      state: "past_due",
      createdAtMs: NOW - 60 * DAY,
    });
    seedDeal({
      id: "d_ok",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 60 * DAY,
    });
    const s = await getSaasHeadlineSignals({ nowMs: NOW });
    expect(s.pastDueCount).toBe(2);
  });

  it("lockoutCount7d + dataLossWarningsSent7d match activity-log window", async () => {
    seedDeal({
      id: "d_x",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "past_due",
      createdAtMs: NOW - 60 * DAY,
    });
    seedActivity("d_x", "saas_payment_failed_lockout", NOW - 2 * DAY);
    seedActivity("d_x", "saas_payment_failed_lockout", NOW - 10 * DAY); // outside 7d
    seedActivity("d_x", "saas_data_loss_warning_sent", NOW - 1 * DAY);
    const s = await getSaasHeadlineSignals({ nowMs: NOW });
    expect(s.lockoutCount7d).toBe(1);
    expect(s.dataLossWarningsSent7d).toBe(1);
  });
});

describe("SB-10 getSaasHeadlineSignals — near cap", () => {
  it("respects 0.8 threshold (setting), uses setting, excludes non-active", async () => {
    // Active, 95% of 100 → near cap.
    seedDeal({
      id: "d_near",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 20 * DAY,
    });
    seedUsage("d_near", PRODUCT_A, "searches", 95);
    // Active, 10% → not near.
    seedDeal({
      id: "d_far",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 20 * DAY,
    });
    seedUsage("d_far", PRODUCT_A, "searches", 10);
    // Past_due at 95% → excluded (not active).
    seedDeal({
      id: "d_pd_near",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "past_due",
      createdAtMs: NOW - 20 * DAY,
    });
    seedUsage("d_pd_near", PRODUCT_A, "searches", 95);
    const s = await getSaasHeadlineSignals({ nowMs: NOW });
    expect(s.nearCapCount).toBe(1);
  });
});

describe("SB-10 per-product slice", () => {
  it("scopes correctly to one product", async () => {
    seedDeal({
      id: "d_a",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 3 * DAY,
    });
    seedDeal({
      id: "d_b",
      productId: PRODUCT_B,
      tierId: TIER_B_SMALL,
      state: "active",
      createdAtMs: NOW - 3 * DAY,
    });
    const sA = await getSaasHeadlineSignalsForProduct(PRODUCT_A, {
      nowMs: NOW,
    });
    const sB = await getSaasHeadlineSignalsForProduct(PRODUCT_B, {
      nowMs: NOW,
    });
    expect(sA.mrrCents).toBe(5000);
    expect(sB.mrrCents).toBe(7500);
    expect(sA.newThisWindow).toBe(1);
    expect(sB.newThisWindow).toBe(1);
  });
});

describe("SB-10 getSaasHealthBanners", () => {
  it("emits warning on past_due, critical on data-loss warning; empty when kill switch off", async () => {
    seedDeal({
      id: "d_pd",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "past_due",
      createdAtMs: NOW - 60 * DAY,
    });
    seedActivity("d_pd", "saas_data_loss_warning_sent", NOW - 1 * DAY);

    const banners = await getSaasHealthBanners("user-1");
    const severities = banners.map((b) => b.severity);
    expect(severities).toContain("critical");
    expect(severities).toContain("warning");

    killSwitches.saas_headlines_enabled = false;
    const off = await getSaasHealthBanners("user-1");
    expect(off).toEqual([]);
  });

  it("getSaasHeadlineSignals still returns numbers even when kill switch off", async () => {
    seedDeal({
      id: "d_x",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 60 * DAY,
    });
    killSwitches.saas_headlines_enabled = false;
    const s = await getSaasHeadlineSignals({ nowMs: NOW });
    expect(s.activeSubscribers).toBe(1);
    expect(s.mrrCents).toBe(5000);
  });
});

describe("SB-10 window override", () => {
  it("honours explicit windowDays override", async () => {
    seedDeal({
      id: "d_recent",
      productId: PRODUCT_A,
      tierId: TIER_A_SMALL,
      state: "active",
      createdAtMs: NOW - 10 * DAY,
    });
    const s7 = await getSaasHeadlineSignals({ nowMs: NOW, windowDays: 7 });
    const s30 = await getSaasHeadlineSignals({ nowMs: NOW, windowDays: 30 });
    expect(s7.newThisWindow).toBe(0);
    expect(s30.newThisWindow).toBe(1);
    expect(s7.windowDays).toBe(7);
    expect(s30.windowDays).toBe(30);
  });
});

// Silence unused-const lint for WINDOW_START in strict modes; it's used
// implicitly via the window math inside the primitive.
void WINDOW_START;
