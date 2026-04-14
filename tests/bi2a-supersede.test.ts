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

import * as schema from "@/lib/db/schema";
import type {
  SendEmailParams,
  SendEmailResult,
} from "@/lib/channels/email/send";

const TEST_DB = path.join(process.cwd(), "tests/.test-bi2a-supersede.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

const sendEmailMock = vi.fn<(p: SendEmailParams) => Promise<SendEmailResult>>(
  async () => ({ sent: true, messageId: "msg_sup" }),
);

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));
vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: (p: SendEmailParams) => sendEmailMock(p),
}));

const { supersedeInvoice, voidInvoice, sendInvoiceReminder } = await import(
  "@/lib/invoicing/admin-mutations"
);
const { allocateInvoiceNumber } = await import("@/lib/invoicing/sequences");
const { invoices } = await import("@/lib/db/schema/invoices");
const { companies } = await import("@/lib/db/schema/companies");
const { contacts } = await import("@/lib/db/schema/contacts");
const { deals } = await import("@/lib/db/schema/deals");
const { activity_log } = await import("@/lib/db/schema/activity-log");
const { scheduled_tasks } = await import("@/lib/db/schema/scheduled-tasks");
const { sequences } = await import("@/lib/db/schema/sequences");

const NOW = 1_700_000_000_000;

async function seedInvoice(opts: {
  status?: "draft" | "sent" | "overdue" | "paid" | "void";
} = {}) {
  testDb
    .insert(companies)
    .values({
      id: "co-1",
      name: "Acme",
      name_normalised: "acme",
      billing_mode: "manual",
      gst_applicable: true,
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
      stage: "won",
      primary_contact_id: "c-1",
      subscription_state: "active",
      last_stage_change_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();

  const year = new Date(NOW).getUTCFullYear();
  const invoice_number = await allocateInvoiceNumber({ year, db: testDb });
  const lineItems = [
    {
      kind: "retainer" as const,
      description: "Monthly retainer",
      qty: 1,
      unit_price_cents_inc_gst: 110_00,
      line_total_cents_inc_gst: 110_00,
      recurring: true,
    },
  ];
  testDb
    .insert(invoices)
    .values({
      id: "inv-src",
      invoice_number,
      token: "tok-src",
      company_id: "co-1",
      deal_id: "deal-1",
      status: opts.status ?? "sent",
      line_items_json: lineItems,
      total_cents_inc_gst: 110_00,
      total_cents_ex_gst: 100_00,
      gst_cents: 10_00,
      gst_applicable: true,
      issue_date_ms: NOW,
      due_at_ms: NOW + 14 * 86_400_000,
      source: "manual",
      cycle_index: null,
      reminder_count: 0,
      sent_at_ms: opts.status === "draft" ? null : NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
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
  testDb.delete(deals).run();
  testDb.delete(contacts).run();
  testDb.delete(companies).run();
  testDb.delete(sequences).run();
  sendEmailMock.mockClear();
});

describe("bi2a supersedeInvoice", () => {
  it("voids source and spawns a draft carrying forward line items", async () => {
    await seedInvoice({ status: "sent" });
    const res = await supersedeInvoice(
      { source_invoice_id: "inv-src", nowMs: NOW + 1000 },
      testDb,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const src = await testDb
      .select()
      .from(invoices)
      .where(eq(invoices.id, "inv-src"))
      .get();
    expect(src.status).toBe("void");

    const fresh = res.new_invoice;
    expect(fresh.status).toBe("draft");
    expect(fresh.supersedes_invoice_id).toBe("inv-src");
    expect(fresh.total_cents_inc_gst).toBe(110_00);
    const parsed =
      typeof fresh.line_items_json === "string"
        ? JSON.parse(fresh.line_items_json)
        : fresh.line_items_json;
    expect(parsed).toHaveLength(1);
  });

  it("rejects supersede on paid invoice", async () => {
    await seedInvoice({ status: "paid" });
    const res = await supersedeInvoice(
      { source_invoice_id: "inv-src" },
      testDb,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("invoice_paid_cannot_supersede");
  });

  it("voidInvoice moves status to void", async () => {
    await seedInvoice({ status: "sent" });
    const res = await voidInvoice(
      { invoice_id: "inv-src", reason: "oops" },
      testDb,
    );
    expect(res.ok).toBe(true);
    const row = await testDb
      .select()
      .from(invoices)
      .where(eq(invoices.id, "inv-src"))
      .get();
    expect(row.status).toBe("void");
  });

  it("sendInvoiceReminder bumps reminder_count", async () => {
    await seedInvoice({ status: "overdue" });
    const res = await sendInvoiceReminder(
      { invoice_id: "inv-src" },
      testDb,
    );
    expect(res.ok).toBe(true);
    const row = await testDb
      .select()
      .from(invoices)
      .where(eq(invoices.id, "inv-src"))
      .get();
    expect(row.reminder_count).toBe(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});
