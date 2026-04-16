/**
 * UI-10 — Haiku-tier support-ticket-type classifier.
 *
 * Covers per brief §5:
 *  - Happy-path each type (billing, bug, question)
 *  - Kill-switch off → skipped with type='other' (no LLM call, no DB write)
 *  - Malformed JSON response → fallback to 'other' (discipline #63)
 *
 * LLM is mocked via `vi.hoisted` — no Anthropic calls. A per-file SQLite
 * DB backs the `db` import so the thread row + activity_log writes
 * round-trip without relying on the dev SQLite file.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
import type { NormalizedMessage } from "@/lib/graph/normalize";

// ── Hoisted mocks ────────────────────────────────────────────────────

const mockInvokeLlmText = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: mockInvokeLlmText,
}));

const mockKillSwitches = vi.hoisted(() => ({
  inbox_sync_enabled: true,
  llm_calls_enabled: true,
  inbox_send_enabled: true,
  scheduled_tasks_enabled: false,
  outreach_send_enabled: false,
}));
vi.mock("@/lib/kill-switches", () => ({
  killSwitches: mockKillSwitches,
}));

const TEST_DB = path.join(
  process.cwd(),
  "tests/.test-inbox-classify-support-ticket-type.db",
);
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const { classifySupportTicketType } = await import(
  "@/lib/graph/classify-support-ticket-type"
);
const { threads } = await import("@/lib/db/schema/messages");
const { contacts } = await import("@/lib/db/schema/contacts");
const { companies } = await import("@/lib/db/schema/companies");
const { activity_log } = await import("@/lib/db/schema/activity-log");

const NOW = 1_700_000_000_000;

async function seedThread(
  ticketAlreadyAssigned: boolean = false,
): Promise<string> {
  const companyId = randomUUID();
  const contactId = randomUUID();
  const threadId = randomUUID();
  testDb
    .insert(companies)
    .values({
      id: companyId,
      name: "Acme",
      name_normalised: "acme",
      billing_mode: "stripe",
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  testDb
    .insert(contacts)
    .values({
      id: contactId,
      company_id: companyId,
      name: "Sam Ryder",
      email: "sam@acme.test",
      relationship_type: "client",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  testDb
    .insert(threads)
    .values({
      id: threadId,
      contact_id: contactId,
      company_id: companyId,
      channel_of_origin: "email",
      sending_address: "support@",
      priority_class: "signal",
      last_message_at_ms: NOW,
      ticket_type: ticketAlreadyAssigned ? "bug" : null,
      ticket_status: ticketAlreadyAssigned ? "open" : null,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return threadId;
}

function makeInbound(
  overrides: Partial<Record<string, unknown>> = {},
): NormalizedMessage {
  return {
    id: randomUUID(),
    direction: "inbound",
    channel: "email",
    from_address: "sam@acme.test",
    to_addresses: ["support@superbadmedia.com.au"],
    cc_addresses: [],
    bcc_addresses: [],
    subject: "Charge failed on my card",
    body_text: "Hey — my last invoice didn't go through.",
    body_html: null,
    headers: {},
    message_id_header: null,
    in_reply_to_header: null,
    references_header: null,
    sent_at_ms: NOW,
    received_at_ms: NOW,
    priority_class: "signal",
    noise_subclass: null,
    notification_priority: null,
    router_classification: null,
    router_reason: null,
    is_engaged: false,
    engagement_signals: null,
    import_source: "live",
    has_attachments: false,
    has_calendar_invite: false,
    graph_message_id: "gm-" + randomUUID(),
    keep_until_ms: null,
    deleted_at_ms: null,
    created_at_ms: NOW,
    updated_at_ms: NOW,
    internetMessageId: null,
    inReplyTo: null,
    referencesHeader: null,
    ...overrides,
  } as NormalizedMessage;
}

// ── Lifecycle ────────────────────────────────────────────────────────

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
  testDb.delete(threads).run();
  testDb.delete(contacts).run();
  testDb.delete(companies).run();
  mockInvokeLlmText.mockReset();
  mockKillSwitches.inbox_sync_enabled = true;
  mockKillSwitches.llm_calls_enabled = true;
});

// ── Tests ────────────────────────────────────────────────────────────

describe("classifySupportTicketType", () => {
  it("happy-path: billing type persists to thread + logs activity", async () => {
    const threadId = await seedThread();
    mockInvokeLlmText.mockResolvedValue(
      JSON.stringify({ type: "billing", reason: "Card charge failure." }),
    );

    const result = await classifySupportTicketType(
      makeInbound({ subject: "Charge failed on my card" }),
      threadId,
    );

    expect(result.type).toBe("billing");
    expect(result.skipped).toBe(false);
    expect(mockInvokeLlmText).toHaveBeenCalledTimes(1);

    const row = testDb
      .select({
        ticket_type: threads.ticket_type,
        ticket_status: threads.ticket_status,
        ticket_type_assigned_by: threads.ticket_type_assigned_by,
      })
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(row!.ticket_type).toBe("billing");
    expect(row!.ticket_status).toBe("open");
    expect(row!.ticket_type_assigned_by).toBe("claude");

    const logRows = testDb.select().from(activity_log).all() as Array<{
      kind: string;
    }>;
    expect(logRows.some((r) => r.kind === "inbox_ticket_type_assigned")).toBe(
      true,
    );
  });

  it("happy-path: bug type round-trips", async () => {
    const threadId = await seedThread();
    mockInvokeLlmText.mockResolvedValue(
      JSON.stringify({ type: "bug", reason: "Product crash reported." }),
    );

    const result = await classifySupportTicketType(
      makeInbound({
        subject: "Upload button doesn't work",
        body_text: "The Upload button throws an error every time.",
      }),
      threadId,
    );

    expect(result.type).toBe("bug");
    expect(result.skipped).toBe(false);
  });

  it("happy-path: question type round-trips", async () => {
    const threadId = await seedThread();
    mockInvokeLlmText.mockResolvedValue(
      JSON.stringify({ type: "question", reason: "How-to." }),
    );

    const result = await classifySupportTicketType(
      makeInbound({
        subject: "How do I export?",
        body_text: "Where's the export menu? Can't find it.",
      }),
      threadId,
    );

    expect(result.type).toBe("question");
  });

  it("kill-switch off → returns 'other' + skipped, no LLM call, no DB write", async () => {
    const threadId = await seedThread();
    mockKillSwitches.llm_calls_enabled = false;

    const result = await classifySupportTicketType(makeInbound(), threadId);

    expect(result.type).toBe("other");
    expect(result.skipped).toBe(true);
    expect(mockInvokeLlmText).not.toHaveBeenCalled();

    const row = testDb
      .select({ ticket_type: threads.ticket_type })
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(row!.ticket_type).toBeNull();
  });

  it("malformed LLM response → falls back to 'other' and persists (discipline #63)", async () => {
    const threadId = await seedThread();
    mockInvokeLlmText.mockResolvedValue("this is not JSON at all");

    const result = await classifySupportTicketType(makeInbound(), threadId);

    expect(result.type).toBe("other");
    expect(result.skipped).toBe(false);
    expect(result.reason).toMatch(/fallback/);

    const row = testDb
      .select({
        ticket_type: threads.ticket_type,
        ticket_type_assigned_by: threads.ticket_type_assigned_by,
      })
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(row!.ticket_type).toBe("other");
    expect(row!.ticket_type_assigned_by).toBe("claude");
  });
});
