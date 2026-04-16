import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  next23MelbourneMs,
  INBOX_HYGIENE_TASK_KEY_PREFIX,
} from "@/lib/scheduled-tasks/handlers/inbox-hygiene-purge";

const TEST_DB = path.join(process.cwd(), "tests/.test-inbox-hygiene-purge.db");

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

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

beforeEach(() => {
  sqlite.exec("DELETE FROM scheduled_tasks");
  sqlite.exec("DELETE FROM messages");
  sqlite.exec("DELETE FROM threads");
});

// ── next23MelbourneMs ────────────────────────────────────────────────

describe("next23MelbourneMs", () => {
  it("returns a future epoch-ms", () => {
    const now = Date.now();
    const result = next23MelbourneMs(now);
    expect(result).toBeGreaterThan(now);
  });

  it("returns a timestamp whose Melbourne hour is 23:00", () => {
    const now = Date.now();
    const result = next23MelbourneMs(now);
    const melbourneHour = new Intl.DateTimeFormat("en-US", {
      timeZone: "Australia/Melbourne",
      hour: "2-digit",
      hour12: false,
    })
      .format(new Date(result))
      .replace(/[^0-9]/g, "");
    expect(melbourneHour).toBe("23");
  });

  it("advances to tomorrow if we are already past 23:00 Melbourne", () => {
    // Fabricate a "now" that is 23:30 Melbourne by using the computed
    // 23:00 today and adding 30 minutes. Then feed that back and expect
    // tomorrow's 23:00.
    const baseline = Date.now();
    const today23 = next23MelbourneMs(baseline);
    const pretendNow = today23 + 30 * 60 * 1000;
    const tomorrow23 = next23MelbourneMs(pretendNow);
    expect(tomorrow23).toBeGreaterThan(pretendNow);
    // Tomorrow's 23:00 should be within 24–25 hours of today's 23:00
    // (allows for DST transition ±1h).
    const diffHours = (tomorrow23 - today23) / (60 * 60 * 1000);
    expect(diffHours).toBeGreaterThanOrEqual(23);
    expect(diffHours).toBeLessThanOrEqual(25);
  });

  it("exposes a stable idempotency-key prefix", () => {
    expect(INBOX_HYGIENE_TASK_KEY_PREFIX).toBe("inbox_hygiene_purge:");
  });
});

// ── Soft-delete candidate selection ──────────────────────────────────

describe("soft-delete candidate selection (SQL-level)", () => {
  it("row with keep_until_ms in the past and no engagement is a candidate", () => {
    const threadId = randomUUID();
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO threads (id, channel_of_origin, priority_class, keep_pinned,
          last_message_at_ms, has_cached_draft, cached_draft_stale, created_at_ms, updated_at_ms)
         VALUES (?, 'email', 'noise', 0, ?, 0, 0, ?, ?)`,
      )
      .run(threadId, now, now, now);

    const stale = now - 24 * 60 * 60 * 1000;
    const id = randomUUID();
    sqlite
      .prepare(
        `INSERT INTO messages (id, thread_id, direction, channel, from_address,
          to_addresses, body_text, priority_class, noise_subclass, is_engaged,
          import_source, has_attachments, has_calendar_invite,
          keep_until_ms, deleted_at_ms, created_at_ms, updated_at_ms)
         VALUES (?, ?, 'inbound', 'email', 'noreply@foo.com', '[]', 'body',
          'noise', 'marketing', 0, 'live', 0, 0, ?, NULL, ?, ?)`,
      )
      .run(id, threadId, stale, now, now);

    const rows = sqlite
      .prepare(
        `SELECT id FROM messages
         WHERE keep_until_ms IS NOT NULL
           AND keep_until_ms < ?
           AND deleted_at_ms IS NULL
           AND is_engaged = 0`,
      )
      .all(now) as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).toContain(id);
  });

  it("row with is_engaged = 1 is excluded even if expired", () => {
    const threadId = randomUUID();
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO threads (id, channel_of_origin, priority_class, keep_pinned,
          last_message_at_ms, has_cached_draft, cached_draft_stale, created_at_ms, updated_at_ms)
         VALUES (?, 'email', 'noise', 0, ?, 0, 0, ?, ?)`,
      )
      .run(threadId, now, now, now);

    const stale = now - 24 * 60 * 60 * 1000;
    const id = randomUUID();
    sqlite
      .prepare(
        `INSERT INTO messages (id, thread_id, direction, channel, from_address,
          to_addresses, body_text, priority_class, noise_subclass, is_engaged,
          import_source, has_attachments, has_calendar_invite,
          keep_until_ms, deleted_at_ms, created_at_ms, updated_at_ms)
         VALUES (?, ?, 'inbound', 'email', 'noreply@foo.com', '[]', 'body',
          'noise', 'marketing', 1, 'live', 0, 0, ?, NULL, ?, ?)`,
      )
      .run(id, threadId, stale, now, now);

    const rows = sqlite
      .prepare(
        `SELECT id FROM messages
         WHERE keep_until_ms IS NOT NULL
           AND keep_until_ms < ?
           AND deleted_at_ms IS NULL
           AND is_engaged = 0`,
      )
      .all(now) as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).not.toContain(id);
  });

  it("row with keep_until_ms IS NULL (signal) is excluded", () => {
    const threadId = randomUUID();
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO threads (id, channel_of_origin, priority_class, keep_pinned,
          last_message_at_ms, has_cached_draft, cached_draft_stale, created_at_ms, updated_at_ms)
         VALUES (?, 'email', 'signal', 0, ?, 0, 0, ?, ?)`,
      )
      .run(threadId, now, now, now);

    const id = randomUUID();
    sqlite
      .prepare(
        `INSERT INTO messages (id, thread_id, direction, channel, from_address,
          to_addresses, body_text, priority_class, noise_subclass, is_engaged,
          import_source, has_attachments, has_calendar_invite,
          keep_until_ms, deleted_at_ms, created_at_ms, updated_at_ms)
         VALUES (?, ?, 'inbound', 'email', 'client@foo.com', '[]', 'body',
          'signal', NULL, 0, 'live', 0, 0, NULL, NULL, ?, ?)`,
      )
      .run(id, threadId, now, now);

    const rows = sqlite
      .prepare(
        `SELECT id FROM messages
         WHERE keep_until_ms IS NOT NULL
           AND keep_until_ms < ?
           AND deleted_at_ms IS NULL
           AND is_engaged = 0`,
      )
      .all(now) as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).not.toContain(id);
  });

  it("already-soft-deleted row is excluded", () => {
    const threadId = randomUUID();
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO threads (id, channel_of_origin, priority_class, keep_pinned,
          last_message_at_ms, has_cached_draft, cached_draft_stale, created_at_ms, updated_at_ms)
         VALUES (?, 'email', 'noise', 0, ?, 0, 0, ?, ?)`,
      )
      .run(threadId, now, now, now);

    const stale = now - 24 * 60 * 60 * 1000;
    const softDeletedAt = now - 2 * 60 * 60 * 1000;
    const id = randomUUID();
    sqlite
      .prepare(
        `INSERT INTO messages (id, thread_id, direction, channel, from_address,
          to_addresses, body_text, priority_class, noise_subclass, is_engaged,
          import_source, has_attachments, has_calendar_invite,
          keep_until_ms, deleted_at_ms, created_at_ms, updated_at_ms)
         VALUES (?, ?, 'inbound', 'email', 'noreply@foo.com', '[]', 'body',
          'noise', 'marketing', 0, 'live', 0, 0, ?, ?, ?, ?)`,
      )
      .run(id, threadId, stale, softDeletedAt, now, now);

    const rows = sqlite
      .prepare(
        `SELECT id FROM messages
         WHERE keep_until_ms IS NOT NULL
           AND keep_until_ms < ?
           AND deleted_at_ms IS NULL
           AND is_engaged = 0`,
      )
      .all(now) as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).not.toContain(id);
  });
});

// ── Hard-delete candidate selection ──────────────────────────────────

describe("hard-delete candidate selection (SQL-level)", () => {
  it("soft-deleted more than 14 days ago is eligible for hard-delete", () => {
    const threadId = randomUUID();
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO threads (id, channel_of_origin, priority_class, keep_pinned,
          last_message_at_ms, has_cached_draft, cached_draft_stale, created_at_ms, updated_at_ms)
         VALUES (?, 'email', 'noise', 0, ?, 0, 0, ?, ?)`,
      )
      .run(threadId, now, now, now);

    const TRASH_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
    const eligibleId = randomUUID();
    const tooRecentId = randomUUID();
    sqlite
      .prepare(
        `INSERT INTO messages (id, thread_id, direction, channel, from_address,
          to_addresses, body_text, priority_class, noise_subclass, is_engaged,
          import_source, has_attachments, has_calendar_invite,
          keep_until_ms, deleted_at_ms, created_at_ms, updated_at_ms)
         VALUES (?, ?, 'inbound', 'email', 'noreply@foo.com', '[]', 'body',
          'noise', 'marketing', 0, 'live', 0, 0, NULL, ?, ?, ?)`,
      )
      .run(eligibleId, threadId, now - TRASH_RETENTION_MS - 1, now, now);
    sqlite
      .prepare(
        `INSERT INTO messages (id, thread_id, direction, channel, from_address,
          to_addresses, body_text, priority_class, noise_subclass, is_engaged,
          import_source, has_attachments, has_calendar_invite,
          keep_until_ms, deleted_at_ms, created_at_ms, updated_at_ms)
         VALUES (?, ?, 'inbound', 'email', 'noreply@foo.com', '[]', 'body',
          'noise', 'marketing', 0, 'live', 0, 0, NULL, ?, ?, ?)`,
      )
      .run(tooRecentId, threadId, now - 1 * 24 * 60 * 60 * 1000, now, now);

    const cutoffMs = now - TRASH_RETENTION_MS;
    const rows = sqlite
      .prepare(
        `SELECT id FROM messages
         WHERE deleted_at_ms IS NOT NULL
           AND deleted_at_ms < ?`,
      )
      .all(cutoffMs) as Array<{ id: string }>;
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(eligibleId);
    expect(ids).not.toContain(tooRecentId);
  });
});
