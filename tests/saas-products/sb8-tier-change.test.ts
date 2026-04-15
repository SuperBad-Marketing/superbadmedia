/**
 * SB-8 — applyTierChange / applyProductSwitch + downgrade-apply handler.
 *
 * Hermetic DB. Stripe is stubbed at the module boundary — we assert the
 * calls the primitive makes, not what Stripe does in return. Covers:
 *   - upgrade happy path (immediate swap + deal row + activity log)
 *   - downgrade pre-flight block when current usage > new-tier limit
 *   - downgrade schedule path (queues the apply task + logs scheduled)
 *   - admin override bypasses the pre-flight block
 *   - same-tier / mode-mismatch rejects
 *   - kill switch off → throws
 *   - applyProductSwitch (switch + activity log + deal row)
 *   - downgrade-apply handler flips the tier + logs downgraded
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
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => stripeStub,
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-sb8-tier-change.db");
let sqlite: Database.Database;

const stripeCalls: Array<{
  op: "retrieve" | "update";
  args: unknown[];
}> = [];
const stripeStub = {
  subscriptions: {
    retrieve: async (id: string) => {
      stripeCalls.push({ op: "retrieve", args: [id] });
      return {
        id,
        items: { data: [{ id: "si_test" }] },
        current_period_end: Math.floor(PERIOD_END_MS / 1000),
      };
    },
    update: async (id: string, params: unknown) => {
      stripeCalls.push({ op: "update", args: [id, params] });
      return { id };
    },
  },
};

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

const PRODUCT_ID = "sb8-prod";
const PRODUCT_ID_2 = "sb8-prod-2";
const TIER_SMALL = "sb8-tier-small";
const TIER_MED = "sb8-tier-med";
const TIER_LARGE = "sb8-tier-large";
const TIER_P2 = "sb8-tier-p2";
const DIM_ID = "sb8-dim";
const DIM_KEY = "searches";
const COMPANY_ID = "sb8-co";
const CONTACT_ID = "sb8-contact";
const DEAL_ID = "sb8-deal";
const STRIPE_SUB = "sub_sb8";
const NOW_MS = Date.UTC(2026, 3, 15, 10, 0, 0);
const DEAL_CREATED_MS = Date.UTC(2026, 2, 10, 9, 0, 0);
const PERIOD_END_MS = Date.UTC(2026, 4, 10, 9, 0, 0);

function seedFixture() {
  const now = NOW_MS;
  sqlite
    .prepare(
      `INSERT INTO saas_products (id, name, slug, status, demo_enabled, display_order, created_at_ms, updated_at_ms)
       VALUES (?, 'A', 'a', 'active', 0, 0, ?, ?), (?, 'B', 'b', 'active', 0, 1, ?, ?)`,
    )
    .run(PRODUCT_ID, now, now, PRODUCT_ID_2, now, now);
  sqlite
    .prepare(
      `INSERT INTO saas_tiers (id, product_id, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst, stripe_monthly_price_id, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'Small', 1, 4900, 0, 'price_small', ?, ?),
              (?, ?, 'Medium', 2, 9900, 0, 'price_med', ?, ?),
              (?, ?, 'Large', 3, 19900, 0, 'price_large', ?, ?),
              (?, ?, 'P2', 1, 2900, 0, 'price_p2', ?, ?)`,
    )
    .run(
      TIER_SMALL, PRODUCT_ID, now, now,
      TIER_MED, PRODUCT_ID, now, now,
      TIER_LARGE, PRODUCT_ID, now, now,
      TIER_P2, PRODUCT_ID_2, now, now,
    );
  sqlite
    .prepare(
      `INSERT INTO saas_usage_dimensions (id, product_id, dimension_key, display_name, display_order, created_at_ms)
       VALUES (?, ?, ?, 'Searches', 0, ?)`,
    )
    .run(DIM_ID, PRODUCT_ID, DIM_KEY, now);
  sqlite
    .prepare(
      `INSERT INTO saas_tier_limits (id, tier_id, dimension_id, limit_value)
       VALUES ('lim-s', ?, ?, 10),
              ('lim-m', ?, ?, 50),
              ('lim-l', ?, ?, 200)`,
    )
    .run(TIER_SMALL, DIM_ID, TIER_MED, DIM_ID, TIER_LARGE, DIM_ID);

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
      `INSERT INTO deals (id, company_id, primary_contact_id, title, stage, value_estimated, pause_used_this_commitment, last_stage_change_at_ms, subscription_state, billing_cadence, stripe_subscription_id, saas_product_id, saas_tier_id, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, 'Test', 'won', 1, 0, ?, 'active', 'monthly', ?, ?, ?, ?, ?)`,
    )
    .run(
      DEAL_ID, COMPANY_ID, CONTACT_ID, now, STRIPE_SUB,
      PRODUCT_ID, TIER_MED, DEAL_CREATED_MS, now,
    );
}

function cleanState() {
  for (const t of [
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
    sqlite.prepare(`DELETE FROM ${t}`).run();
  }
  stripeCalls.length = 0;
}

beforeEach(() => {
  cleanState();
  seedFixture();
});

// Tests -------------------------------------------------------------------

describe("applyTierChange — upgrade", () => {
  it("immediate swap updates deal + logs upgraded + calls Stripe with create_prorations", async () => {
    const { applyTierChange } = await import("@/lib/saas-products/tier-change");
    const res = await applyTierChange(DEAL_ID, TIER_LARGE, {
      mode: "upgrade",
      nowMs: NOW_MS,
    });
    expect(res.blocked).toBe(false);
    if (res.blocked) return;
    expect(res.scheduledFor).toBe("immediate");
    expect(res.effectiveAtMs).toBe(NOW_MS);

    const dealRow = sqlite
      .prepare("SELECT saas_tier_id FROM deals WHERE id = ?")
      .get(DEAL_ID) as { saas_tier_id: string };
    expect(dealRow.saas_tier_id).toBe(TIER_LARGE);

    const act = sqlite
      .prepare(
        "SELECT kind, body FROM activity_log WHERE deal_id = ? ORDER BY created_at_ms DESC LIMIT 1",
      )
      .get(DEAL_ID) as { kind: string; body: string };
    expect(act.kind).toBe("saas_subscription_upgraded");
    expect(act.body).toContain("Large");

    const updateCall = stripeCalls.find((c) => c.op === "update");
    expect(updateCall).toBeDefined();
    const params = updateCall!.args[1] as {
      proration_behavior: string;
      items: Array<{ id: string; price: string }>;
    };
    expect(params.proration_behavior).toBe("create_prorations");
    expect(params.items[0].price).toBe("price_large");
  });

  it("rejects when new tier rank <= current (mode_mismatch)", async () => {
    const { applyTierChange, TierChangeError } = await import(
      "@/lib/saas-products/tier-change"
    );
    await expect(
      applyTierChange(DEAL_ID, TIER_SMALL, {
        mode: "upgrade",
        nowMs: NOW_MS,
      }),
    ).rejects.toBeInstanceOf(TierChangeError);
  });
});

describe("applyTierChange — downgrade", () => {
  it("blocks when current usage > new-tier limit", async () => {
    // Seed 15 usage units against Small's limit of 10 (current tier is
    // Medium with 50). Downgrade target = Small → should block.
    sqlite
      .prepare(
        `INSERT INTO usage_records (id, contact_id, company_id, product_id, dimension_key, amount, billing_period_start_ms, billing_period_end_ms, recorded_at_ms)
         VALUES ('u1', ?, ?, ?, ?, 15, ?, ?, ?)`,
      )
      .run(
        CONTACT_ID, COMPANY_ID, PRODUCT_ID, DIM_KEY,
        Date.UTC(2026, 3, 10, 9, 0, 0), PERIOD_END_MS, NOW_MS,
      );

    const { applyTierChange } = await import("@/lib/saas-products/tier-change");
    const res = await applyTierChange(DEAL_ID, TIER_SMALL, {
      mode: "downgrade",
      nowMs: NOW_MS,
    });
    expect(res.blocked).toBe(true);
    if (!res.blocked) return;
    expect(res.reason).toBe("usage_over_new_limit");
    expect(res.dimensions[0].dimensionKey).toBe(DIM_KEY);
    expect(res.dimensions[0].used).toBe(15);
    expect(res.dimensions[0].newLimit).toBe(10);
  });

  it("admin override bypasses the pre-flight block and schedules the apply task", async () => {
    sqlite
      .prepare(
        `INSERT INTO usage_records (id, contact_id, company_id, product_id, dimension_key, amount, billing_period_start_ms, billing_period_end_ms, recorded_at_ms)
         VALUES ('u1', ?, ?, ?, ?, 15, ?, ?, ?)`,
      )
      .run(
        CONTACT_ID, COMPANY_ID, PRODUCT_ID, DIM_KEY,
        Date.UTC(2026, 3, 10, 9, 0, 0), PERIOD_END_MS, NOW_MS,
      );

    const { applyTierChange } = await import("@/lib/saas-products/tier-change");
    const res = await applyTierChange(DEAL_ID, TIER_SMALL, {
      mode: "downgrade",
      overrideBlock: true,
      actor: "admin",
      nowMs: NOW_MS,
    });
    expect(res.blocked).toBe(false);
    if (res.blocked) return;
    expect(res.scheduledFor).toBe("end_of_period");
    expect(res.effectiveAtMs).toBe(PERIOD_END_MS);

    const task = sqlite
      .prepare(
        "SELECT task_type, payload, run_at_ms FROM scheduled_tasks WHERE task_type = ?",
      )
      .get("saas_subscription_tier_downgrade_apply") as {
      task_type: string;
      payload: string;
      run_at_ms: number;
    };
    expect(task.run_at_ms).toBe(PERIOD_END_MS);
    const payload = JSON.parse(task.payload);
    expect(payload.deal_id).toBe(DEAL_ID);
    expect(payload.to_tier_id).toBe(TIER_SMALL);
    expect(payload.new_price_id).toBe("price_small");

    // Deal row should NOT yet be downgraded — that happens in the handler.
    const dealRow = sqlite
      .prepare("SELECT saas_tier_id FROM deals WHERE id = ?")
      .get(DEAL_ID) as { saas_tier_id: string };
    expect(dealRow.saas_tier_id).toBe(TIER_MED);

    const act = sqlite
      .prepare(
        "SELECT kind FROM activity_log WHERE deal_id = ? ORDER BY created_at_ms DESC LIMIT 1",
      )
      .get(DEAL_ID) as { kind: string };
    expect(act.kind).toBe("saas_tier_downgrade_scheduled");
  });

  it("schedules when usage is within new-tier limit (no pre-flight block)", async () => {
    const { applyTierChange } = await import("@/lib/saas-products/tier-change");
    const res = await applyTierChange(DEAL_ID, TIER_SMALL, {
      mode: "downgrade",
      nowMs: NOW_MS,
    });
    expect(res.blocked).toBe(false);
    if (res.blocked) return;
    expect(res.scheduledFor).toBe("end_of_period");
  });
});

describe("applyTierChange — guardrails", () => {
  it("throws when kill switch is off", async () => {
    const { killSwitches } = await import("@/lib/kill-switches");
    const prev = killSwitches.saas_tier_change_enabled;
    killSwitches.saas_tier_change_enabled = false;
    try {
      const { applyTierChange, TierChangeError } = await import(
        "@/lib/saas-products/tier-change"
      );
      await expect(
        applyTierChange(DEAL_ID, TIER_LARGE, {
          mode: "upgrade",
          nowMs: NOW_MS,
        }),
      ).rejects.toBeInstanceOf(TierChangeError);
    } finally {
      killSwitches.saas_tier_change_enabled = prev;
    }
  });

  it("rejects same-tier changes", async () => {
    const { applyTierChange, TierChangeError } = await import(
      "@/lib/saas-products/tier-change"
    );
    await expect(
      applyTierChange(DEAL_ID, TIER_MED, {
        mode: "upgrade",
        nowMs: NOW_MS,
      }),
    ).rejects.toBeInstanceOf(TierChangeError);
  });

  it("rejects when subscription_state is past_due", async () => {
    sqlite
      .prepare("UPDATE deals SET subscription_state = 'past_due' WHERE id = ?")
      .run(DEAL_ID);
    const { applyTierChange, TierChangeError } = await import(
      "@/lib/saas-products/tier-change"
    );
    await expect(
      applyTierChange(DEAL_ID, TIER_LARGE, {
        mode: "upgrade",
        nowMs: NOW_MS,
      }),
    ).rejects.toBeInstanceOf(TierChangeError);
  });
});

describe("applyProductSwitch", () => {
  it("swaps product + tier on the deal, logs product_switched, calls Stripe with item delete + new price", async () => {
    const { applyProductSwitch } = await import(
      "@/lib/saas-products/tier-change"
    );
    const res = await applyProductSwitch(DEAL_ID, {
      newProductId: PRODUCT_ID_2,
      newTierId: TIER_P2,
      nowMs: NOW_MS,
    });
    expect(res.fromProductId).toBe(PRODUCT_ID);
    expect(res.toProductId).toBe(PRODUCT_ID_2);
    expect(res.toTierId).toBe(TIER_P2);

    const dealRow = sqlite
      .prepare(
        "SELECT saas_product_id, saas_tier_id FROM deals WHERE id = ?",
      )
      .get(DEAL_ID) as { saas_product_id: string; saas_tier_id: string };
    expect(dealRow.saas_product_id).toBe(PRODUCT_ID_2);
    expect(dealRow.saas_tier_id).toBe(TIER_P2);

    const updateCall = stripeCalls.find((c) => c.op === "update");
    expect(updateCall).toBeDefined();
    const params = updateCall!.args[1] as {
      items: Array<{ id?: string; deleted?: boolean; price?: string }>;
    };
    expect(params.items[0].deleted).toBe(true);
    expect(params.items[1].price).toBe("price_p2");

    const act = sqlite
      .prepare(
        "SELECT kind FROM activity_log WHERE deal_id = ? ORDER BY created_at_ms DESC LIMIT 1",
      )
      .get(DEAL_ID) as { kind: string };
    expect(act.kind).toBe("saas_subscription_product_switched");
  });
});

describe("saas_subscription_tier_downgrade_apply handler", () => {
  it("applies the deferred swap + updates the deal + logs downgraded", async () => {
    const { handleSaasSubscriptionTierDowngradeApply } = await import(
      "@/lib/scheduled-tasks/handlers/saas-subscription-tier-downgrade-apply"
    );
    await handleSaasSubscriptionTierDowngradeApply({
      id: "task-1",
      task_type: "saas_subscription_tier_downgrade_apply",
      run_at_ms: PERIOD_END_MS,
      payload: {
        deal_id: DEAL_ID,
        to_tier_id: TIER_SMALL,
        new_price_id: "price_small",
      },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: NOW_MS,
      last_error: null,
      idempotency_key: null,
      created_at_ms: NOW_MS,
      done_at_ms: null,
      reclaimed_at_ms: null,
    });

    const dealRow = sqlite
      .prepare("SELECT saas_tier_id FROM deals WHERE id = ?")
      .get(DEAL_ID) as { saas_tier_id: string };
    expect(dealRow.saas_tier_id).toBe(TIER_SMALL);

    const updateCall = stripeCalls.find((c) => c.op === "update");
    expect(updateCall).toBeDefined();
    const params = updateCall!.args[1] as {
      proration_behavior: string;
      billing_cycle_anchor?: string;
    };
    expect(params.proration_behavior).toBe("none");
    expect(params.billing_cycle_anchor).toBe("unchanged");

    const act = sqlite
      .prepare(
        "SELECT kind FROM activity_log WHERE deal_id = ? ORDER BY created_at_ms DESC LIMIT 1",
      )
      .get(DEAL_ID) as { kind: string };
    expect(act.kind).toBe("saas_subscription_downgraded");
  });

  it("no-ops when deal is past_due", async () => {
    sqlite
      .prepare("UPDATE deals SET subscription_state = 'past_due' WHERE id = ?")
      .run(DEAL_ID);
    const { handleSaasSubscriptionTierDowngradeApply } = await import(
      "@/lib/scheduled-tasks/handlers/saas-subscription-tier-downgrade-apply"
    );
    await handleSaasSubscriptionTierDowngradeApply({
      id: "task-1",
      task_type: "saas_subscription_tier_downgrade_apply",
      run_at_ms: PERIOD_END_MS,
      payload: {
        deal_id: DEAL_ID,
        to_tier_id: TIER_SMALL,
        new_price_id: "price_small",
      },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: NOW_MS,
      last_error: null,
      idempotency_key: null,
      created_at_ms: NOW_MS,
      done_at_ms: null,
      reclaimed_at_ms: null,
    });
    const dealRow = sqlite
      .prepare("SELECT saas_tier_id FROM deals WHERE id = ?")
      .get(DEAL_ID) as { saas_tier_id: string };
    expect(dealRow.saas_tier_id).toBe(TIER_MED);
  });
});
