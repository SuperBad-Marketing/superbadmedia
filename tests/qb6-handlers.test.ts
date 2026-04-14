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

const TEST_DB = path.join(process.cwd(), "tests/.test-qb6-handlers.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

const sendEmailMock = vi.fn<(params: SendEmailParams) => Promise<SendEmailResult>>(
  async () => ({ sent: true, messageId: "msg_123" }),
);

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: (params: SendEmailParams) => sendEmailMock(params),
}));

vi.mock("@/lib/quote-builder/compose-reminder-email", () => ({
  composeQuoteReminder3d: vi.fn(async () => ({
    subject: "Acme — the quote's still there",
    bodyParagraphs: ["short nudge paragraph"],
    bodyHtml: "<div>short nudge paragraph</div>",
    drift: { pass: true, score: 0.95, notes: null },
    recipientEmail: "client@acme.test",
    recipientName: "Sam",
    fallbackUsed: false,
  })),
}));

const { handleQuoteExpire } = await import(
  "@/lib/quote-builder/handle-quote-expire"
);
const { handleQuoteReminder3d } = await import(
  "@/lib/quote-builder/handle-quote-reminder-3d"
);
const { quotes } = await import("@/lib/db/schema/quotes");
const { companies } = await import("@/lib/db/schema/companies");
const { contacts } = await import("@/lib/db/schema/contacts");
const { deals } = await import("@/lib/db/schema/deals");
const { activity_log } = await import("@/lib/db/schema/activity-log");
const { scheduled_tasks } = await import("@/lib/db/schema/scheduled-tasks");

const NOW = 1_700_000_000_000;

function seedQuote(status: "draft" | "sent" | "viewed" | "accepted" | "expired" = "sent") {
  testDb
    .insert(quotes)
    .values({
      id: "q-1",
      deal_id: "deal-1",
      company_id: "co-1",
      token: "tok-1",
      quote_number: "SB-2026-0001",
      status,
      structure: "project",
      content_json: {
        sections: {
          whatYouToldUs: { prose: "Context snippet for the nudge." },
          whatWellDo: { line_items: [] },
        },
      } as unknown as object,
      catalogue_snapshot_json: null,
      total_cents_inc_gst: 100000,
      retainer_monthly_cents_inc_gst: null,
      one_off_cents_inc_gst: 100000,
      term_length_months: null,
      buyout_percentage: 50,
      created_at_ms: NOW,
      sent_at_ms: NOW,
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
  testDb
    .insert(companies)
    .values({
      id: "co-1",
      name: "Acme",
      name_normalised: "acme",
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
      name: "Sam Client",
      email: "client@acme.test",
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
      stage: "quoted",
      primary_contact_id: "c-1",
      last_stage_change_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

beforeEach(async () => {
  testDb.delete(activity_log).run();
  testDb.delete(scheduled_tasks).run();
  testDb.delete(quotes).run();
  sendEmailMock.mockClear();
  sendEmailMock.mockImplementation(async () => ({
    sent: true,
    messageId: "msg_123",
  }));
});

describe("QB-6 — handleQuoteExpire", () => {
  it("transitions sent → expired, fires email, logs quote_expired", async () => {
    seedQuote("sent");

    const result = await handleQuoteExpire({ quote_id: "q-1", task_id: "t-1" });

    expect(result.expired).toBe(true);
    expect(result.priorStatus).toBe("sent");
    expect(result.emailSkipped).toBe(false);

    const row = testDb.select().from(quotes).where(eq(quotes.id, "q-1")).get();
    expect(row.status).toBe("expired");
    expect(row.expired_at_ms).toBeTypeOf("number");

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0] as {
      classification: string;
      to: string;
    };
    expect(call.classification).toBe("quote_expired");
    expect(call.to).toBe("client@acme.test");

    const logs = testDb.select().from(activity_log).all();
    expect(logs).toHaveLength(1);
    expect(logs[0].kind).toBe("quote_expired");
    expect(logs[0].meta.prior_status).toBe("sent");
    expect(logs[0].meta.source).toBe("scheduled_task");
    expect(logs[0].meta.task_id).toBe("t-1");
  });

  it("transitions viewed → expired too", async () => {
    seedQuote("viewed");
    const result = await handleQuoteExpire({ quote_id: "q-1" });
    expect(result.expired).toBe(true);
    expect(result.priorStatus).toBe("viewed");
    const row = testDb.select().from(quotes).where(eq(quotes.id, "q-1")).get();
    expect(row.status).toBe("expired");
  });

  it("is a no-op when quote already moved to accepted", async () => {
    seedQuote("accepted");
    const result = await handleQuoteExpire({ quote_id: "q-1" });
    expect(result.expired).toBe(false);
    expect(result.priorStatus).toBe("accepted");
    expect(sendEmailMock).not.toHaveBeenCalled();
    const logs = testDb.select().from(activity_log).all();
    expect(logs).toHaveLength(0);
  });

  it("is a no-op when quote already expired (idempotent on retry)", async () => {
    seedQuote("expired");
    const result = await handleQuoteExpire({ quote_id: "q-1" });
    expect(result.expired).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("is a no-op when quote row is missing", async () => {
    const result = await handleQuoteExpire({ quote_id: "missing" });
    expect(result.expired).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("still transitions + logs even if email dispatch is skipped", async () => {
    seedQuote("sent");
    sendEmailMock.mockImplementationOnce(async () => ({
      sent: false,
      skipped: true,
      reason: "suppressed:bounced",
    }));

    const result = await handleQuoteExpire({ quote_id: "q-1" });
    expect(result.expired).toBe(true);
    expect(result.emailSkipped).toBe(true);
    expect(result.emailSkippedReason).toBe("suppressed:bounced");

    const row = testDb.select().from(quotes).where(eq(quotes.id, "q-1")).get();
    expect(row.status).toBe("expired");
    const logs = testDb.select().from(activity_log).all();
    expect(logs[0].meta.email_skipped).toBe(true);
  });
});

describe("QB-6 — handleQuoteReminder3d", () => {
  it("fires reminder email on sent status and logs quote_reminder_sent", async () => {
    seedQuote("sent");

    const result = await handleQuoteReminder3d({
      quote_id: "q-1",
      task_id: "t-2",
      attempts: 0,
    });

    expect(result.sent).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0] as {
      classification: string;
      subject: string;
    };
    expect(call.classification).toBe("quote_reminder");

    const logs = testDb.select().from(activity_log).all();
    expect(logs).toHaveLength(1);
    expect(logs[0].kind).toBe("quote_reminder_sent");
    expect(logs[0].meta.llm_job).toBe("draft-quote-reminder-3d");
    expect(logs[0].meta.email_message_id).toBe("msg_123");
    expect(logs[0].meta.task_id).toBe("t-2");
    expect(logs[0].meta.drift_check_result).toBe("pass");
  });

  it("skips when quote is viewed (race with view-tracking skip flip)", async () => {
    seedQuote("viewed");
    const result = await handleQuoteReminder3d({ quote_id: "q-1" });
    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("status_not_sent");
    expect(sendEmailMock).not.toHaveBeenCalled();
    const logs = testDb.select().from(activity_log).all();
    expect(logs).toHaveLength(0);
  });

  it("skips when quote has been accepted", async () => {
    seedQuote("accepted");
    const result = await handleQuoteReminder3d({ quote_id: "q-1" });
    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("status_not_sent");
  });

  it("skips when quote row is missing", async () => {
    const result = await handleQuoteReminder3d({ quote_id: "missing" });
    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe("quote_missing");
  });

  it("throws on send failure so worker backoff engages", async () => {
    seedQuote("sent");
    sendEmailMock.mockImplementationOnce(async () => ({
      sent: false,
      skipped: true,
      reason: "quiet_window:outside_send_hours",
    }));

    await expect(
      handleQuoteReminder3d({ quote_id: "q-1" }),
    ).rejects.toThrow(/quote_reminder_3d: send failed/);

    // No activity log on failure — retry writes the log when a later send
    // succeeds.
    const logs = testDb.select().from(activity_log).all();
    expect(logs).toHaveLength(0);
  });
});
