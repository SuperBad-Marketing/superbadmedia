/**
 * UI-5 — Scheduled-task handler (`inbox_draft_generate`) + the
 * enqueue+invalidation wiring in `lib/graph/sync.ts`.
 *
 * Covers:
 *  - Handler parses valid payload + dispatches to generator (1)
 *  - Handler rejects invalid payload (1)
 *  - Enqueue path — client-facing thread → inserts task + flips stale (1)
 *  - Enqueue path — non-client thread → no task (1)
 *  - Idempotency key debounces repeat enqueues inside the 60s bucket (1)
 *  - Kill-switch skip (enqueue gate) (1)
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

const mockGenerateCachedDraftReply = vi.hoisted(() => vi.fn());
vi.mock("@/lib/graph/draft-reply", () => ({
  generateCachedDraftReply: mockGenerateCachedDraftReply,
}));

const mockKillSwitches = vi.hoisted(() => ({
  inbox_sync_enabled: true,
  llm_calls_enabled: true,
  scheduled_tasks_enabled: false,
  outreach_send_enabled: false,
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: mockKillSwitches,
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-inbox-draft-generate.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const {
  handleInboxDraftGenerate,
  InboxDraftGeneratePayloadSchema,
  INBOX_DRAFT_HANDLERS,
} = await import("@/lib/scheduled-tasks/handlers/inbox-draft-generate");
const { maybeEnqueueDraftGeneration } = await import("@/lib/graph/sync");
const { threads } = await import("@/lib/db/schema/messages");
const { contacts } = await import("@/lib/db/schema/contacts");
const { companies } = await import("@/lib/db/schema/companies");
const { scheduled_tasks } = await import("@/lib/db/schema/scheduled-tasks");

const NOW = 1_700_000_000_000;

function makeTask(payload: unknown) {
  return {
    id: randomUUID(),
    task_type: "inbox_draft_generate" as const,
    run_at_ms: NOW,
    payload: payload as Record<string, unknown> | null,
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

async function seedThread(
  relationship:
    | "client"
    | "past_client"
    | "lead"
    | "non_client"
    | "supplier"
    | null,
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
      relationship_type: relationship,
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
      priority_class: "signal",
      last_message_at_ms: NOW,
      cached_draft_body: "prior cached draft",
      has_cached_draft: true,
      cached_draft_stale: false,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return threadId;
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
  testDb.delete(scheduled_tasks).run();
  testDb.delete(threads).run();
  testDb.delete(contacts).run();
  testDb.delete(companies).run();
  mockGenerateCachedDraftReply.mockReset();
  mockGenerateCachedDraftReply.mockResolvedValue({
    outcome: "generated",
    draft_body: "",
    low_confidence_flags: [],
    reason: "ok",
  });
  mockKillSwitches.inbox_sync_enabled = true;
  mockKillSwitches.llm_calls_enabled = true;
});

// ── Handler — payload shape + dispatch ───────────────────────────────

describe("handleInboxDraftGenerate", () => {
  it("parses a valid payload and dispatches to generateCachedDraftReply", async () => {
    await handleInboxDraftGenerate(makeTask({ thread_id: "thread-xyz" }));
    expect(mockGenerateCachedDraftReply).toHaveBeenCalledWith("thread-xyz");
  });

  it("throws on invalid payload (missing thread_id)", async () => {
    await expect(handleInboxDraftGenerate(makeTask({}))).rejects.toThrow(
      /invalid payload/,
    );
    expect(mockGenerateCachedDraftReply).not.toHaveBeenCalled();
  });

  it("InboxDraftGeneratePayloadSchema rejects empty thread_id", () => {
    expect(() =>
      InboxDraftGeneratePayloadSchema.parse({ thread_id: "" }),
    ).toThrow();
  });

  it("INBOX_DRAFT_HANDLERS registers the inbox_draft_generate type", () => {
    expect(INBOX_DRAFT_HANDLERS.inbox_draft_generate).toBe(
      handleInboxDraftGenerate,
    );
  });
});

// ── Enqueue — client-facing / non-client / kill-switch ───────────────

describe("maybeEnqueueDraftGeneration", () => {
  it("enqueues inbox_draft_generate + flips cached_draft_stale for a client thread", async () => {
    const threadId = await seedThread("client");
    const enqueued = await maybeEnqueueDraftGeneration(
      threadId,
      {
        classification: "match_existing",
        contactId: null,
        reason: "ok",
        skipped: false,
      },
      {
        priority_class: "signal",
        noise_subclass: null,
        reason: "ok",
        skipped: false,
      },
    );
    expect(enqueued).toBe(true);

    const taskRow = testDb
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.task_type, "inbox_draft_generate"))
      .get();
    expect(taskRow).toBeTruthy();
    expect(taskRow!.idempotency_key).toMatch(
      new RegExp(`^inbox-draft-generate:${threadId}:\\d+$`),
    );
    expect((taskRow!.payload as { thread_id: string }).thread_id).toBe(threadId);

    const threadRow = testDb
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(threadRow!.cached_draft_stale).toBe(true);
    // Prior cached draft body must NOT be clobbered (discipline #60).
    expect(threadRow!.cached_draft_body).toBe("prior cached draft");
  });

  it("does not enqueue for a non_client thread", async () => {
    const threadId = await seedThread("non_client");
    const enqueued = await maybeEnqueueDraftGeneration(
      threadId,
      {
        classification: "non_client",
        contactId: null,
        reason: "ok",
        skipped: false,
      },
      {
        priority_class: "signal",
        noise_subclass: null,
        reason: "ok",
        skipped: false,
      },
    );
    expect(enqueued).toBe(false);

    const count = testDb
      .select()
      .from(scheduled_tasks)
      .all().length;
    expect(count).toBe(0);
  });

  it("does not enqueue when router classified as spam", async () => {
    const threadId = await seedThread("client");
    const enqueued = await maybeEnqueueDraftGeneration(
      threadId,
      {
        classification: "spam",
        contactId: null,
        reason: "ok",
        skipped: false,
      },
      {
        priority_class: "signal",
        noise_subclass: null,
        reason: "ok",
        skipped: false,
      },
    );
    expect(enqueued).toBe(false);
  });

  it("debounces repeat enqueues inside the same 60s bucket", async () => {
    const threadId = await seedThread("client");
    const firstCall = await maybeEnqueueDraftGeneration(
      threadId,
      {
        classification: "match_existing",
        contactId: null,
        reason: "ok",
        skipped: false,
      },
      {
        priority_class: "signal",
        noise_subclass: null,
        reason: "ok",
        skipped: false,
      },
    );
    const secondCall = await maybeEnqueueDraftGeneration(
      threadId,
      {
        classification: "match_existing",
        contactId: null,
        reason: "ok",
        skipped: false,
      },
      {
        priority_class: "signal",
        noise_subclass: null,
        reason: "ok",
        skipped: false,
      },
    );
    expect(firstCall).toBe(true);
    expect(secondCall).toBe(true);

    const count = testDb
      .select()
      .from(scheduled_tasks)
      .all().length;
    expect(count).toBe(1);
  });

  it("skips enqueue when kill switches are off", async () => {
    const threadId = await seedThread("client");
    mockKillSwitches.inbox_sync_enabled = false;
    const enqueued = await maybeEnqueueDraftGeneration(
      threadId,
      {
        classification: "match_existing",
        contactId: null,
        reason: "ok",
        skipped: false,
      },
      {
        priority_class: "signal",
        noise_subclass: null,
        reason: "ok",
        skipped: false,
      },
    );
    expect(enqueued).toBe(false);

    const count = testDb
      .select()
      .from(scheduled_tasks)
      .all().length;
    expect(count).toBe(0);

    const threadRow = testDb
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    // No stale flip when we short-circuit upstream.
    expect(threadRow!.cached_draft_stale).toBe(false);
  });
});
