/**
 * SP-7: `dispatchStripeEvent` — `checkout.session.completed` branch.
 * Hermetic in-process SQLite; settings.get is mocked to return the
 * kill-switch = true case. A dedicated test file covers the false case.
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
import { deals, type DealStage } from "@/lib/db/schema/deals";
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

const TEST_DB = path.join(process.cwd(), "tests/.test-sp7-dispatch.db");
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
});

function seedDeal(stage: DealStage): {
  dealId: string;
  companyId: string;
} {
  const nowMs = 1_700_000_000_000;
  const companyId = randomUUID();
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
  const dealId = randomUUID();
  db.insert(deals)
    .values({
      id: dealId,
      company_id: companyId,
      title: "Acme deal",
      stage,
      value_estimated: true,
      pause_used_this_commitment: false,
      last_stage_change_at_ms: nowMs,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    })
    .run();
  return { dealId, companyId };
}

function makeEvent(
  session: Partial<Stripe.Checkout.Session>,
): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_" + randomUUID(),
        object: "checkout.session",
        currency: "aud",
        amount_total: 40000,
        metadata: {},
        ...session,
      } as unknown as Stripe.Checkout.Session,
    },
    // remaining event fields unused by the dispatcher
  } as unknown as Stripe.Event;
}

describe("dispatchStripeEvent — checkout.session.completed", () => {
  it("intro product → marks company trial_shoot_status='booked' + deal→trial_shoot", async () => {
    const { dealId, companyId } = seedDeal("conversation");
    const event = makeEvent({
      metadata: { deal_id: dealId, product_type: "intro" },
    });
    const outcome = await dispatchStripeEvent(event, {
      dbArg: db,
      nowMs: 1_800_000_000_000,
    });
    expect(outcome.result).toBe("ok");

    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.stage).toBe("trial_shoot");

    const company = db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .get();
    expect(company?.trial_shoot_status).toBe("booked");

    const logs = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.deal_id, dealId))
      .all();
    // stage_change + trial_shoot_booked
    expect(logs.some((r) => r.kind === "stage_change")).toBe(true);
    expect(logs.some((r) => r.kind === "trial_shoot_booked")).toBe(true);
  });

  it("retainer product → deal finalised as Won with value_cents stamped", async () => {
    const { dealId } = seedDeal("quoted");
    const event = makeEvent({
      amount_total: 250000,
      metadata: { deal_id: dealId, product_type: "retainer" },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");
    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.stage).toBe("won");
    expect(deal?.won_outcome).toBe("retainer");
    expect(deal?.value_cents).toBe(250000);
    expect(deal?.value_estimated).toBe(false);
  });

  it("saas product → deal finalised as Won with outcome='saas'", async () => {
    const { dealId } = seedDeal("negotiating");
    const event = makeEvent({
      amount_total: 9900,
      metadata: { deal_id: dealId, product_type: "saas" },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");
    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.stage).toBe("won");
    expect(deal?.won_outcome).toBe("saas");
    expect(deal?.value_cents).toBe(9900);
  });

  it("missing metadata.deal_id → result='error' with diagnostic reason", async () => {
    const event = makeEvent({ metadata: { product_type: "retainer" } });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/missing_metadata\.deal_id/);
  });

  it("unknown product_type → result='error'", async () => {
    const { dealId } = seedDeal("quoted");
    const event = makeEvent({
      metadata: { deal_id: dealId, product_type: "subscription" },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/missing_or_unknown_metadata\.product_type/);
  });

  it("retainer with null amount_total → result='error'", async () => {
    const { dealId } = seedDeal("quoted");
    const event = makeEvent({
      amount_total: null,
      metadata: { deal_id: dealId, product_type: "retainer" },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/missing_amount_total/);
  });

  it("unknown deal id → recorded as error, not thrown", async () => {
    const event = makeEvent({
      metadata: { deal_id: randomUUID(), product_type: "retainer" },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/not found/);
  });

  it("illegal stage transition (lead → won) → recorded as error", async () => {
    const { dealId } = seedDeal("lead");
    const event = makeEvent({
      amount_total: 100000,
      metadata: { deal_id: dealId, product_type: "retainer" },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/illegal transition/);
    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    expect(deal?.stage).toBe("lead");
  });

  it("intro on a deal already in trial_shoot → still ok, still booked", async () => {
    const { dealId, companyId } = seedDeal("trial_shoot");
    const event = makeEvent({
      metadata: { deal_id: dealId, product_type: "intro" },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");
    const company = db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .get();
    expect(company?.trial_shoot_status).toBe("booked");
  });
});
