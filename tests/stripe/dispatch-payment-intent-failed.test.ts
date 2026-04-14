/**
 * QB-5: `dispatchStripeEvent` — `payment_intent.payment_failed` branch.
 * Spec §7.1: quote status stays `accepted` on payment failure; handler
 * only logs. Non-quote PIs are skipped.
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
import { deals } from "@/lib/db/schema/deals";
import { quotes } from "@/lib/db/schema/quotes";
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

const TEST_DB = path.join(process.cwd(), "tests/.test-qb5-pi-failed.db");
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
    "DELETE FROM activity_log; DELETE FROM quotes; DELETE FROM deals; DELETE FROM contacts; DELETE FROM companies;",
  );
});

function seedAcceptedQuote(): {
  quoteId: string;
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
      stage: "negotiating",
      value_estimated: true,
      pause_used_this_commitment: false,
      last_stage_change_at_ms: nowMs,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    })
    .run();
  const quoteId = randomUUID();
  db.insert(quotes)
    .values({
      id: quoteId,
      deal_id: dealId,
      company_id: companyId,
      token: randomUUID(),
      quote_number: `SB-2026-${Math.floor(Math.random() * 9999)}`,
      status: "accepted",
      structure: "retainer",
      total_cents_inc_gst: 250000,
      retainer_monthly_cents_inc_gst: 250000,
      one_off_cents_inc_gst: 0,
      buyout_percentage: 50,
      created_at_ms: nowMs,
    })
    .run();
  return { quoteId, dealId, companyId };
}

function makeEvent(
  pi: Partial<Stripe.PaymentIntent>,
): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`,
    type: "payment_intent.payment_failed",
    data: {
      object: {
        id: "pi_test_" + randomUUID(),
        object: "payment_intent",
        amount: 250000,
        currency: "aud",
        metadata: {},
        ...pi,
      } as unknown as Stripe.PaymentIntent,
    },
  } as unknown as Stripe.Event;
}

describe("dispatchStripeEvent — payment_intent.payment_failed", () => {
  it("non-quote product_type → skipped (covered_by_checkout_session)", async () => {
    const event = makeEvent({
      metadata: { product_type: "intro", deal_id: randomUUID() },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("covered_by_checkout_session");
  });

  it("missing product_type → skipped", async () => {
    const event = makeEvent({ metadata: {} });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("covered_by_checkout_session");
  });

  it("quote PI missing quote_id → result='error'", async () => {
    const event = makeEvent({
      metadata: { product_type: "quote", deal_id: randomUUID() },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/missing_metadata\.quote_or_deal_id/);
  });

  it("quote PI unknown quote_id → result='error' (not thrown)", async () => {
    const event = makeEvent({
      metadata: {
        product_type: "quote",
        quote_id: randomUUID(),
        deal_id: randomUUID(),
      },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/quote_not_found:/);
  });

  it("quote PI with failure detail → logs quote_payment_failed, quote stays accepted", async () => {
    const { quoteId, dealId, companyId } = seedAcceptedQuote();
    const event = makeEvent({
      metadata: {
        product_type: "quote",
        quote_id: quoteId,
        deal_id: dealId,
      },
      last_payment_error: {
        code: "card_declined",
        message: "Your card was declined.",
      } as unknown as Stripe.PaymentIntent.LastPaymentError,
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const quote = db
      .select()
      .from(quotes)
      .where(eq(quotes.id, quoteId))
      .get();
    expect(quote?.status).toBe("accepted");

    const logs = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, companyId))
      .all();
    const failureLog = logs.find(
      (r) =>
        r.kind === "note" &&
        (r.meta as { kind?: string } | null)?.kind === "quote_payment_failed",
    );
    expect(failureLog).toBeDefined();
    const meta = failureLog!.meta as Record<string, unknown>;
    expect(meta.failure_code).toBe("card_declined");
    expect(meta.failure_message).toBe("Your card was declined.");
    expect(meta.quote_id).toBe(quoteId);
  });

  it("quote PI with no failure detail → logs with 'unknown' reason + null codes", async () => {
    const { quoteId, dealId } = seedAcceptedQuote();
    const event = makeEvent({
      metadata: {
        product_type: "quote",
        quote_id: quoteId,
        deal_id: dealId,
      },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: db });
    expect(outcome.result).toBe("ok");

    const logs = db.select().from(activity_log).all();
    const failureLog = logs.find(
      (r) =>
        (r.meta as { kind?: string } | null)?.kind === "quote_payment_failed",
    );
    expect(failureLog).toBeDefined();
    expect(failureLog!.body).toMatch(/unknown/);
    const meta = failureLog!.meta as Record<string, unknown>;
    expect(meta.failure_code).toBeNull();
    expect(meta.failure_message).toBeNull();
  });
});
