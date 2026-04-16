/**
 * UI-8 — `readThread()` detail loader.
 *
 * Covers: missing thread → null, message ordering + soft-delete
 * exclusion, contact + company hydration when FKs are present, and the
 * shape returned when those FKs are absent (walk-in threads).
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

const TEST_DB = path.join(process.cwd(), "tests/.test-inbox-read-thread-query.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const { readThread } = await import("@/app/lite/inbox/_queries/read-thread");
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

describe("readThread", () => {
  it("returns null for an unknown thread id", async () => {
    const result = await readThread("does-not-exist");
    expect(result).toBeNull();
  });

  it("returns ordered non-deleted messages plus contact + company", async () => {
    const companyId = seedCompany("Acme");
    const contactId = seedContact(companyId);
    const threadId = seedThread({ contact_id: contactId, company_id: companyId });
    seedMessage(threadId, { created_at_ms: NOW + 200, body_text: "Third" });
    seedMessage(threadId, { created_at_ms: NOW, body_text: "First" });
    seedMessage(threadId, { created_at_ms: NOW + 100, body_text: "Second" });
    seedMessage(threadId, {
      created_at_ms: NOW + 50,
      body_text: "Deleted",
      deleted_at_ms: NOW + 300,
    });

    const result = await readThread(threadId);

    expect(result).not.toBeNull();
    expect(result!.thread.id).toBe(threadId);
    expect(result!.messages.map((m) => m.body_text)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
    expect(result!.contact?.id).toBe(contactId);
    expect(result!.company?.id).toBe(companyId);
  });

  it("returns null contact/company when thread has no FKs (walk-in)", async () => {
    const threadId = seedThread();
    seedMessage(threadId);

    const result = await readThread(threadId);

    expect(result).not.toBeNull();
    expect(result!.contact).toBeNull();
    expect(result!.company).toBeNull();
    expect(result!.messages).toHaveLength(1);
  });

  it("returns an empty messages array when every message is soft-deleted", async () => {
    const threadId = seedThread();
    seedMessage(threadId, { deleted_at_ms: NOW + 10 });
    seedMessage(threadId, { deleted_at_ms: NOW + 20 });

    const result = await readThread(threadId);

    expect(result).not.toBeNull();
    expect(result!.messages).toEqual([]);
  });
});
