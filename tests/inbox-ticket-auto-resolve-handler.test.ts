/**
 * UI-10 — support@ ticket idle auto-resolve handler.
 *
 * Covers per brief §5:
 *  - Idle >7d ticket → flipped to 'resolved', activity row logged
 *  - Active (<7d) ticket → left on 'open', re-enqueues next check
 *  - Already 'resolved' ticket → untouched (no-op)
 *
 * Per-file SQLite DB, seeded via `drizzleMigrate` — migration 0037
 * writes the `inbox.ticket_auto_resolve_idle_days` settings row inline,
 * so `settings.get()` resolves to 7 without a separate seed step.
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
  afterEach,
  vi,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(
  process.cwd(),
  "tests/.test-inbox-ticket-auto-resolve.db",
);
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const { handleInboxTicketAutoResolveIdle } = await import(
  "@/lib/scheduled-tasks/handlers/inbox-ticket-auto-resolve"
);
const { threads } = await import("@/lib/db/schema/messages");
const { activity_log } = await import("@/lib/db/schema/activity-log");
const { scheduled_tasks } = await import("@/lib/db/schema/scheduled-tasks");
const settingsMod = await import("@/lib/settings");
const settings = settingsMod.default;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function makeTask(threadId: string) {
  return {
    id: randomUUID(),
    task_type: "inbox_ticket_auto_resolve_idle" as const,
    run_at_ms: NOW,
    payload: { thread_id: threadId } as Record<string, unknown> | null,
    status: "running" as const,
    attempts: 1,
    last_attempted_at_ms: NOW,
    last_error: null,
    idempotency_key: null,
    created_at_ms: NOW,
    done_at_ms: null,
    reclaimed_at_ms: null,
  };
}

function seedTicketThread({
  ticketStatus,
  lastActivityMs,
}: {
  ticketStatus: "open" | "waiting_on_customer" | "resolved";
  lastActivityMs: number;
}): string {
  const id = randomUUID();
  testDb
    .insert(threads)
    .values({
      id,
      contact_id: null,
      company_id: null,
      channel_of_origin: "email",
      sending_address: "support@",
      subject: "Ticket subject",
      priority_class: "signal",
      keep_pinned: false,
      ticket_type: "question",
      ticket_status: ticketStatus,
      ticket_type_assigned_by: "claude",
      ticket_resolved_at_ms:
        ticketStatus === "resolved" ? lastActivityMs : null,
      last_message_at_ms: lastActivityMs,
      last_inbound_at_ms: lastActivityMs,
      last_outbound_at_ms: lastActivityMs,
      created_at_ms: lastActivityMs,
      updated_at_ms: lastActivityMs,
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
  testDb.delete(scheduled_tasks).run();
  testDb.delete(activity_log).run();
  testDb.delete(threads).run();
  settings.invalidateCache();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("handleInboxTicketAutoResolveIdle", () => {
  it("flips an idle (>7d) open ticket to 'resolved' and logs activity", async () => {
    const stale = NOW - 8 * MS_PER_DAY;
    const threadId = seedTicketThread({
      ticketStatus: "open",
      lastActivityMs: stale,
    });

    await handleInboxTicketAutoResolveIdle(makeTask(threadId));

    const row = testDb
      .select({
        ticket_status: threads.ticket_status,
        ticket_resolved_at_ms: threads.ticket_resolved_at_ms,
      })
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(row!.ticket_status).toBe("resolved");
    expect(row!.ticket_resolved_at_ms).toBe(NOW);

    const logRows = testDb.select().from(activity_log).all() as Array<{
      kind: string;
    }>;
    expect(
      logRows.some((r) => r.kind === "inbox_ticket_auto_resolved"),
    ).toBe(true);
  });

  it("leaves an active (<7d) ticket on 'open' and re-enqueues a future check", async () => {
    const recent = NOW - 2 * MS_PER_DAY;
    const threadId = seedTicketThread({
      ticketStatus: "open",
      lastActivityMs: recent,
    });

    await handleInboxTicketAutoResolveIdle(makeTask(threadId));

    const row = testDb
      .select({
        ticket_status: threads.ticket_status,
        ticket_resolved_at_ms: threads.ticket_resolved_at_ms,
      })
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(row!.ticket_status).toBe("open");
    expect(row!.ticket_resolved_at_ms).toBeNull();

    const tasks = testDb.select().from(scheduled_tasks).all() as Array<{
      task_type: string;
    }>;
    expect(
      tasks.some((t) => t.task_type === "inbox_ticket_auto_resolve_idle"),
    ).toBe(true);

    const logRows = testDb.select().from(activity_log).all() as Array<{
      kind: string;
    }>;
    expect(
      logRows.some((r) => r.kind === "inbox_ticket_auto_resolved"),
    ).toBe(false);
  });

  it("leaves an already-resolved ticket alone (no status change, no log)", async () => {
    const stale = NOW - 30 * MS_PER_DAY;
    const threadId = seedTicketThread({
      ticketStatus: "resolved",
      lastActivityMs: stale,
    });

    await handleInboxTicketAutoResolveIdle(makeTask(threadId));

    const row = testDb
      .select({
        ticket_status: threads.ticket_status,
        ticket_resolved_at_ms: threads.ticket_resolved_at_ms,
      })
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(row!.ticket_status).toBe("resolved");
    expect(row!.ticket_resolved_at_ms).toBe(stale);

    const logRows = testDb.select().from(activity_log).all();
    expect(logRows.length).toBe(0);

    const tasks = testDb.select().from(scheduled_tasks).all();
    expect(tasks.length).toBe(0);
  });
});
