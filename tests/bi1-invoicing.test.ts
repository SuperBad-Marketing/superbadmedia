import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import * as schema from "@/lib/db/schema";
import type {
  SendEmailParams,
  SendEmailResult,
} from "@/lib/channels/email/send";

const TEST_DB = path.join(process.cwd(), "tests/.test-bi1-invoicing.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

const sendEmailMock = vi.fn<(params: SendEmailParams) => Promise<SendEmailResult>>(
  async () => ({ sent: true, messageId: "msg_inv" }),
);

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: (params: SendEmailParams) => sendEmailMock(params),
}));

const { generateInvoice } = await import("@/lib/invoicing/generate");
const { sendInvoice } = await import("@/lib/invoicing/send");
const { markInvoicePaid } = await import("@/lib/invoicing/mark-paid");
const { sweepOverdueInvoices } = await import("@/lib/invoicing/sweep");
const { INVOICING_HANDLERS } = await import("@/lib/invoicing/handlers");
const { allocateInvoiceNumber } = await import("@/lib/invoicing/sequences");
const { invoices } = await import("@/lib/db/schema/invoices");
const { companies } = await import("@/lib/db/schema/companies");
const { contacts } = await import("@/lib/db/schema/contacts");
const { deals } = await import("@/lib/db/schema/deals");
const { quotes } = await import("@/lib/db/schema/quotes");
const { activity_log } = await import("@/lib/db/schema/activity-log");
const { scheduled_tasks } = await import("@/lib/db/schema/scheduled-tasks");
const { sequences } = await import("@/lib/db/schema/sequences");

const NOW = 1_700_000_000_000;

function seedCoreRows(opts: {
  gst_applicable?: boolean;
  billing_mode?: "stripe" | "manual";
  subscription_state?: "active" | "ended_gracefully";
  committed_until_date_ms?: number | null;
  stage?: "won" | "quoted";
  withAcceptedQuote?: boolean;
} = {}) {
  testDb
    .insert(companies)
    .values({
      id: "co-1",
      name: "Acme",
      name_normalised: "acme",
      billing_mode: opts.billing_mode ?? "manual",
      gst_applicable: opts.gst_applicable ?? true,
      payment_terms_days: 14,
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  testDb
    .insert(contacts)
    .values({
      id: "c-1",
      company_id: "co-1",
      name: "Sam",
      email: "sam@acme.test",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  testDb
    .insert(deals)
    .values({
      id: "deal-1",
      company_id: "co-1",
      title: "Acme",
      stage: opts.stage ?? "won",
      primary_contact_id: "c-1",
      subscription_state: opts.subscription_state ?? "active",
      committed_until_date_ms:
        opts.committed_until_date_ms === undefined
          ? NOW + 365 * 24 * 60 * 60 * 1000
          : opts.committed_until_date_ms,
      last_stage_change_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();

  if (opts.withAcceptedQuote) {
    testDb
      .insert(quotes)
      .values({
        id: "q-1",
        deal_id: "deal-1",
        company_id: "co-1",
        token: "tok-q1",
        quote_number: "SB-2026-0001",
        status: "accepted",
        structure: "retainer",
        content_json: {
          sections: {
            whatWellDo: {
              line_items: [
                {
                  kind: "retainer",
                  qty: 1,
                  unit_price_cents_inc_gst: 110_00,
                  snapshot: { name: "Monthly retainer" },
                },
                {
                  kind: "one_off",
                  qty: 1,
                  unit_price_cents_inc_gst: 55_00,
                  snapshot: { name: "Kickoff setup" },
                },
              ],
            },
          },
        } as unknown as object,
        catalogue_snapshot_json: null,
        total_cents_inc_gst: 165_00,
        retainer_monthly_cents_inc_gst: 110_00,
        one_off_cents_inc_gst: 55_00,
        term_length_months: 12,
        buyout_percentage: 50,
        created_at_ms: NOW,
        sent_at_ms: NOW,
      })
      .run();
  }
}

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
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
  testDb.delete(scheduled_tasks).run();
  testDb.delete(invoices).run();
  testDb.delete(quotes).run();
  testDb.delete(deals).run();
  testDb.delete(contacts).run();
  testDb.delete(companies).run();
  testDb.delete(sequences).run();
  sendEmailMock.mockClear();
  sendEmailMock.mockImplementation(async () => ({
    sent: true,
    messageId: "msg_inv",
  }));
});

describe("allocateInvoiceNumber", () => {
  it("allocates sequential SB-INV-YYYY-NNNN numbers", async () => {
    const a = await allocateInvoiceNumber({ year: 2026, db: testDb });
    const b = await allocateInvoiceNumber({ year: 2026, db: testDb });
    const c = await allocateInvoiceNumber({ year: 2027, db: testDb });
    expect(a).toBe("SB-INV-2026-0001");
    expect(b).toBe("SB-INV-2026-0002");
    expect(c).toBe("SB-INV-2027-0001");
  });
});

describe("generateInvoice", () => {
  it("derives totals with GST and projects cycle-0 line items (retainer + one-off)", async () => {
    seedCoreRows({ withAcceptedQuote: true });
    const r = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.invoice.status).toBe("draft");
    expect(r.invoice.total_cents_inc_gst).toBe(165_00);
    expect(r.invoice.gst_cents).toBe(Math.round(165_00 / 11));
    expect(r.invoice.invoice_number).toMatch(/^SB-INV-\d{4}-0001$/);
    expect(r.invoice.quote_id).toBe("q-1");
    const items = r.invoice.line_items_json as unknown as Array<{
      description: string;
    }>;
    expect(items.map((i) => i.description).sort()).toEqual([
      "Kickoff setup",
      "Monthly retainer",
    ]);
  });

  it("drops one-off items on cycle ≥ 1 (retainer only)", async () => {
    seedCoreRows({ withAcceptedQuote: true });
    const r = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 1, nowMs: NOW },
      testDb,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.invoice.total_cents_inc_gst).toBe(110_00);
    const items = r.invoice.line_items_json as unknown as Array<{
      description: string;
    }>;
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe("Monthly retainer");
  });

  it("zeroes GST when company is not GST-applicable", async () => {
    seedCoreRows({ gst_applicable: false, withAcceptedQuote: true });
    const r = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.invoice.gst_cents).toBe(0);
    expect(r.invoice.total_cents_ex_gst).toBe(r.invoice.total_cents_inc_gst);
  });

  it("returns error when deal is missing", async () => {
    const r = await generateInvoice({ deal_id: "missing", nowMs: NOW }, testDb);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("deal_not_found");
  });
});

describe("sendInvoice", () => {
  it("sends email, transitions draft → sent, logs invoice_sent", async () => {
    seedCoreRows({ withAcceptedQuote: true });
    const gen = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    if (!gen.ok) throw new Error("seed failed");

    const r = await sendInvoice({ invoice_id: gen.invoice.id, nowMs: NOW + 1 }, testDb);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.invoice.status).toBe("sent");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].classification).toBe("invoice_send");

    const logs = testDb.select().from(activity_log).all();
    expect(logs.some((l: { kind: string }) => l.kind === "invoice_sent")).toBe(true);
  });

  it("rejects non-draft invoices", async () => {
    seedCoreRows({ withAcceptedQuote: true });
    const gen = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    if (!gen.ok) throw new Error("seed failed");
    await sendInvoice({ invoice_id: gen.invoice.id, nowMs: NOW + 1 }, testDb);
    const r2 = await sendInvoice({ invoice_id: gen.invoice.id, nowMs: NOW + 2 }, testDb);
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.error).toMatch(/invoice_not_draft/);
  });
});

describe("sweepOverdueInvoices", () => {
  it("flips sent invoices whose due_at has passed to overdue", async () => {
    seedCoreRows({ withAcceptedQuote: true });
    const gen = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    if (!gen.ok) throw new Error("seed failed");
    await sendInvoice({ invoice_id: gen.invoice.id, nowMs: NOW + 1 }, testDb);

    // before due — no flip
    const noFlip = await sweepOverdueInvoices({
      nowMs: gen.invoice.due_at_ms - 1000,
      dbOverride: testDb,
    });
    expect(noFlip).toHaveLength(0);

    // after due — flip
    const flipped = await sweepOverdueInvoices({
      nowMs: gen.invoice.due_at_ms + 1000,
      dbOverride: testDb,
    });
    expect(flipped).toHaveLength(1);
    expect(flipped[0].status).toBe("overdue");

    // idempotent — second sweep finds nothing
    const again = await sweepOverdueInvoices({
      nowMs: gen.invoice.due_at_ms + 2000,
      dbOverride: testDb,
    });
    expect(again).toHaveLength(0);
  });
});

describe("markInvoicePaid", () => {
  it("transitions sent → paid with timestamp + paid_via", async () => {
    seedCoreRows({ withAcceptedQuote: true });
    const gen = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    if (!gen.ok) throw new Error("seed failed");
    await sendInvoice({ invoice_id: gen.invoice.id, nowMs: NOW + 1 }, testDb);

    const r = await markInvoicePaid(
      { invoice_id: gen.invoice.id, paid_via: "bank_transfer", nowMs: NOW + 2 },
      testDb,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.invoice.status).toBe("paid");
    expect(r.invoice.paid_via).toBe("bank_transfer");
    expect(r.invoice.paid_at_ms).toBe(NOW + 2);
    expect(r.alreadyPaid).toBe(false);
  });

  it("is idempotent when invoice already paid", async () => {
    seedCoreRows({ withAcceptedQuote: true });
    const gen = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    if (!gen.ok) throw new Error("seed failed");
    await sendInvoice({ invoice_id: gen.invoice.id, nowMs: NOW + 1 }, testDb);
    await markInvoicePaid(
      { invoice_id: gen.invoice.id, paid_via: "bank_transfer", nowMs: NOW + 2 },
      testDb,
    );
    const r2 = await markInvoicePaid(
      { invoice_id: gen.invoice.id, paid_via: "bank_transfer", nowMs: NOW + 3 },
      testDb,
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.alreadyPaid).toBe(true);
  });

  it("refuses to mark a draft invoice paid", async () => {
    seedCoreRows({ withAcceptedQuote: true });
    const gen = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    if (!gen.ok) throw new Error("seed failed");
    const r = await markInvoicePaid(
      { invoice_id: gen.invoice.id, paid_via: "bank_transfer" },
      testDb,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/invoice_not_payable/);
  });
});

describe("INVOICING_HANDLERS — manual_invoice_generate", () => {
  function fakeTask(task_type: string, payload: unknown) {
    return {
      id: "t-1",
      task_type: task_type as never,
      run_at_ms: NOW,
      payload,
      status: "running" as const,
      attempts: 0,
      last_attempted_at_ms: null,
      last_error: null,
      idempotency_key: null,
      created_at_ms: NOW,
      done_at_ms: null,
      reclaimed_at_ms: null,
    };
  }

  it("generates invoice + enqueues manual_invoice_send at review window", async () => {
    seedCoreRows({ withAcceptedQuote: true });
    const handler = INVOICING_HANDLERS.manual_invoice_generate!;
    await handler(
      fakeTask("manual_invoice_generate", {
        deal_id: "deal-1",
        cycle_index: 0,
        send_at: NOW,
      }),
    );
    const allInvoices = testDb.select().from(invoices).all();
    expect(allInvoices).toHaveLength(1);
    const tasks = testDb.select().from(scheduled_tasks).all();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].task_type).toBe("manual_invoice_send");
  });

  it("bails when deal stage is not won (chain stop)", async () => {
    seedCoreRows({ stage: "quoted", withAcceptedQuote: true });
    const handler = INVOICING_HANDLERS.manual_invoice_generate!;
    await handler(
      fakeTask("manual_invoice_generate", {
        deal_id: "deal-1",
        cycle_index: 0,
      }),
    );
    expect(testDb.select().from(invoices).all()).toHaveLength(0);
    expect(testDb.select().from(scheduled_tasks).all()).toHaveLength(0);
  });

  it("bails when company billing_mode is not manual", async () => {
    seedCoreRows({ billing_mode: "stripe", withAcceptedQuote: true });
    const handler = INVOICING_HANDLERS.manual_invoice_generate!;
    await handler(
      fakeTask("manual_invoice_generate", {
        deal_id: "deal-1",
        cycle_index: 0,
      }),
    );
    expect(testDb.select().from(invoices).all()).toHaveLength(0);
  });
});

describe("INVOICING_HANDLERS — manual_invoice_send", () => {
  function fakeTask(task_type: string, payload: unknown) {
    return {
      id: "t-1",
      task_type: task_type as never,
      run_at_ms: NOW,
      payload,
      status: "running" as const,
      attempts: 0,
      last_attempted_at_ms: null,
      last_error: null,
      idempotency_key: null,
      created_at_ms: NOW,
      done_at_ms: null,
      reclaimed_at_ms: null,
    };
  }

  async function seedDraftInvoice() {
    seedCoreRows({ withAcceptedQuote: true });
    const gen = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    if (!gen.ok) throw new Error("seed failed");
    return gen.invoice;
  }

  it("sends + enqueues overdue reminder + enqueues next cycle on active subscription", async () => {
    const inv = await seedDraftInvoice();
    const handler = INVOICING_HANDLERS.manual_invoice_send!;
    await handler(
      fakeTask("manual_invoice_send", {
        deal_id: "deal-1",
        cycle_index: 0,
        invoice_id: inv.id,
      }),
    );
    const after = testDb
      .select()
      .from(invoices)
      .where(eq(invoices.id, inv.id))
      .get();
    expect(after.status).toBe("sent");
    const tasks = testDb.select().from(scheduled_tasks).all();
    const types = tasks.map((t: { task_type: string }) => t.task_type).sort();
    expect(types).toEqual(["invoice_overdue_reminder", "manual_invoice_generate"]);
  });

  it("stops chain when subscription_state is not active", async () => {
    seedCoreRows({
      subscription_state: "ended_gracefully",
      withAcceptedQuote: true,
    });
    const gen = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    if (!gen.ok) throw new Error("seed failed");
    const handler = INVOICING_HANDLERS.manual_invoice_send!;
    await handler(
      fakeTask("manual_invoice_send", {
        deal_id: "deal-1",
        cycle_index: 0,
        invoice_id: gen.invoice.id,
      }),
    );
    const tasks = testDb.select().from(scheduled_tasks).all();
    const types = tasks.map((t: { task_type: string }) => t.task_type);
    expect(types).toContain("invoice_overdue_reminder");
    expect(types).not.toContain("manual_invoice_generate");
  });

  it("is a no-op when invoice is not draft", async () => {
    const inv = await seedDraftInvoice();
    // pre-send
    await sendInvoice({ invoice_id: inv.id, nowMs: NOW + 1 }, testDb);
    sendEmailMock.mockClear();

    const handler = INVOICING_HANDLERS.manual_invoice_send!;
    await handler(
      fakeTask("manual_invoice_send", {
        deal_id: "deal-1",
        cycle_index: 0,
        invoice_id: inv.id,
      }),
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("INVOICING_HANDLERS — invoice_overdue_reminder", () => {
  function fakeTask(payload: unknown) {
    return {
      id: "t-r",
      task_type: "invoice_overdue_reminder" as never,
      run_at_ms: NOW,
      payload,
      status: "running" as const,
      attempts: 0,
      last_attempted_at_ms: null,
      last_error: null,
      idempotency_key: null,
      created_at_ms: NOW,
      done_at_ms: null,
      reclaimed_at_ms: null,
    };
  }

  it("flips sent → overdue, sends reminder, bumps reminder_count", async () => {
    seedCoreRows({ withAcceptedQuote: true });
    const gen = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    if (!gen.ok) throw new Error("seed failed");
    await sendInvoice({ invoice_id: gen.invoice.id, nowMs: NOW + 1 }, testDb);
    sendEmailMock.mockClear();

    const handler = INVOICING_HANDLERS.invoice_overdue_reminder!;
    await handler(fakeTask({ invoice_id: gen.invoice.id }));

    const after = testDb
      .select()
      .from(invoices)
      .where(eq(invoices.id, gen.invoice.id))
      .get();
    expect(after.status).toBe("overdue");
    expect(after.reminder_count).toBe(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].classification).toBe("invoice_reminder");
  });

  it("skips when invoice is already paid", async () => {
    seedCoreRows({ withAcceptedQuote: true });
    const gen = await generateInvoice(
      { deal_id: "deal-1", cycle_index: 0, nowMs: NOW },
      testDb,
    );
    if (!gen.ok) throw new Error("seed failed");
    await sendInvoice({ invoice_id: gen.invoice.id, nowMs: NOW + 1 }, testDb);
    await markInvoicePaid(
      { invoice_id: gen.invoice.id, paid_via: "bank_transfer", nowMs: NOW + 2 },
      testDb,
    );
    sendEmailMock.mockClear();

    const handler = INVOICING_HANDLERS.invoice_overdue_reminder!;
    await handler(fakeTask({ invoice_id: gen.invoice.id }));
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
