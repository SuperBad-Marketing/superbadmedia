import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { randomUUID } from "node:crypto";
import { threads, messages } from "@/lib/db/schema/messages";
import {
  external_call_log,
  EXTERNAL_CALL_ACTOR_TYPES,
} from "@/lib/db/schema/external-call-log";

const TEST_DB = path.join(process.cwd(), "tests/.test-messages.db");

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

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

describe("threads + messages producer schema", () => {
  it("inserts a thread + message pair and foreign-keys cascade", async () => {
    const threadId = randomUUID();
    const messageId = randomUUID();
    await db.insert(threads).values({
      id: threadId,
      channel_of_origin: "email",
      sending_address: "andy@",
      subject: "test thread",
      last_message_at_ms: Date.now(),
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    });
    await db.insert(messages).values({
      id: messageId,
      thread_id: threadId,
      direction: "inbound",
      channel: "email",
      from_address: "customer@example.com",
      to_addresses: ["andy@superbadmedia.com.au"],
      body_text: "hello",
      sent_at_ms: Date.now(),
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    });
    const rows = await db.select().from(messages);
    expect(rows.length).toBe(1);
    expect(rows[0].to_addresses).toEqual(["andy@superbadmedia.com.au"]);

    // FK cascade: delete thread should remove message.
    sqlite.prepare("DELETE FROM threads WHERE id = ?").run(threadId);
    const remaining = await db.select().from(messages);
    expect(remaining.length).toBe(0);
  });

  it("defaults priority_class to signal and keep_pinned to false", async () => {
    const id = randomUUID();
    await db.insert(threads).values({
      id,
      channel_of_origin: "portal_chat",
      last_message_at_ms: Date.now(),
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    });
    const [row] = await db.select().from(threads);
    expect(row.priority_class).toBe("signal");
    expect(row.keep_pinned).toBe(false);
    expect(row.has_cached_draft).toBe(false);
  });
});

describe("external_call_log schema", () => {
  it("supports every actor_type + round-trips json + decimal cost", async () => {
    for (const actor_type of EXTERNAL_CALL_ACTOR_TYPES) {
      await db.insert(external_call_log).values({
        id: randomUUID(),
        job: "quote-builder-draft-from-context",
        actor_type,
        units: { input_tokens: 1200, output_tokens: 300 },
        estimated_cost_aud: 0.0425,
        created_at_ms: Date.now(),
      });
    }
    const rows = await db.select().from(external_call_log);
    expect(rows.length).toBe(EXTERNAL_CALL_ACTOR_TYPES.length);
    expect(rows[0].units).toEqual({ input_tokens: 1200, output_tokens: 300 });
    expect(rows[0].estimated_cost_aud).toBeCloseTo(0.0425, 4);
  });
});
