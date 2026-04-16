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
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { messages } from "@/lib/db/schema/messages";
import { notifications } from "@/lib/db/schema/notifications";
import {
  NotifierOutputSchema,
  classifyNotificationPriority,
} from "@/lib/graph/notifier";
import { killSwitches } from "@/lib/kill-switches";
import {
  buildNotifierPrompt,
  type NotifierPromptContext,
} from "@/lib/graph/notifier-prompt";
import type { NormalizedMessage } from "@/lib/graph/normalize";

const TEST_DB = path.join(process.cwd(), "tests/.test-graph-notifier.db");

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
  sqlite.exec("DELETE FROM notifications");
  sqlite.exec("DELETE FROM messages");
  sqlite.exec("DELETE FROM threads");
  sqlite.exec("DELETE FROM user");
});

// ── Helpers ──────────────────────────────────────────────────────────

function seedUser(id = randomUUID(), role = "admin"): string {
  sqlite
    .prepare(
      `INSERT INTO user (id, email, role, timezone, motion_preference,
        sounds_enabled, density_preference, text_size_preference,
        theme_preset, typeface_preset, created_at_ms)
       VALUES (?, ?, ?, 'Australia/Melbourne', 'full', 1, 'comfortable',
        'default', 'base-nova', 'default', ?)`,
    )
    .run(id, `u-${id}@example.com`, role, Date.now());
  return id;
}

function seedThread(id = randomUUID()): string {
  sqlite
    .prepare(
      `INSERT INTO threads (id, channel_of_origin, priority_class, keep_pinned,
        last_message_at_ms, has_cached_draft, cached_draft_stale, created_at_ms, updated_at_ms)
       VALUES (?, 'email', 'signal', 0, ?, 0, 0, ?, ?)`,
    )
    .run(id, Date.now(), Date.now(), Date.now());
  return id;
}

function seedMessage(threadId: string, id = randomUUID()): string {
  sqlite
    .prepare(
      `INSERT INTO messages (id, thread_id, direction, channel, from_address,
        to_addresses, body_text, priority_class, is_engaged, import_source,
        has_attachments, has_calendar_invite, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'inbound', 'email', 'sender@example.com', '[]', 'test body',
        'signal', 0, 'live', 0, 0, ?, ?)`,
    )
    .run(id, threadId, Date.now(), Date.now());
  return id;
}

function makeNormalizedMessage(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  const now = Date.now();
  return {
    id: randomUUID(),
    direction: "inbound",
    channel: "email",
    from_address: "new@example.com",
    to_addresses: ["andy@superbadmedia.com.au"],
    cc_addresses: [],
    bcc_addresses: [],
    subject: "Urgent: site is down",
    body_text: "The site has been offline for 20 minutes. Can you help?",
    body_html: null,
    headers: {},
    message_id_header: null,
    in_reply_to_header: null,
    references_header: null,
    sent_at_ms: now,
    received_at_ms: now,
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
    created_at_ms: now,
    updated_at_ms: now,
    internetMessageId: null,
    inReplyTo: null,
    referencesHeader: null,
    ...overrides,
  } as NormalizedMessage;
}

// ── NotifierOutputSchema tests ───────────────────────────────────────

describe("NotifierOutputSchema — Zod parsing", () => {
  it("parses valid urgent output", () => {
    const result = NotifierOutputSchema.parse({
      priority: "urgent",
      reason: "Current client reporting site outage",
    });
    expect(result.priority).toBe("urgent");
    expect(result.reason).toContain("outage");
  });

  it("parses valid push output", () => {
    const result = NotifierOutputSchema.parse({
      priority: "push",
      reason: "New lead enquiry",
    });
    expect(result.priority).toBe("push");
  });

  it("parses valid silent output", () => {
    const result = NotifierOutputSchema.parse({
      priority: "silent",
      reason: "Automated receipt",
    });
    expect(result.priority).toBe("silent");
  });

  it("rejects unknown priority", () => {
    expect(() =>
      NotifierOutputSchema.parse({
        priority: "high",
        reason: "bad",
      }),
    ).toThrow();
  });

  it("rejects missing reason", () => {
    expect(() =>
      NotifierOutputSchema.parse({ priority: "silent" }),
    ).toThrow();
  });
});

// ── buildNotifierPrompt tests ────────────────────────────────────────

describe("buildNotifierPrompt", () => {
  it("includes message, thread context, and corrections", () => {
    const ctx: NotifierPromptContext = {
      message: makeNormalizedMessage(),
      thread: {
        is_client: true,
        relationship_type: "client",
        ticket_status: "open",
        waiting_on_andy: true,
        notification_weight: 2,
      },
      corrections: [
        {
          from_address: "noreply@receipts.com",
          subject: "Your receipt",
          original: "push",
          corrected: "silent",
        },
      ],
    };

    const prompt = buildNotifierPrompt(ctx);
    expect(prompt).toContain("Urgent: site is down");
    expect(prompt).toContain("Is a client (current or past): yes");
    expect(prompt).toContain("Support ticket status: open");
    expect(prompt).toContain("Waiting on Andy's reply: yes");
    expect(prompt).toContain("+2");
    expect(prompt).toContain("PREVIOUS CORRECTIONS");
    expect(prompt).toContain("noreply@receipts.com");
    expect(prompt).toContain("urgent");
    expect(prompt).toContain("silent");
  });

  it("handles empty corrections and neutral weight", () => {
    const ctx: NotifierPromptContext = {
      message: makeNormalizedMessage({ subject: "Hello" }),
      thread: {
        is_client: false,
        relationship_type: null,
        ticket_status: null,
        waiting_on_andy: false,
        notification_weight: 0,
      },
      corrections: [],
    };

    const prompt = buildNotifierPrompt(ctx);
    expect(prompt).not.toContain("PREVIOUS CORRECTIONS");
    expect(prompt).toContain("neutral");
    expect(prompt).toContain("Is a client (current or past): no");
  });

  it("flags negative notification_weight in the hint", () => {
    const ctx: NotifierPromptContext = {
      message: makeNormalizedMessage(),
      thread: {
        is_client: false,
        relationship_type: "non_client",
        ticket_status: null,
        waiting_on_andy: false,
        notification_weight: -3,
      },
      corrections: [],
    };

    const prompt = buildNotifierPrompt(ctx);
    expect(prompt).toContain("silenced this contact");
    expect(prompt).toContain("-3");
  });

  it("truncates body to 2000 chars", () => {
    const longBody = "y".repeat(5000);
    const ctx: NotifierPromptContext = {
      message: makeNormalizedMessage({ body_text: longBody }),
      thread: {
        is_client: false,
        relationship_type: null,
        ticket_status: null,
        waiting_on_andy: false,
        notification_weight: 0,
      },
      corrections: [],
    };

    const prompt = buildNotifierPrompt(ctx);
    expect(prompt).not.toContain("y".repeat(2001));
  });
});

// ── notifications table tests ────────────────────────────────────────

describe("notifications table", () => {
  it("allows inserting a silent-priority row with fired_transport 'none'", () => {
    const userId = seedUser();
    const threadId = seedThread();
    const messageId = seedMessage(threadId);
    const id = randomUUID();

    testDb
      .insert(notifications)
      .values({
        id,
        message_id: messageId,
        user_id: userId,
        priority: "silent",
        fired_transport: "none",
        fired_at_ms: Date.now(),
        reason: "Automated receipt",
      })
      .run();

    const row = testDb
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .get();

    expect(row).toBeTruthy();
    expect(row!.priority).toBe("silent");
    expect(row!.fired_transport).toBe("none");
    expect(row!.correction_action).toBeNull();
  });

  it("allows push-priority row with NULL fired_transport (awaiting dispatcher)", () => {
    const userId = seedUser();
    const threadId = seedThread();
    const messageId = seedMessage(threadId);
    const id = randomUUID();

    testDb
      .insert(notifications)
      .values({
        id,
        message_id: messageId,
        user_id: userId,
        priority: "push",
        fired_transport: null,
        fired_at_ms: Date.now(),
        reason: "New lead enquiry",
      })
      .run();

    const row = testDb
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .get();

    expect(row!.priority).toBe("push");
    expect(row!.fired_transport).toBeNull();
  });

  it("rejects invalid priority via CHECK constraint", () => {
    const userId = seedUser();
    const threadId = seedThread();
    const messageId = seedMessage(threadId);

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO notifications (id, message_id, user_id, priority, fired_at_ms, reason)
           VALUES (?, ?, ?, 'loud', ?, 'bad')`,
        )
        .run(randomUUID(), messageId, userId, Date.now()),
    ).toThrow();
  });

  it("cascades on message deletion", () => {
    const userId = seedUser();
    const threadId = seedThread();
    const messageId = seedMessage(threadId);
    const notifId = randomUUID();

    testDb
      .insert(notifications)
      .values({
        id: notifId,
        message_id: messageId,
        user_id: userId,
        priority: "urgent",
        fired_transport: null,
        fired_at_ms: Date.now(),
        reason: "Client emergency",
      })
      .run();

    testDb.delete(messages).where(eq(messages.id, messageId)).run();

    const row = testDb
      .select()
      .from(notifications)
      .where(eq(notifications.id, notifId))
      .get();
    expect(row).toBeUndefined();
  });

  it("classifier short-circuits when kill switches are off", async () => {
    const prevSync = killSwitches.inbox_sync_enabled;
    const prevLlm = killSwitches.llm_calls_enabled;
    killSwitches.inbox_sync_enabled = false;
    killSwitches.llm_calls_enabled = false;

    try {
      const result = await classifyNotificationPriority(
        makeNormalizedMessage(),
        "msg-never-persisted",
        "thread-never-persisted",
      );
      expect(result.skipped).toBe(true);
      expect(result.priority).toBe("silent");
      expect(result.reason).toContain("kill switch");
    } finally {
      killSwitches.inbox_sync_enabled = prevSync;
      killSwitches.llm_calls_enabled = prevLlm;
    }
  });

  it("allows recording a correction_action after delivery", () => {
    const userId = seedUser();
    const threadId = seedThread();
    const messageId = seedMessage(threadId);
    const notifId = randomUUID();

    testDb
      .insert(notifications)
      .values({
        id: notifId,
        message_id: messageId,
        user_id: userId,
        priority: "silent",
        fired_transport: "none",
        fired_at_ms: Date.now(),
        reason: "Auto-classified silent",
      })
      .run();

    const correctionAt = Date.now();
    testDb
      .update(notifications)
      .set({
        correction_action: "user_corrected_up",
        correction_at_ms: correctionAt,
      })
      .where(eq(notifications.id, notifId))
      .run();

    const row = testDb
      .select()
      .from(notifications)
      .where(eq(notifications.id, notifId))
      .get();
    expect(row!.correction_action).toBe("user_corrected_up");
    expect(row!.correction_at_ms).toBe(correctionAt);
  });
});
