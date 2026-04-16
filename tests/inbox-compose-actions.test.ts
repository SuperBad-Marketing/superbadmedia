/**
 * UI-6 — Compose-send wiring (`lib/graph/compose-send.ts`).
 *
 * The server action in `app/lite/inbox/compose/actions.ts` is a thin
 * auth/Zod adapter around these primitives; testing the library here
 * exercises the same outbound wiring without pulling `next/cache` or
 * NextAuth into the test tree.
 *
 * Covers:
 *  - `resolveRecipientContact` — exact case-insensitive match + null on miss (2)
 *  - `ensureThreadForCompose` — reuse existing vs synth new (2)
 *  - `sendComposeMessage` — creates thread if none supplied, writes outbound
 *     row via `sendViaGraph`, invalidates cached reply draft, logs
 *     `inbox_message_sent`, drains the compose_drafts row (1)
 *  - Subject auto-generation when blank (1)
 *  - `inbox_send_enabled` kill switch throws (1)
 *  - `saveComposeDraftRow` round-trips insert + update (1)
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

// ── Hoisted mocks ────────────────────────────────────────────────────

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockMessagesCreate };
  },
}));

const mockKillSwitches = vi.hoisted(() => ({
  inbox_sync_enabled: true,
  inbox_send_enabled: true,
  llm_calls_enabled: true,
  scheduled_tasks_enabled: false,
  outreach_send_enabled: false,
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: mockKillSwitches,
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-inbox-compose-actions.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const {
  resolveRecipientContact,
  ensureThreadForCompose,
  sendComposeMessage,
  saveComposeDraftRow,
} = await import("@/lib/graph/compose-send");
import type { GraphClient } from "@/lib/graph/client";
const { threads, messages } = await import("@/lib/db/schema/messages");
const { contacts } = await import("@/lib/db/schema/contacts");
const { companies } = await import("@/lib/db/schema/companies");
const { compose_drafts } = await import("@/lib/db/schema/compose-drafts");
const { activity_log } = await import("@/lib/db/schema/activity-log");
const { user } = await import("@/lib/db/schema/user");

const NOW = 1_700_000_000_000;

// ── Fake GraphClient ─────────────────────────────────────────────────

function makeFakeClient(): GraphClient & {
  fetch: ReturnType<typeof vi.fn>;
  fetchJson: ReturnType<typeof vi.fn>;
} {
  const fetch = vi.fn(async () => ({
    ok: true,
    status: 202,
    text: async () => "",
    json: async () => ({}),
  })) as unknown as ReturnType<typeof vi.fn>;
  const fetchJson = vi.fn(async () => ({})) as unknown as ReturnType<
    typeof vi.fn
  >;
  return { fetch, fetchJson } as unknown as GraphClient & {
    fetch: ReturnType<typeof vi.fn>;
    fetchJson: ReturnType<typeof vi.fn>;
  };
}

// ── Seeds ────────────────────────────────────────────────────────────

async function seedUser(id = randomUUID()): Promise<string> {
  testDb
    .insert(user)
    .values({
      id,
      email: `u-${id}@test.local`,
      role: "admin",
      created_at_ms: NOW,
    })
    .run();
  return id;
}

async function seedContactWithCompany(email = "Sam@Acme.Test"): Promise<{
  contactId: string;
  companyId: string;
  email: string;
}> {
  const companyId = randomUUID();
  const contactId = randomUUID();
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
      email,
      email_normalised: email.toLowerCase(),
      relationship_type: "client",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return { contactId, companyId, email };
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
  testDb.delete(compose_drafts).run();
  testDb.delete(messages).run();
  testDb.delete(threads).run();
  testDb.delete(contacts).run();
  testDb.delete(companies).run();
  testDb.delete(user).run();
  mockMessagesCreate.mockReset();
  mockKillSwitches.inbox_sync_enabled = true;
  mockKillSwitches.inbox_send_enabled = true;
  mockKillSwitches.llm_calls_enabled = true;
});

// ── resolveRecipientContact ──────────────────────────────────────────

describe("resolveRecipientContact", () => {
  it("matches an existing contact case-insensitively", async () => {
    const { contactId, companyId } = await seedContactWithCompany("sam@acme.test");
    const result = await resolveRecipientContact("SAM@ACME.TEST");
    expect(result).not.toBeNull();
    expect(result!.contactId).toBe(contactId);
    expect(result!.companyId).toBe(companyId);
  });

  it("returns null when no contact matches (walk-in recipient)", async () => {
    const result = await resolveRecipientContact("unknown@nowhere.test");
    expect(result).toBeNull();
  });
});

// ── ensureThreadForCompose ───────────────────────────────────────────

describe("ensureThreadForCompose", () => {
  it("returns the existing thread id when supplied", async () => {
    const { contactId, companyId } = await seedContactWithCompany();
    const existingId = randomUUID();
    testDb
      .insert(threads)
      .values({
        id: existingId,
        contact_id: contactId,
        company_id: companyId,
        channel_of_origin: "email",
        subject: "existing",
        priority_class: "signal",
        last_message_at_ms: NOW,
        created_at_ms: NOW,
        updated_at_ms: NOW,
      })
      .run();
    const id = await ensureThreadForCompose({
      threadId: existingId,
      contactId,
      companyId,
      subject: "existing",
      sendingAddress: "andy@superbadmedia.com.au",
    });
    expect(id).toBe(existingId);
  });

  it("creates a new thread when no threadId is supplied", async () => {
    const { contactId, companyId } = await seedContactWithCompany();
    const id = await ensureThreadForCompose({
      threadId: null,
      contactId,
      companyId,
      subject: "Fresh",
      sendingAddress: "andy@superbadmedia.com.au",
    });
    const row = testDb
      .select()
      .from(threads)
      .where(eq(threads.id, id))
      .get();
    expect(row).toBeTruthy();
    expect(row.subject).toBe("Fresh");
    expect(row.channel_of_origin).toBe("email");
    expect(row.contact_id).toBe(contactId);
  });
});

// ── sendComposeMessage ───────────────────────────────────────────────

describe("sendComposeMessage", () => {
  it("creates new thread, writes outbound row, logs inbox_message_sent, drains compose draft", async () => {
    const authorId = await seedUser();
    const { contactId, companyId } = await seedContactWithCompany();

    // Pre-seed a compose_drafts row to prove drain on send.
    const draftId = randomUUID();
    testDb
      .insert(compose_drafts)
      .values({
        id: draftId,
        author_user_id: authorId,
        thread_id: null,
        contact_id: contactId,
        company_id: companyId,
        sending_address: "andy@superbadmedia.com.au",
        to_addresses: ["sam@acme.test"],
        subject: "Follow-up",
        body_text: "Body.",
        created_at_ms: NOW,
        updated_at_ms: NOW,
      })
      .run();

    const client = makeFakeClient();
    const result = await sendComposeMessage(client, {
      threadId: null,
      contactId,
      companyId,
      sendingAddress: "andy@superbadmedia.com.au",
      to: ["sam@acme.test"],
      subject: "Follow-up",
      bodyText: "Body text.",
      createdBy: `user:${authorId}`,
      composeDraftId: draftId,
    });

    expect(result.threadId).toBeTruthy();
    expect(result.messageId).toBeTruthy();
    expect(result.subjectSource).toBe("user");
    expect(client.fetch).toHaveBeenCalledTimes(1);

    const outbound = testDb
      .select()
      .from(messages)
      .where(eq(messages.thread_id, result.threadId))
      .all();
    expect(outbound.length).toBe(1);
    expect(outbound[0].direction).toBe("outbound");
    expect(outbound[0].subject).toBe("Follow-up");

    const log = testDb
      .select()
      .from(activity_log)
      .where(eq(activity_log.kind, "inbox_message_sent"))
      .get();
    expect(log).toBeTruthy();
    expect(log.contact_id).toBe(contactId);

    const drainedDraft = testDb
      .select()
      .from(compose_drafts)
      .where(eq(compose_drafts.id, draftId))
      .get();
    expect(drainedDraft).toBeUndefined();
  });

  it("auto-generates subject via Haiku when blank, marks source=generated", async () => {
    const authorId = await seedUser();
    const { contactId, companyId } = await seedContactWithCompany();

    mockMessagesCreate.mockResolvedValueOnce({
      content: [
        { type: "text", text: JSON.stringify({ subject: "Next week's shoot plan" }) },
      ],
    });

    const client = makeFakeClient();
    const result = await sendComposeMessage(client, {
      threadId: null,
      contactId,
      companyId,
      sendingAddress: "andy@superbadmedia.com.au",
      to: ["sam@acme.test"],
      subject: "",
      bodyText: "Sam — pushing next week. —A",
      createdBy: `user:${authorId}`,
    });

    expect(result.subject).toBe("Next week's shoot plan");
    expect(result.subjectSource).toBe("generated");
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });

  it("throws when inbox_send_enabled is off (no Graph call, no write)", async () => {
    const authorId = await seedUser();
    const { contactId, companyId } = await seedContactWithCompany();
    mockKillSwitches.inbox_send_enabled = false;

    const client = makeFakeClient();
    await expect(
      sendComposeMessage(client, {
        threadId: null,
        contactId,
        companyId,
        sendingAddress: "andy@superbadmedia.com.au",
        to: ["sam@acme.test"],
        subject: "Subj",
        bodyText: "Body",
        createdBy: `user:${authorId}`,
      }),
    ).rejects.toThrow(/inbox_send_enabled/);

    expect(client.fetch).not.toHaveBeenCalled();
    const rows = testDb.select().from(messages).all();
    expect(rows.length).toBe(0);
  });
});

// ── saveComposeDraftRow ──────────────────────────────────────────────

describe("saveComposeDraftRow", () => {
  it("inserts when id absent, updates when id present", async () => {
    const authorId = await seedUser();
    const { contactId, companyId } = await seedContactWithCompany();

    const insert = await saveComposeDraftRow({
      id: null,
      authorUserId: authorId,
      threadId: null,
      contactId,
      companyId,
      sendingAddress: "andy@superbadmedia.com.au",
      to: ["sam@acme.test"],
      cc: null,
      bcc: null,
      subject: "Draft subject",
      bodyText: "First version.",
    });
    expect(insert.created).toBe(true);

    const update = await saveComposeDraftRow({
      id: insert.id,
      authorUserId: authorId,
      threadId: null,
      contactId,
      companyId,
      sendingAddress: "andy@superbadmedia.com.au",
      to: ["sam@acme.test"],
      cc: null,
      bcc: null,
      subject: "Revised subject",
      bodyText: "Second version.",
    });
    expect(update.created).toBe(false);
    expect(update.id).toBe(insert.id);

    const row = testDb
      .select()
      .from(compose_drafts)
      .where(eq(compose_drafts.id, insert.id))
      .get();
    expect(row.body_text).toBe("Second version.");
    expect(row.subject).toBe("Revised subject");
  });
});
