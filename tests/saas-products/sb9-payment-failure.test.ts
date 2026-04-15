/**
 * SB-9 — SaaS payment-failure lockout + recovery + data-loss escalation.
 *
 * Covers the scenarios in the SB-9 brief AC #9 that aren't already asserted
 * in `tests/stripe/dispatch-subscription-lifecycle.test.ts` (which covers
 * the state-transition + counter + log behaviour of the two webhooks):
 *
 *   1. first-failure webhook enqueues the `saas_data_loss_warning` task
 *      with the expected idempotency key + 7-day run_at
 *   2. repeat failure in the same cycle does NOT re-enqueue a task
 *   3. `invoice.payment_succeeded` cancels the pending task on recovery
 *   4. `handleSaasDataLossWarning` no-ops when the deal has recovered
 *   5. `handleSaasDataLossWarning` on still-past_due deal sends the warning
 *      email + logs `saas_data_loss_warning_sent`
 *   6. tier-change rejects past_due (regression — already covered in
 *      sb8-tier-change, re-asserted here as a named SB-9 guard)
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
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "pipeline.stripe_webhook_dispatch_enabled") return true;
      if (key === "saas.data_loss_warning_days") return 7;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

const sentLockout: unknown[] = [];
const sentWarning: unknown[] = [];
vi.mock("@/lib/emails/saas-payment-recovery", () => ({
  sendSaasPaymentFailedLockoutEmail: vi.fn(async (input: unknown) => {
    sentLockout.push(input);
  }),
  sendSaasDataLossWarningEmail: vi.fn(async (input: unknown) => {
    sentWarning.push(input);
  }),
}));

let testDb: ReturnType<typeof drizzle>;
vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { saas_products } from "@/lib/db/schema/saas-products";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import { activity_log } from "@/lib/db/schema/activity-log";
import { dispatchStripeEvent } from "@/lib/stripe/webhook-handlers";
import { handleSaasDataLossWarning } from "@/lib/scheduled-tasks/handlers/saas-data-loss-warning";

const TEST_DB = path.join(process.cwd(), "tests/.test-sb9-payment-failure.db");
let sqlite: Database.Database;

beforeAll(() => {
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
  drizzleMigrate(testDb, {
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

beforeEach(() => {
  sqlite.exec(
    "DELETE FROM scheduled_tasks; DELETE FROM activity_log; DELETE FROM deals; DELETE FROM contacts; DELETE FROM companies; DELETE FROM saas_products;",
  );
  sentLockout.length = 0;
  sentWarning.length = 0;
});

const NOW = 1_700_000_000_000;
const PRODUCT_ID = "sb9-prod";

function seedDeal(opts?: {
  state?: "active" | "past_due" | "paused";
  failureCount?: number;
  firstFailureMs?: number | null;
}) {
  const companyId = randomUUID();
  const contactId = randomUUID();
  const dealId = randomUUID();
  const subId = `sub_${randomUUID()}`;
  testDb.insert(saas_products).values({
    id: PRODUCT_ID,
    name: "Widget Pro",
    slug: "widget-pro",
    status: "active",
    demo_enabled: false,
    display_order: 0,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  }).onConflictDoNothing().run();
  testDb.insert(companies).values({
    id: companyId,
    name: "Acme",
    name_normalised: "acme",
    billing_mode: "stripe",
    do_not_contact: false,
    trial_shoot_status: "none",
    first_seen_at_ms: NOW,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  }).run();
  testDb.insert(contacts).values({
    id: contactId,
    company_id: companyId,
    name: "A",
    email: "a@acme.test",
    email_normalised: "a@acme.test",
    email_status: "unknown",
    is_primary: true,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  }).run();
  testDb.insert(deals).values({
    id: dealId,
    company_id: companyId,
    primary_contact_id: contactId,
    title: "Sub",
    stage: "won",
    value_estimated: false,
    pause_used_this_commitment: false,
    last_stage_change_at_ms: NOW,
    created_at_ms: NOW,
    updated_at_ms: NOW,
    stripe_subscription_id: subId,
    subscription_state: opts?.state ?? "active",
    saas_product_id: PRODUCT_ID,
    payment_failure_count: opts?.failureCount ?? 0,
    first_payment_failure_at_ms: opts?.firstFailureMs ?? null,
  }).run();
  return { companyId, contactId, dealId, subId };
}

function invoiceEvent(
  type: "invoice.payment_failed" | "invoice.payment_succeeded",
  invoice: Partial<Stripe.Invoice>,
): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`,
    type,
    data: {
      object: {
        id: `in_${randomUUID()}`,
        object: "invoice",
        ...invoice,
      } as unknown as Stripe.Invoice,
    },
  } as unknown as Stripe.Event;
}

describe("SB-9: invoice.payment_failed → enqueue data-loss warning", () => {
  it("first-failure enqueues `saas_data_loss_warning` with 7-day run_at + idempotency key", async () => {
    const { dealId, subId } = seedDeal();
    const event = invoiceEvent("invoice.payment_failed", {
      subscription: subId,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: testDb });
    expect(outcome.result).toBe("ok");

    const tasks = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.task_type, "saas_data_loss_warning"))
      .all();
    expect(tasks.length).toBe(1);
    const task = tasks[0];
    expect(task.status).toBe("pending");
    const payload = task.payload as { deal_id: string; first_failure_at_ms: number };
    expect(payload.deal_id).toBe(dealId);
    expect(task.idempotency_key).toBe(
      `saas_data_loss:${dealId}:${payload.first_failure_at_ms}`,
    );
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(task.run_at_ms - payload.first_failure_at_ms).toBe(sevenDaysMs);
  });

  it("repeat failure in same cycle does NOT enqueue a second task", async () => {
    const { subId } = seedDeal({
      state: "past_due",
      failureCount: 1,
      firstFailureMs: NOW - 24 * 60 * 60 * 1000,
    });
    const event = invoiceEvent("invoice.payment_failed", {
      subscription: subId,
    } as Partial<Stripe.Invoice>);
    await dispatchStripeEvent(event, { dbArg: testDb });

    const tasks = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.task_type, "saas_data_loss_warning"))
      .all();
    expect(tasks.length).toBe(0);
  });
});

describe("SB-9: invoice.payment_succeeded → cancel pending task", () => {
  it("flips pending `saas_data_loss_warning` task to `skipped` on recovery", async () => {
    const firstFailureMs = NOW - 2 * 24 * 60 * 60 * 1000;
    const { dealId, subId } = seedDeal({
      state: "past_due",
      failureCount: 1,
      firstFailureMs,
    });
    const taskId = randomUUID();
    testDb.insert(scheduled_tasks).values({
      id: taskId,
      task_type: "saas_data_loss_warning",
      run_at_ms: firstFailureMs + 7 * 24 * 60 * 60 * 1000,
      payload: { deal_id: dealId, first_failure_at_ms: firstFailureMs },
      status: "pending",
      attempts: 0,
      idempotency_key: `saas_data_loss:${dealId}:${firstFailureMs}`,
      created_at_ms: firstFailureMs,
    }).run();

    const event = invoiceEvent("invoice.payment_succeeded", {
      subscription: subId,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: testDb });
    expect(outcome.result).toBe("ok");

    const row = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, taskId))
      .get();
    expect(row?.status).toBe("skipped");
    expect(row?.done_at_ms).not.toBeNull();
  });
});

describe("SB-9: handleSaasDataLossWarning handler", () => {
  it("no-ops silently when deal has recovered (state = active)", async () => {
    const { dealId, companyId } = seedDeal({ state: "active" });
    await handleSaasDataLossWarning({
      id: "t1",
      task_type: "saas_data_loss_warning",
      run_at_ms: NOW,
      payload: { deal_id: dealId, first_failure_at_ms: NOW - 7 * 86_400_000 },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: NOW,
      last_error: null,
      idempotency_key: `saas_data_loss:${dealId}:${NOW - 7 * 86_400_000}`,
      created_at_ms: NOW - 7 * 86_400_000,
      done_at_ms: null,
      reclaimed_at_ms: null,
    });

    expect(sentWarning.length).toBe(0);
    const logs = testDb
      .select()
      .from(activity_log)
      .where(
        and(
          eq(activity_log.company_id, companyId),
          eq(activity_log.kind, "saas_data_loss_warning_sent"),
        ),
      )
      .all();
    expect(logs.length).toBe(0);
  });

  it("sends email + logs `saas_data_loss_warning_sent` when still past_due", async () => {
    const firstFailureMs = NOW - 7 * 86_400_000;
    const { dealId, companyId } = seedDeal({
      state: "past_due",
      failureCount: 3,
      firstFailureMs,
    });
    await handleSaasDataLossWarning({
      id: "t1",
      task_type: "saas_data_loss_warning",
      run_at_ms: NOW,
      payload: { deal_id: dealId, first_failure_at_ms: firstFailureMs },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: NOW,
      last_error: null,
      idempotency_key: `saas_data_loss:${dealId}:${firstFailureMs}`,
      created_at_ms: firstFailureMs,
      done_at_ms: null,
      reclaimed_at_ms: null,
    });

    expect(sentWarning.length).toBe(1);
    const sent = sentWarning[0] as { to: string; productName: string };
    expect(sent.to).toBe("a@acme.test");
    expect(sent.productName).toBe("Widget Pro");

    const logs = testDb
      .select()
      .from(activity_log)
      .where(
        and(
          eq(activity_log.company_id, companyId),
          eq(activity_log.kind, "saas_data_loss_warning_sent"),
        ),
      )
      .all();
    expect(logs.length).toBe(1);
  });
});

describe("SB-9: tier-change regression guard", () => {
  it("applyTierChange rejects when subscription_state is past_due", async () => {
    const { dealId } = seedDeal({ state: "past_due" });
    // Seed a second tier so the call has a valid target shape.
    sqlite
      .prepare(
        `INSERT INTO saas_tiers (id, product_id, name, tier_rank, monthly_price_cents_inc_gst, setup_fee_cents_inc_gst, stripe_monthly_price_id, created_at_ms, updated_at_ms)
         VALUES ('t-current', ?, 'S', 1, 4900, 0, 'price_s', ?, ?),
                ('t-upgrade', ?, 'L', 2, 9900, 0, 'price_l', ?, ?)`,
      )
      .run(PRODUCT_ID, NOW, NOW, PRODUCT_ID, NOW, NOW);
    sqlite
      .prepare("UPDATE deals SET saas_tier_id = 't-current' WHERE id = ?")
      .run(dealId);

    const { applyTierChange, TierChangeError } = await import(
      "@/lib/saas-products/tier-change"
    );
    await expect(
      applyTierChange(dealId, "t-upgrade", {
        mode: "upgrade",
        nowMs: NOW,
      }),
    ).rejects.toBeInstanceOf(TierChangeError);
  });
});
