/**
 * BI-2b: `dispatchStripeEvent` invoice branch.
 *
 * Spec: docs/specs/branded-invoicing.md §7.2.
 *   - `payment_intent.succeeded` with `metadata.product_type="invoice"` →
 *     flips invoice → paid, stamps PI id, back-fills
 *     `deals.stripe_customer_id`.
 *   - Re-delivery of the same event is a no-op (idempotent via
 *     `markInvoicePaid`).
 *   - `payment_intent.payment_failed` logs an `invoice_payment_failed`
 *     activity row; invoice status unchanged.
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

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(
  process.cwd(),
  "tests/.test-bi2b-pi-invoice.db",
);
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "pipeline.stripe_webhook_dispatch_enabled") return true;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

const { dispatchStripeEvent } = await import("@/lib/stripe/webhook-handlers");
const { invoices } = await import("@/lib/db/schema/invoices");
const { companies } = await import("@/lib/db/schema/companies");
const { contacts } = await import("@/lib/db/schema/contacts");
const { deals } = await import("@/lib/db/schema/deals");
const { activity_log } = await import("@/lib/db/schema/activity-log");

const NOW = 1_700_000_000_000;

function seedSentInvoice(overrides: {
  status?: "sent" | "overdue" | "paid";
  stripePaymentIntentId?: string | null;
  dealCustomerId?: string | null;
} = {}): { invoiceId: string; dealId: string; companyId: string } {
  const companyId = "co-" + randomUUID();
  testDb
    .insert(companies)
    .values({
      id: companyId,
      name: "Acme",
      name_normalised: "acme",
      billing_mode: "stripe",
      gst_applicable: true,
      payment_terms_days: 14,
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  const contactId = "c-" + randomUUID();
  testDb
    .insert(contacts)
    .values({
      id: contactId,
      company_id: companyId,
      name: "Sam",
      email: "sam@acme.test",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  const dealId = "d-" + randomUUID();
  testDb
    .insert(deals)
    .values({
      id: dealId,
      company_id: companyId,
      title: "Acme",
      stage: "won",
      primary_contact_id: contactId,
      subscription_state: "active",
      stripe_customer_id: overrides.dealCustomerId ?? null,
      last_stage_change_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  const invoiceId = "inv-" + randomUUID();
  testDb
    .insert(invoices)
    .values({
      id: invoiceId,
      invoice_number: `SB-INV-2026-${Math.floor(Math.random() * 9999)
        .toString()
        .padStart(4, "0")}`,
      deal_id: dealId,
      company_id: companyId,
      token: randomUUID(),
      status: overrides.status ?? "sent",
      issue_date_ms: NOW,
      due_at_ms: NOW + 14 * 24 * 60 * 60 * 1000,
      total_cents_inc_gst: 275_00,
      total_cents_ex_gst: 250_00,
      gst_cents: 25_00,
      gst_applicable: true,
      line_items_json: [
        {
          description: "Monthly retainer",
          quantity: 1,
          unit_price_cents_inc_gst: 275_00,
          line_total_cents_inc_gst: 275_00,
          is_recurring: true,
        },
      ],
      stripe_payment_intent_id: overrides.stripePaymentIntentId ?? null,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return { invoiceId, dealId, companyId };
}

function makeSucceededEvent(
  pi: Partial<Stripe.PaymentIntent>,
): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`,
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_" + randomUUID(),
        object: "payment_intent",
        amount: 275_00,
        currency: "aud",
        status: "succeeded",
        metadata: {},
        ...pi,
      } as unknown as Stripe.PaymentIntent,
    },
  } as unknown as Stripe.Event;
}

function makeFailedEvent(
  pi: Partial<Stripe.PaymentIntent>,
): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`,
    type: "payment_intent.payment_failed",
    data: {
      object: {
        id: "pi_" + randomUUID(),
        object: "payment_intent",
        amount: 275_00,
        currency: "aud",
        metadata: {},
        ...pi,
      } as unknown as Stripe.PaymentIntent,
    },
  } as unknown as Stripe.Event;
}

beforeAll(() => {
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite, { schema });
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
  testDb.delete(activity_log).run();
  testDb.delete(invoices).run();
  testDb.delete(deals).run();
  testDb.delete(contacts).run();
  testDb.delete(companies).run();
});

describe("dispatchStripeEvent — invoice PI succeeded", () => {
  it("missing invoice_id → result='error'", async () => {
    const event = makeSucceededEvent({
      metadata: { product_type: "invoice" },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: testDb });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toBe("missing_metadata.invoice_id");
  });

  it("unknown invoice_id → result='error' (not thrown)", async () => {
    const event = makeSucceededEvent({
      metadata: { product_type: "invoice", invoice_id: "inv-missing" },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: testDb });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toMatch(/invoice_not_found:inv-missing/);
  });

  it("flips sent → paid, stamps PI id + paid_via=stripe", async () => {
    const { invoiceId } = seedSentInvoice();
    const event = makeSucceededEvent({
      metadata: { product_type: "invoice", invoice_id: invoiceId },
    });
    const piId = (event.data.object as Stripe.PaymentIntent).id;
    const outcome = await dispatchStripeEvent(event, { dbArg: testDb });
    expect(outcome.result).toBe("ok");

    const row = testDb
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .get();
    expect(row?.status).toBe("paid");
    expect(row?.paid_via).toBe("stripe");
    expect(row?.stripe_payment_intent_id).toBe(piId);
    expect(row?.paid_at_ms).toBeGreaterThan(0);
  });

  it("re-delivery of the same event is a no-op (idempotent)", async () => {
    const { invoiceId } = seedSentInvoice();
    const event = makeSucceededEvent({
      metadata: { product_type: "invoice", invoice_id: invoiceId },
    });
    await dispatchStripeEvent(event, { dbArg: testDb });
    const firstPaidAt = testDb
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .get()?.paid_at_ms;

    const second = await dispatchStripeEvent(event, { dbArg: testDb });
    expect(second.result).toBe("ok");

    const row = testDb
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .get();
    expect(row?.status).toBe("paid");
    expect(row?.paid_at_ms).toBe(firstPaidAt);

    // Exactly one invoice_paid_online log — no duplicates.
    const logs = testDb
      .select()
      .from(activity_log)
      .where(eq(activity_log.kind, "invoice_paid_online"))
      .all();
    expect(logs.length).toBe(1);
  });

  it("back-fills deals.stripe_customer_id when absent on deal", async () => {
    const { invoiceId, dealId } = seedSentInvoice({ dealCustomerId: null });
    const event = makeSucceededEvent({
      customer: "cus_from_pi",
      metadata: { product_type: "invoice", invoice_id: invoiceId },
    });
    await dispatchStripeEvent(event, { dbArg: testDb });

    const deal = testDb
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();
    expect(deal?.stripe_customer_id).toBe("cus_from_pi");
  });

  it("leaves deals.stripe_customer_id alone when already set", async () => {
    const { invoiceId, dealId } = seedSentInvoice({
      dealCustomerId: "cus_existing",
    });
    const event = makeSucceededEvent({
      customer: "cus_from_pi",
      metadata: { product_type: "invoice", invoice_id: invoiceId },
    });
    await dispatchStripeEvent(event, { dbArg: testDb });
    const deal = testDb
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();
    expect(deal?.stripe_customer_id).toBe("cus_existing");
  });
});

describe("dispatchStripeEvent — invoice PI failed", () => {
  it("missing invoice_id → result='error'", async () => {
    const event = makeFailedEvent({
      metadata: { product_type: "invoice" },
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: testDb });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toBe("missing_metadata.invoice_id");
  });

  it("logs invoice_payment_failed; invoice stays in sent", async () => {
    const { invoiceId, companyId } = seedSentInvoice();
    const event = makeFailedEvent({
      metadata: { product_type: "invoice", invoice_id: invoiceId },
      last_payment_error: {
        code: "card_declined",
        message: "Your card was declined.",
      } as unknown as Stripe.PaymentIntent.LastPaymentError,
    });
    const outcome = await dispatchStripeEvent(event, { dbArg: testDb });
    expect(outcome.result).toBe("ok");

    const row = testDb
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .get();
    expect(row?.status).toBe("sent");

    const logs = testDb
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, companyId))
      .all();
    const failure = logs.find(
      (r: { meta: { kind?: string } | null }) =>
        (r.meta as { kind?: string } | null)?.kind === "invoice_payment_failed",
    );
    expect(failure).toBeDefined();
    const meta = failure!.meta as Record<string, unknown>;
    expect(meta.failure_code).toBe("card_declined");
    expect(meta.failure_message).toBe("Your card was declined.");
    expect(meta.invoice_id).toBe(invoiceId);
  });
});
