/**
 * BI-2b-ii — Claude-drafted invoice email composers.
 *
 * Exercises the three composers against an in-memory SQLite:
 *   - Kill-switch off → deterministic fallback path (no LLM call).
 *   - LLM parse failure → deterministic fallback path.
 *   - First-reminder "overdue" subject sanitiser → falls back.
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

import * as schema from "@/lib/db/schema";

// ── Hoist mocks before module imports ─────────────────────────────────────────

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockMessagesCreate };
  },
}));

const mockKillSwitches = vi.hoisted(() => ({
  llm_calls_enabled: false,
  drift_check_enabled: true,
  outreach_send_enabled: false,
  scheduled_tasks_enabled: false,
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: mockKillSwitches,
}));

const mockSettingsGet = vi.hoisted(() => vi.fn().mockResolvedValue(0.7));
vi.mock("@/lib/settings", () => ({
  default: { get: mockSettingsGet },
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-bi2b-ii-compose.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const { composeInvoiceSendEmailAI } = await import(
  "@/lib/invoicing/compose-send-email"
);
const { composeInvoiceReminderEmailAI } = await import(
  "@/lib/invoicing/compose-reminder-email"
);
const { composeInvoiceSupersedeEmailAI } = await import(
  "@/lib/invoicing/compose-supersede-email"
);
const { invoices } = await import("@/lib/db/schema/invoices");
const { companies } = await import("@/lib/db/schema/companies");
const { contacts } = await import("@/lib/db/schema/contacts");
const { deals } = await import("@/lib/db/schema/deals");

const NOW = 1_700_000_000_000;

async function seed(opts: {
  status?: "draft" | "sent" | "overdue" | "paid" | "void";
  reminderCount?: number;
  dueOffsetMs?: number;
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
      name: "Sam Ryder",
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
  testDb
    .insert(invoices)
    .values({
      id: "inv-1",
      invoice_number: "SB-2026-0001",
      token: "tok-abc",
      company_id: "co-1",
      deal_id: "deal-1",
      status: opts.status ?? "sent",
      line_items_json: [
        {
          description: "Monthly retainer",
          quantity: 1,
          unit_price_cents_inc_gst: 495_000,
          line_total_cents_inc_gst: 495_000,
          is_recurring: true,
        },
      ],
      total_cents_inc_gst: 495_000,
      total_cents_ex_gst: 450_000,
      gst_cents: 45_000,
      gst_applicable: true,
      issue_date_ms: NOW,
      due_at_ms: NOW + (opts.dueOffsetMs ?? -3 * 86_400_000),
      cycle_index: 0,
      reminder_count: opts.reminderCount ?? 0,
      sent_at_ms: NOW,
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
  testDb.delete(invoices).run();
  testDb.delete(deals).run();
  testDb.delete(contacts).run();
  testDb.delete(companies).run();
  mockMessagesCreate.mockReset();
  mockKillSwitches.llm_calls_enabled = false;
  mockKillSwitches.drift_check_enabled = true;
});

describe("composeInvoiceSendEmailAI — kill-switch off", () => {
  it("returns deterministic fallback with View-invoice CTA", async () => {
    await seed({ status: "draft" });
    const result = await composeInvoiceSendEmailAI({ invoice_id: "inv-1" }, testDb);
    expect(result.fallbackUsed).toBe(true);
    expect(result.drift.pass).toBe(true);
    expect(result.subject).toContain("SB-2026-0001");
    expect(result.bodyHtml).toContain("View invoice →");
    expect(result.recipientEmail).toBe("sam@acme.test");
    expect(result.recipientName).toBe("Sam");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });
});

describe("composeInvoiceReminderEmailAI — kill-switch off", () => {
  it("returns deterministic fallback for overdue invoice", async () => {
    await seed({ status: "overdue", dueOffsetMs: -5 * 86_400_000 });
    const result = await composeInvoiceReminderEmailAI(
      { invoice_id: "inv-1", nowMs: NOW },
      testDb,
    );
    expect(result.fallbackUsed).toBe(true);
    expect(result.daysOverdue).toBe(5);
    expect(result.reminderCount).toBe(0);
    expect(result.subject).toContain("SB-2026-0001");
    expect(result.bodyHtml).toContain("View invoice →");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });
});

describe("composeInvoiceSupersedeEmailAI — kill-switch off", () => {
  it("returns deterministic fallback referencing both invoice numbers", async () => {
    await seed({ status: "draft" });
    const result = await composeInvoiceSupersedeEmailAI(
      { new_invoice_id: "inv-1", previous_invoice_number: "SB-2026-0000" },
      testDb,
    );
    expect(result.fallbackUsed).toBe(true);
    expect(result.bodyHtml).toContain("SB-2026-0000");
    expect(result.bodyHtml).toContain("SB-2026-0001");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });
});

describe("composeInvoiceReminderEmailAI — LLM-on first-reminder guardrail", () => {
  it("sanitises first-reminder subject containing 'overdue' → falls back", async () => {
    mockKillSwitches.llm_calls_enabled = true;
    mockMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            subject: "SB-2026-0001 is OVERDUE — please action",
            bodyParagraphs: ["A draft body paragraph."],
          }),
        },
      ],
    });
    await seed({ status: "overdue", reminderCount: 0, dueOffsetMs: -2 * 86_400_000 });

    const result = await composeInvoiceReminderEmailAI(
      { invoice_id: "inv-1", nowMs: NOW },
      testDb,
    );
    expect(result.fallbackUsed).toBe(true);
    expect(result.subject.toLowerCase()).not.toContain("overdue");
  });

  it("accepts 'overdue' in subject from reminder #2 onward", async () => {
    mockKillSwitches.llm_calls_enabled = true;
    mockMessagesCreate
      .mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              subject: "SB-2026-0001 — overdue follow-up",
              bodyParagraphs: ["Still chasing this one."],
            }),
          },
        ],
      })
      // drift-check grader response
      .mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify({ score: 0.9, notes: "ok" }) }],
      });

    await seed({ status: "overdue", reminderCount: 1, dueOffsetMs: -10 * 86_400_000 });

    const result = await composeInvoiceReminderEmailAI(
      { invoice_id: "inv-1", nowMs: NOW },
      testDb,
    );
    expect(result.fallbackUsed).toBe(false);
    expect(result.subject.toLowerCase()).toContain("overdue");
  });
});

describe("composeInvoiceSendEmailAI — parse failure falls back", () => {
  it("falls back when LLM returns non-JSON", async () => {
    mockKillSwitches.llm_calls_enabled = true;
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "garbage not json" }],
    });
    await seed({ status: "draft" });
    const result = await composeInvoiceSendEmailAI({ invoice_id: "inv-1" }, testDb);
    expect(result.fallbackUsed).toBe(true);
  });
});
