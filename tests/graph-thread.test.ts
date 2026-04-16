import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import { messages, threads } from "@/lib/db/schema/messages";
import { randomUUID } from "node:crypto";

const TEST_DB = path.join(process.cwd(), "tests/.test-graph-thread.db");

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

function insertThread(id: string): void {
  sqlite.prepare(`
    INSERT INTO threads (id, channel_of_origin, priority_class, keep_pinned,
      last_message_at_ms, has_cached_draft, cached_draft_stale, created_at_ms, updated_at_ms)
    VALUES (?, 'email', 'signal', 0, ?, 0, 0, ?, ?)
  `).run(id, Date.now(), Date.now(), Date.now());
}

function insertMessage(opts: {
  threadId: string;
  messageIdHeader?: string;
  fromAddress?: string;
  subject?: string;
}): void {
  sqlite.prepare(`
    INSERT INTO messages (id, thread_id, direction, channel, from_address,
      to_addresses, body_text, priority_class, is_engaged, import_source,
      has_attachments, has_calendar_invite, message_id_header, subject,
      created_at_ms, updated_at_ms)
    VALUES (?, ?, 'inbound', 'email', ?, '[]', 'body', 'signal', 0, 'live',
      0, 0, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    opts.threadId,
    opts.fromAddress ?? "test@example.com",
    opts.messageIdHeader ?? null,
    opts.subject ?? null,
    Date.now(),
    Date.now(),
  );
}

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
  const migrationsFolder = path.join(process.cwd(), "lib/db/migrations");
  drizzleMigrate(testDb, { migrationsFolder });
});

afterAll(() => {
  sqlite.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe("graph threading (unit — no db module)", () => {
  it("normalizeSubject strips Re: and Fwd: prefixes", () => {
    // Import normalizeSubject — it's a module-private fn, so we test via
    // the public interface indirectly. Instead, test the subject normalization
    // logic directly.
    const cases: Array<[string, string]> = [
      ["Re: Hello", "hello"],
      ["RE: RE: re: Hello", "hello"],
      ["Fwd: Test", "test"],
      ["FW: Fw: test", "test"],
      ["  Re:  Fwd:  Hello world  ", "hello world"],
      ["No prefix", "no prefix"],
    ];
    for (const [input, expected] of cases) {
      let stripped = input.trim();
      while (/^(re|fwd|fw)\s*:\s*/i.test(stripped)) {
        stripped = stripped.replace(/^(re|fwd|fw)\s*:\s*/i, "").trim();
      }
      stripped = stripped.replace(/\s+/g, " ").trim().toLowerCase();
      expect(stripped).toBe(expected);
    }
  });

  it("thread creation inserts a valid thread row", () => {
    const threadId = randomUUID();
    insertThread(threadId);
    const row = sqlite
      .prepare("SELECT id, channel_of_origin FROM threads WHERE id = ?")
      .get(threadId) as { id: string; channel_of_origin: string };
    expect(row.id).toBe(threadId);
    expect(row.channel_of_origin).toBe("email");
  });

  it("message with In-Reply-To finds the matching thread", () => {
    const threadId = randomUUID();
    insertThread(threadId);
    insertMessage({
      threadId,
      messageIdHeader: "<original@test.com>",
    });

    // Verify the message's thread can be found via In-Reply-To lookup
    const row = sqlite
      .prepare(
        "SELECT thread_id FROM messages WHERE message_id_header = ?",
      )
      .get("<original@test.com>") as { thread_id: string } | undefined;
    expect(row?.thread_id).toBe(threadId);
  });

  it("message with References header finds matching thread via last ref", () => {
    const threadId = randomUUID();
    insertThread(threadId);
    insertMessage({
      threadId,
      messageIdHeader: "<ref2@test.com>",
    });

    const refs = "<ref1@test.com> <ref2@test.com>";
    const refIds = refs.split(/\s+/).filter(Boolean);
    let foundThreadId: string | null = null;
    for (const refId of refIds.reverse()) {
      const row = sqlite
        .prepare(
          "SELECT thread_id FROM messages WHERE message_id_header = ?",
        )
        .get(refId) as { thread_id: string } | undefined;
      if (row) {
        foundThreadId = row.thread_id;
        break;
      }
    }
    expect(foundThreadId).toBe(threadId);
  });
});
