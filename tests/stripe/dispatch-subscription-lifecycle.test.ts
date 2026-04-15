/**
 * Subscription-lifecycle webhook dispatch tests.
 * Closes PATCHES_OWED `qb4c_subscription_lifecycle_webhooks`.
 *
 * Covers: customer.subscription.updated, customer.subscription.deleted,
 * invoice.payment_failed, invoice.payment_succeeded.
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
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";

import { companies } from "@/lib/db/schema/companies";
import { deals, type DealSubscriptionState } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "pipeline.stripe_webhook_dispatch_enabled") return true;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

import { dispatchStripeEvent } from "@/lib/stripe/webhook-handlers";
import settings from "@/lib/settings";

const TEST_DB = path.join(process.cwd(), "tests/.test-subs-lifecycle.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: ReturnType<typeof drizzle<any>>;

beforeAll(() => {
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
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

beforeEach(() => {
  sqlite.exec(
    "DELETE FROM activity_log; DELETE FROM deals; DELETE FROM contacts; DELETE FROM companies;",
  );
  vi.mocked(settings.get).mockImplementation(async (key: string) => {
    if (key === "pipeline.stripe_webhook_dispatch_enabled") return true;
    if (key === "saas.data_loss_warning_days") return 7;
    throw new Error(`Unexpected settings key: ${key}`);
  });
});

function seedSubscribedDeal(opts?: {
  subscription_state?: DealSubscriptionState;
  subscription_id?: string;
}): { dealId: string; companyId: string; subId: string } {
  const nowMs = 1_700_000_000_000;
  const companyId = randomUUID();
  const dealId = randomUUID();
  const subId = opts?.subscription_id ?? `sub_${randomUUID()}`;
  db.insert(companies)
    .values({
      id: companyId,
      name: "Acme",
      name_normalised: "acme",
      billing_mode: "stripe",
      do_not_contact: false,
      trial_shoot_status: "none",
      first_seen_at_ms: nowMs,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    })
    .run();
  db.insert(deals)
    .values({
      id: dealId,
      company_id: companyId,
      title: "Acme retainer",
      stage: "won",
      value_estimated: false,
      pause_used_this_commitment: false,
      last_stage_change_at_ms: nowMs,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
      stripe_subscription_id: subId,
      subscription_state: opts?.subscription_state ?? "active",
    })
    .run();
  return { dealId, companyId, subId };
}

function subEvent(
  type: "customer.subscription.updated" | "customer.subscription.deleted",
  sub: Partial<Stripe.Subscription> & { id: string; status: Stripe.Subscription.Status },
): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`,
    type,
    data: {
      object: {
        object: "subscription",
        metadata: {},
        ...sub,
      } as unknown as Stripe.Subscription,
    },
  } as unknown as Stripe.Event;
}

function invoiceEvent(
  type: "invoice.payment_failed" | "invoice.payment_succeeded",
  invoice: Partial<Stripe.Invoice> & { id?: string },
): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`,
    type,
    data: {
      object: {
        id: invoice.id ?? `in_${randomUUID()}`,
        object: "invoice",
        ...invoice,
      } as unknown as Stripe.Invoice,
    },
  } as unknown as Stripe.Event;
}

describe("dispatchStripeEvent — customer.subscription.updated", () => {
  it("kill switch off → skipped", async () => {
    vi.mocked(settings.get).mockImplementation(async () => false);
    const { subId } = seedSubscribedDeal();
    const event = subEvent("customer.subscription.updated", {
      id: subId,
      status: "past_due",
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("kill_switch");
  });

  it("unknown subscription id → error", async () => {
    const event = subEvent("customer.subscription.updated", {
      id: `sub_${randomUUID()}`,
      status: "active",
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/deal_not_found_for_subscription:/);
  });

  it("active → past_due transition updates state + logs", async () => {
    const { dealId, companyId, subId } = seedSubscribedDeal();
    const event = subEvent("customer.subscription.updated", {
      id: subId,
      status: "past_due",
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("past_due");

    const logs = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, companyId))
      .all();
    const change = logs.find(
      (r) =>
        (r.meta as { kind?: string } | null)?.kind === "subscription_state_changed",
    );
    expect(change).toBeDefined();
    const meta = change!.meta as Record<string, unknown>;
    expect(meta.previous_state).toBe("active");
    expect(meta.new_state).toBe("past_due");
    expect(meta.stripe_status).toBe("past_due");
  });

  it("unpaid → past_due (Stripe 'unpaid' maps to past_due)", async () => {
    const { dealId, subId } = seedSubscribedDeal();
    const event = subEvent("customer.subscription.updated", {
      id: subId,
      status: "unpaid",
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("past_due");
  });

  it("idempotent replay: already-past_due + status=past_due → no new log", async () => {
    const { dealId, companyId, subId } = seedSubscribedDeal({
      subscription_state: "past_due",
    });
    const event = subEvent("customer.subscription.updated", {
      id: subId,
      status: "past_due",
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("past_due");

    const logs = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, companyId))
      .all();
    expect(logs.length).toBe(0);
  });

  it("canceled status → skipped (handled by .deleted)", async () => {
    const { dealId, subId } = seedSubscribedDeal();
    const event = subEvent("customer.subscription.updated", {
      id: subId,
      status: "canceled",
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("unhandled_status:canceled");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("active");
  });

  it("trialing status → skipped", async () => {
    const { subId } = seedSubscribedDeal();
    const event = subEvent("customer.subscription.updated", {
      id: subId,
      status: "trialing",
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("unhandled_status:trialing");
  });

  it("past_due → active (recovery path via .updated)", async () => {
    const { dealId, subId } = seedSubscribedDeal({
      subscription_state: "past_due",
    });
    const event = subEvent("customer.subscription.updated", {
      id: subId,
      status: "active",
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("active");
  });
});

describe("dispatchStripeEvent — customer.subscription.deleted", () => {
  it("kill switch off → skipped", async () => {
    vi.mocked(settings.get).mockImplementation(async () => false);
    const { subId } = seedSubscribedDeal();
    const event = subEvent("customer.subscription.deleted", {
      id: subId,
      status: "canceled",
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("kill_switch");
  });

  it("unknown subscription id → error", async () => {
    const event = subEvent("customer.subscription.deleted", {
      id: `sub_${randomUUID()}`,
      status: "canceled",
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/deal_not_found_for_subscription:/);
  });

  it("known subscription → logs handshake, no state write", async () => {
    const { dealId, companyId, subId } = seedSubscribedDeal({
      subscription_state: "cancelled_buyout",
    });
    const event = subEvent("customer.subscription.deleted", {
      id: subId,
      status: "canceled",
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("cancelled_buyout");

    const logs = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, companyId))
      .all();
    const handshake = logs.find(
      (r) =>
        (r.meta as { kind?: string } | null)?.kind ===
        "subscription_cancelled_stripe_initiated",
    );
    expect(handshake).toBeDefined();
    const meta = handshake!.meta as Record<string, unknown>;
    expect(meta.stripe_subscription_id).toBe(subId);
    expect(meta.current_state).toBe("cancelled_buyout");
  });
});

describe("dispatchStripeEvent — invoice.payment_failed", () => {
  it("kill switch off → skipped", async () => {
    vi.mocked(settings.get).mockImplementation(async () => false);
    const { subId } = seedSubscribedDeal();
    const event = invoiceEvent("invoice.payment_failed", {
      subscription: subId,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("kill_switch");
  });

  it("one-off invoice (no subscription) → skipped", async () => {
    const event = invoiceEvent("invoice.payment_failed", {
      subscription: null,
    } as unknown as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("not_subscription_invoice");
  });

  it("unknown subscription id → error", async () => {
    const event = invoiceEvent("invoice.payment_failed", {
      subscription: `sub_${randomUUID()}`,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/deal_not_found_for_subscription:/);
  });

  it("active → past_due transition + failure meta captured", async () => {
    const { dealId, companyId, subId } = seedSubscribedDeal();
    const event = invoiceEvent("invoice.payment_failed", {
      subscription: subId,
      attempt_count: 2,
      next_payment_attempt: 1_700_000_000,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("past_due");

    const logs = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, companyId))
      .all();
    const failure = logs.find(
      (r) =>
        (r.meta as { kind?: string } | null)?.kind ===
        "subscription_payment_failed",
    );
    expect(failure).toBeDefined();
    const meta = failure!.meta as Record<string, unknown>;
    expect(meta.attempt_count).toBe(2);
    expect(meta.next_payment_attempt_unix).toBe(1_700_000_000);
    expect(meta.new_state).toBe("past_due");
  });

  it("repeat failure within same cycle → counter increments, no new log", async () => {
    // SB-9: second payment_failed in the same cycle increments the
    // per-cycle counter but does not emit another activity log (first
    // failure's log is authoritative for the cycle) and does not
    // re-enqueue the data-loss warning task.
    const { dealId, companyId, subId } = seedSubscribedDeal({
      subscription_state: "past_due",
    });
    // Simulate prior first failure having stamped the counter.
    db.update(deals)
      .set({ payment_failure_count: 1, first_payment_failure_at_ms: 1_600_000_000_000 })
      .where(eq(deals.id, dealId))
      .run();
    const event = invoiceEvent("invoice.payment_failed", {
      subscription: subId,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("past_due");
    expect(deal?.payment_failure_count).toBe(2);

    const logs = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, companyId))
      .all();
    expect(logs.length).toBe(0);
  });

  it("paused state → no-op (guarded against spurious transition)", async () => {
    const { dealId, subId } = seedSubscribedDeal({
      subscription_state: "paused",
    });
    const event = invoiceEvent("invoice.payment_failed", {
      subscription: subId,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("paused");
  });
});

describe("dispatchStripeEvent — invoice.payment_succeeded", () => {
  it("kill switch off → skipped", async () => {
    vi.mocked(settings.get).mockImplementation(async () => false);
    const { subId } = seedSubscribedDeal();
    const event = invoiceEvent("invoice.payment_succeeded", {
      subscription: subId,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("kill_switch");
  });

  it("one-off invoice (no subscription) → skipped", async () => {
    const event = invoiceEvent("invoice.payment_succeeded", {
      subscription: null,
    } as unknown as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("not_subscription_invoice");
  });

  it("unknown subscription id → error", async () => {
    const event = invoiceEvent("invoice.payment_succeeded", {
      subscription: `sub_${randomUUID()}`,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/deal_not_found_for_subscription:/);
  });

  it("past_due → active recovery logs + updates", async () => {
    const { dealId, companyId, subId } = seedSubscribedDeal({
      subscription_state: "past_due",
    });
    const event = invoiceEvent("invoice.payment_succeeded", {
      subscription: subId,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("active");

    const logs = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, companyId))
      .all();
    const recovered = logs.find(
      (r) =>
        (r.meta as { kind?: string } | null)?.kind ===
        "subscription_payment_recovered",
    );
    expect(recovered).toBeDefined();
    const meta = recovered!.meta as Record<string, unknown>;
    expect(meta.previous_state).toBe("past_due");
    expect(meta.new_state).toBe("active");
  });

  it("active → no-op on ongoing cycle payment (noise-free)", async () => {
    const { dealId, companyId, subId } = seedSubscribedDeal();
    const event = invoiceEvent("invoice.payment_succeeded", {
      subscription: subId,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("active");

    const logs = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, companyId))
      .all();
    expect(logs.length).toBe(0);
  });

  it("paused state → no-op (won't auto-resume)", async () => {
    const { dealId, subId } = seedSubscribedDeal({
      subscription_state: "paused",
    });
    const event = invoiceEvent("invoice.payment_succeeded", {
      subscription: subId,
    } as Partial<Stripe.Invoice>);
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.subscription_state).toBe("paused");
  });
});
