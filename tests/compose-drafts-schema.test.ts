/**
 * UI-6 — `compose_drafts` table schema sanity.
 *
 * Covers:
 *  - Table exists via migration + insert round-trips.
 *  - `thread_id` is nullable (compose-from-scratch case).
 *  - `contact_id` is nullable (walk-in recipient case).
 *  - Deleting a thread sets thread_id to NULL (not cascade) — the
 *    half-written draft survives thread deletion.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import { compose_drafts } from "@/lib/db/schema/compose-drafts";
import { threads } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { user } from "@/lib/db/schema/user";

const TEST_DB = path.join(process.cwd(), "tests/.test-compose-drafts.db");

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

const NOW = 1_700_000_000_000;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
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

async function seedUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({
    id,
    email: `andy-${id}@test.local`,
    role: "admin",
    created_at_ms: NOW,
  });
  return id;
}

async function seedCompanyAndContact(): Promise<{
  companyId: string;
  contactId: string;
}> {
  const companyId = randomUUID();
  const contactId = randomUUID();
  await db.insert(companies).values({
    id: companyId,
    name: "Acme",
    name_normalised: "acme",
    billing_mode: "stripe",
    first_seen_at_ms: NOW,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  });
  await db.insert(contacts).values({
    id: contactId,
    company_id: companyId,
    name: "Sam",
    email: "sam@acme.test",
    email_normalised: "sam@acme.test",
    created_at_ms: NOW,
    updated_at_ms: NOW,
  });
  return { companyId, contactId };
}

async function seedThread(contactId: string, companyId: string): Promise<string> {
  const threadId = randomUUID();
  await db.insert(threads).values({
    id: threadId,
    contact_id: contactId,
    company_id: companyId,
    channel_of_origin: "email",
    subject: "Thread subject",
    priority_class: "signal",
    last_message_at_ms: NOW,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  });
  return threadId;
}

describe("compose_drafts schema", () => {
  it("round-trips a full-shape row (all FKs populated)", async () => {
    const authorId = await seedUser();
    const { contactId, companyId } = await seedCompanyAndContact();
    const threadId = await seedThread(contactId, companyId);

    const id = randomUUID();
    await db.insert(compose_drafts).values({
      id,
      author_user_id: authorId,
      thread_id: threadId,
      contact_id: contactId,
      company_id: companyId,
      sending_address: "andy@superbadmedia.com.au",
      to_addresses: ["sam@acme.test"],
      cc_addresses: ["cc@acme.test"],
      bcc_addresses: [],
      subject: "Follow-up",
      body_text: "Half-written body.",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });

    const [row] = await db
      .select()
      .from(compose_drafts)
      .where(eq(compose_drafts.id, id));
    expect(row.body_text).toBe("Half-written body.");
    expect(row.to_addresses).toEqual(["sam@acme.test"]);
    expect(row.cc_addresses).toEqual(["cc@acme.test"]);
  });

  it("allows null thread_id (compose-from-scratch)", async () => {
    const authorId = await seedUser();
    const { contactId, companyId } = await seedCompanyAndContact();
    const id = randomUUID();
    await db.insert(compose_drafts).values({
      id,
      author_user_id: authorId,
      thread_id: null,
      contact_id: contactId,
      company_id: companyId,
      sending_address: "andy@superbadmedia.com.au",
      to_addresses: ["sam@acme.test"],
      subject: null,
      body_text: "",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
    const [row] = await db
      .select()
      .from(compose_drafts)
      .where(eq(compose_drafts.id, id));
    expect(row.thread_id).toBeNull();
  });

  it("allows null contact_id (walk-in recipient)", async () => {
    const authorId = await seedUser();
    const id = randomUUID();
    await db.insert(compose_drafts).values({
      id,
      author_user_id: authorId,
      thread_id: null,
      contact_id: null,
      company_id: null,
      sending_address: "andy@superbadmedia.com.au",
      to_addresses: ["unknown@nowhere.test"],
      subject: "Hi",
      body_text: "Cold reach.",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
    const [row] = await db
      .select()
      .from(compose_drafts)
      .where(eq(compose_drafts.id, id));
    expect(row.contact_id).toBeNull();
    expect(row.company_id).toBeNull();
  });

  it("thread deletion sets draft's thread_id to NULL (ON DELETE set null)", async () => {
    const authorId = await seedUser();
    const { contactId, companyId } = await seedCompanyAndContact();
    const threadId = await seedThread(contactId, companyId);
    const id = randomUUID();
    await db.insert(compose_drafts).values({
      id,
      author_user_id: authorId,
      thread_id: threadId,
      contact_id: contactId,
      company_id: companyId,
      sending_address: "andy@superbadmedia.com.au",
      to_addresses: ["sam@acme.test"],
      subject: "Subj",
      body_text: "Body.",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });

    sqlite.prepare("DELETE FROM threads WHERE id = ?").run(threadId);

    const [row] = await db
      .select()
      .from(compose_drafts)
      .where(eq(compose_drafts.id, id));
    expect(row).toBeTruthy();
    expect(row.thread_id).toBeNull();
    expect(row.body_text).toBe("Body.");
  });
});
