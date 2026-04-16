/**
 * UI-9 — `listConversation()` per-contact cross-thread loader.
 *
 * Spec §4.2 / §8.2 / §8.3. Per-file SQLite pattern — mirrors
 * `tests/inbox-read-thread-query.test.ts`. Covers: unknown contact →
 * null; contact with no threads → empty; single-thread + multi-thread
 * ordering (threads by `last_message_at_ms` desc, messages chronological
 * asc within); soft-deleted messages excluded; threads whose messages
 * are all soft-deleted are filtered out.
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

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(
  process.cwd(),
  "tests/.test-inbox-list-conversation-query.db",
);
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const { listConversation } = await import(
  "@/app/lite/inbox/_queries/list-conversation"
);
const { threads, messages } = await import("@/lib/db/schema/messages");
const { contacts } = await import("@/lib/db/schema/contacts");
const { companies } = await import("@/lib/db/schema/companies");

const NOW = 1_700_000_000_000;

function seedCompany(name = "Acme"): string {
  const id = randomUUID();
  testDb
    .insert(companies)
    .values({
      id,
      name,
      name_normalised: name.toLowerCase(),
      billing_mode: "stripe",
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return id;
}

function seedContact(companyId: string, name = "Sam Ryder"): string {
  const id = randomUUID();
  testDb
    .insert(contacts)
    .values({
      id,
      company_id: companyId,
      name,
      email: "sam@acme.test",
      email_normalised: "sam@acme.test",
      relationship_type: "client",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return id;
}

function seedThread(
  overrides: Partial<typeof threads.$inferInsert> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb
    .insert(threads)
    .values({
      id,
      channel_of_origin: "email",
      sending_address: "andy@",
      subject: "Subject",
      priority_class: "signal",
      last_message_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
      ...overrides,
    })
    .run();
  return id;
}

function seedMessage(
  threadId: string,
  overrides: Partial<typeof messages.$inferInsert> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb
    .insert(messages)
    .values({
      id,
      thread_id: threadId,
      direction: "inbound",
      channel: "email",
      from_address: "sam@acme.test",
      to_addresses: ["andy@superbadmedia.com.au"],
      subject: "Subject",
      body_text: "Body",
      priority_class: "signal",
      import_source: "live",
      created_at_ms: NOW,
      updated_at_ms: NOW,
      ...overrides,
    })
    .run();
  return id;
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
  testDb.delete(messages).run();
  testDb.delete(threads).run();
  testDb.delete(contacts).run();
  testDb.delete(companies).run();
});

describe("listConversation", () => {
  it("returns null for an unknown contact id", async () => {
    const result = await listConversation("does-not-exist");
    expect(result).toBeNull();
  });

  it("returns the contact + empty threads list when the contact has no threads", async () => {
    const companyId = seedCompany("Acme");
    const contactId = seedContact(companyId);

    const result = await listConversation(contactId);

    expect(result).not.toBeNull();
    expect(result!.contact.id).toBe(contactId);
    expect(result!.company?.id).toBe(companyId);
    expect(result!.threads).toEqual([]);
  });

  it("returns a single thread with its messages ordered chronologically", async () => {
    const companyId = seedCompany("Acme");
    const contactId = seedContact(companyId);
    const threadId = seedThread({
      contact_id: contactId,
      company_id: companyId,
      subject: "Lock it in",
      last_message_at_ms: NOW + 300,
    });
    seedMessage(threadId, { created_at_ms: NOW + 200, body_text: "Third" });
    seedMessage(threadId, { created_at_ms: NOW, body_text: "First" });
    seedMessage(threadId, { created_at_ms: NOW + 100, body_text: "Second" });

    const result = await listConversation(contactId);

    expect(result).not.toBeNull();
    expect(result!.threads).toHaveLength(1);
    expect(result!.threads[0].thread.id).toBe(threadId);
    expect(result!.threads[0].messages.map((m) => m.body_text)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  it("orders threads by last_message_at_ms descending and messages chronologically within each", async () => {
    const companyId = seedCompany("Acme");
    const contactId = seedContact(companyId);

    const olderThreadId = seedThread({
      contact_id: contactId,
      company_id: companyId,
      subject: "First conversation",
      channel_of_origin: "email",
      last_message_at_ms: NOW + 100,
    });
    seedMessage(olderThreadId, {
      created_at_ms: NOW,
      body_text: "Older thread / msg 1",
    });
    seedMessage(olderThreadId, {
      created_at_ms: NOW + 100,
      body_text: "Older thread / msg 2",
    });

    const newerThreadId = seedThread({
      contact_id: contactId,
      company_id: companyId,
      subject: "Second conversation",
      channel_of_origin: "portal_chat",
      last_message_at_ms: NOW + 500,
    });
    seedMessage(newerThreadId, {
      created_at_ms: NOW + 400,
      body_text: "Newer thread / msg 1",
      channel: "portal_chat",
    });
    seedMessage(newerThreadId, {
      created_at_ms: NOW + 500,
      body_text: "Newer thread / msg 2",
      channel: "portal_chat",
    });

    const result = await listConversation(contactId);

    expect(result).not.toBeNull();
    expect(result!.threads.map((t) => t.thread.id)).toEqual([
      newerThreadId,
      olderThreadId,
    ]);
    expect(result!.threads[0].thread.channel_of_origin).toBe("portal_chat");
    expect(result!.threads[0].messages.map((m) => m.body_text)).toEqual([
      "Newer thread / msg 1",
      "Newer thread / msg 2",
    ]);
    expect(result!.threads[1].messages.map((m) => m.body_text)).toEqual([
      "Older thread / msg 1",
      "Older thread / msg 2",
    ]);
  });

  it("excludes soft-deleted messages from each thread", async () => {
    const companyId = seedCompany("Acme");
    const contactId = seedContact(companyId);
    const threadId = seedThread({
      contact_id: contactId,
      company_id: companyId,
    });
    seedMessage(threadId, { created_at_ms: NOW, body_text: "Kept" });
    seedMessage(threadId, {
      created_at_ms: NOW + 50,
      body_text: "Trashed",
      deleted_at_ms: NOW + 200,
    });
    seedMessage(threadId, { created_at_ms: NOW + 100, body_text: "Also kept" });

    const result = await listConversation(contactId);

    expect(result).not.toBeNull();
    expect(result!.threads).toHaveLength(1);
    expect(result!.threads[0].messages.map((m) => m.body_text)).toEqual([
      "Kept",
      "Also kept",
    ]);
  });

  it("drops threads whose every message is soft-deleted", async () => {
    const companyId = seedCompany("Acme");
    const contactId = seedContact(companyId);

    const aliveThreadId = seedThread({
      contact_id: contactId,
      company_id: companyId,
      subject: "Still here",
      last_message_at_ms: NOW + 100,
    });
    seedMessage(aliveThreadId, { body_text: "Alive", created_at_ms: NOW + 100 });

    const deadThreadId = seedThread({
      contact_id: contactId,
      company_id: companyId,
      subject: "All gone",
      last_message_at_ms: NOW + 50,
    });
    seedMessage(deadThreadId, {
      body_text: "Gone",
      created_at_ms: NOW + 50,
      deleted_at_ms: NOW + 500,
    });

    const result = await listConversation(contactId);

    expect(result).not.toBeNull();
    expect(result!.threads).toHaveLength(1);
    expect(result!.threads[0].thread.id).toBe(aliveThreadId);
  });
});
