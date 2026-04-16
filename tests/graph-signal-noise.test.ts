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
import { eq } from "drizzle-orm";
import { messages } from "@/lib/db/schema/messages";
import {
  SignalNoiseOutputSchema,
  classifySignalNoise,
  computeMessageKeepUntilMs,
} from "@/lib/graph/signal-noise";
import {
  buildSignalNoisePrompt,
  type SignalNoisePromptContext,
} from "@/lib/graph/signal-noise-prompt";
import { killSwitches } from "@/lib/kill-switches";
import type { NormalizedMessage } from "@/lib/graph/normalize";

const TEST_DB = path.join(process.cwd(), "tests/.test-graph-signal-noise.db");

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
  sqlite.exec("DELETE FROM messages");
  sqlite.exec("DELETE FROM threads");
});

// ── Helpers ──────────────────────────────────────────────────────────

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

function makeNormalizedMessage(
  overrides: Partial<NormalizedMessage> = {},
): NormalizedMessage {
  const now = Date.now();
  return {
    id: randomUUID(),
    direction: "inbound",
    channel: "email",
    from_address: "sender@example.com",
    to_addresses: ["andy@superbadmedia.com.au"],
    cc_addresses: [],
    bcc_addresses: [],
    subject: "Your receipt for order #1234",
    body_text: "Thanks for your purchase. Total: $49.00.",
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
    keep_until_ms: null,
    deleted_at_ms: null,
    created_at_ms: now,
    updated_at_ms: now,
    internetMessageId: null,
    inReplyTo: null,
    referencesHeader: null,
    ...overrides,
  } as NormalizedMessage;
}

// ── SignalNoiseOutputSchema tests ────────────────────────────────────

describe("SignalNoiseOutputSchema — Zod parsing", () => {
  it("parses signal output with null subclass", () => {
    const result = SignalNoiseOutputSchema.parse({
      priority_class: "signal",
      noise_subclass: null,
      reason: "Current client asking a question",
    });
    expect(result.priority_class).toBe("signal");
    expect(result.noise_subclass).toBeNull();
  });

  it("parses noise + transactional subclass", () => {
    const result = SignalNoiseOutputSchema.parse({
      priority_class: "noise",
      noise_subclass: "transactional",
      reason: "Payment receipt",
    });
    expect(result.priority_class).toBe("noise");
    expect(result.noise_subclass).toBe("transactional");
  });

  it("parses spam output", () => {
    const result = SignalNoiseOutputSchema.parse({
      priority_class: "spam",
      noise_subclass: null,
      reason: "Unsolicited pitch from unknown sender",
    });
    expect(result.priority_class).toBe("spam");
  });

  it("rejects unknown priority_class", () => {
    expect(() =>
      SignalNoiseOutputSchema.parse({
        priority_class: "important",
        noise_subclass: null,
        reason: "bad",
      }),
    ).toThrow();
  });

  it("rejects unknown noise_subclass", () => {
    expect(() =>
      SignalNoiseOutputSchema.parse({
        priority_class: "noise",
        noise_subclass: "personal",
        reason: "bad",
      }),
    ).toThrow();
  });

  it("rejects missing reason", () => {
    expect(() =>
      SignalNoiseOutputSchema.parse({
        priority_class: "signal",
        noise_subclass: null,
      }),
    ).toThrow();
  });
});

// ── buildSignalNoisePrompt tests ─────────────────────────────────────

describe("buildSignalNoisePrompt", () => {
  it("includes message, thread context, and corrections", () => {
    const ctx: SignalNoisePromptContext = {
      message: makeNormalizedMessage(),
      thread: {
        is_client: true,
        relationship_type: "client",
        always_keep_noise: false,
        sender_looks_automated: false,
      },
      corrections: [
        {
          from_address: "updates@github.com",
          subject: "New activity on your repo",
          original: "signal",
          corrected: "noise",
        },
      ],
    };

    const prompt = buildSignalNoisePrompt(ctx);
    expect(prompt).toContain("Your receipt for order #1234");
    expect(prompt).toContain("Is a client (current or past): yes");
    expect(prompt).toContain("always keep");
    expect(prompt).toContain("PREVIOUS CORRECTIONS");
    expect(prompt).toContain("updates@github.com");
    expect(prompt).toContain("signal");
    expect(prompt).toContain("noise");
  });

  it("flags sender_looks_automated in context block", () => {
    const ctx: SignalNoisePromptContext = {
      message: makeNormalizedMessage({
        from_address: "noreply@stripe.com",
      }),
      thread: {
        is_client: false,
        relationship_type: null,
        always_keep_noise: false,
        sender_looks_automated: true,
      },
      corrections: [],
    };
    const prompt = buildSignalNoisePrompt(ctx);
    expect(prompt).toContain("Sender address looks automated");
    expect(prompt).toContain(": yes");
  });

  it("flags always_keep_noise in context block", () => {
    const ctx: SignalNoisePromptContext = {
      message: makeNormalizedMessage(),
      thread: {
        is_client: false,
        relationship_type: "non_client",
        always_keep_noise: true,
        sender_looks_automated: false,
      },
      corrections: [],
    };
    const prompt = buildSignalNoisePrompt(ctx);
    expect(prompt).toContain('flagged this sender "always keep": yes');
  });

  it("omits corrections block when empty", () => {
    const ctx: SignalNoisePromptContext = {
      message: makeNormalizedMessage(),
      thread: {
        is_client: false,
        relationship_type: null,
        always_keep_noise: false,
        sender_looks_automated: false,
      },
      corrections: [],
    };
    const prompt = buildSignalNoisePrompt(ctx);
    expect(prompt).not.toContain("PREVIOUS CORRECTIONS");
  });

  it("truncates body to 2000 chars", () => {
    const longBody = "x".repeat(5000);
    const ctx: SignalNoisePromptContext = {
      message: makeNormalizedMessage({ body_text: longBody }),
      thread: {
        is_client: false,
        relationship_type: null,
        always_keep_noise: false,
        sender_looks_automated: false,
      },
      corrections: [],
    };
    const prompt = buildSignalNoisePrompt(ctx);
    expect(prompt).not.toContain("x".repeat(2001));
  });
});

// ── computeMessageKeepUntilMs tests ──────────────────────────────────

describe("computeMessageKeepUntilMs", () => {
  const baseline = 1_700_000_000_000; // arbitrary fixed instant
  const MS_DAY = 24 * 60 * 60 * 1000;

  it("returns null for signal (never auto-delete)", () => {
    const result = computeMessageKeepUntilMs("signal", null, baseline, {
      keep_pinned: false,
      always_keep_noise: false,
    });
    expect(result).toBeNull();
  });

  it("returns baseline + 180 days for noise + transactional", () => {
    const result = computeMessageKeepUntilMs(
      "noise",
      "transactional",
      baseline,
      { keep_pinned: false, always_keep_noise: false },
    );
    expect(result).toBe(baseline + 180 * MS_DAY);
  });

  it("returns baseline + 30 days for noise + marketing", () => {
    const result = computeMessageKeepUntilMs("noise", "marketing", baseline, {
      keep_pinned: false,
      always_keep_noise: false,
    });
    expect(result).toBe(baseline + 30 * MS_DAY);
  });

  it("returns baseline + 30 days for noise with null subclass", () => {
    const result = computeMessageKeepUntilMs("noise", null, baseline, {
      keep_pinned: false,
      always_keep_noise: false,
    });
    expect(result).toBe(baseline + 30 * MS_DAY);
  });

  it("returns baseline + 7 days for spam", () => {
    const result = computeMessageKeepUntilMs("spam", null, baseline, {
      keep_pinned: false,
      always_keep_noise: false,
    });
    expect(result).toBe(baseline + 7 * MS_DAY);
  });

  it("keep_pinned override returns null even for noise", () => {
    const result = computeMessageKeepUntilMs(
      "noise",
      "transactional",
      baseline,
      { keep_pinned: true, always_keep_noise: false },
    );
    expect(result).toBeNull();
  });

  it("always_keep_noise override returns null even for spam", () => {
    const result = computeMessageKeepUntilMs("spam", null, baseline, {
      keep_pinned: false,
      always_keep_noise: true,
    });
    expect(result).toBeNull();
  });
});

// ── messages schema sanity ───────────────────────────────────────────

describe("messages.keep_until_ms + deleted_at_ms columns", () => {
  it("accept nullable values on insert and survive round-trip", () => {
    const threadId = seedThread();
    const id = randomUUID();
    const now = Date.now();
    const keepUntilMs = now + 30 * 24 * 60 * 60 * 1000;

    testDb
      .insert(messages)
      .values({
        id,
        thread_id: threadId,
        direction: "inbound",
        channel: "email",
        from_address: "newsletter@example.com",
        to_addresses: ["andy@superbadmedia.com.au"],
        body_text: "Monthly newsletter body.",
        priority_class: "noise",
        noise_subclass: "marketing",
        keep_until_ms: keepUntilMs,
        deleted_at_ms: null,
        created_at_ms: now,
        updated_at_ms: now,
      })
      .run();

    const row = testDb
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .get();
    expect(row).toBeTruthy();
    expect(row!.keep_until_ms).toBe(keepUntilMs);
    expect(row!.deleted_at_ms).toBeNull();
  });

  it("null keep_until_ms represents signal / override (never auto-delete)", () => {
    const threadId = seedThread();
    const id = randomUUID();
    const now = Date.now();

    testDb
      .insert(messages)
      .values({
        id,
        thread_id: threadId,
        direction: "inbound",
        channel: "email",
        from_address: "client@example.com",
        to_addresses: ["andy@superbadmedia.com.au"],
        body_text: "Hi Andy — can we jump on a call tomorrow?",
        priority_class: "signal",
        noise_subclass: null,
        keep_until_ms: null,
        deleted_at_ms: null,
        created_at_ms: now,
        updated_at_ms: now,
      })
      .run();

    const row = testDb
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .get();
    expect(row!.keep_until_ms).toBeNull();
  });
});

// ── Kill-switch skip path ────────────────────────────────────────────

describe("classifySignalNoise — kill-switch short-circuit", () => {
  it("short-circuits when inbox_sync_enabled and llm_calls_enabled are off", async () => {
    const prevSync = killSwitches.inbox_sync_enabled;
    const prevLlm = killSwitches.llm_calls_enabled;
    killSwitches.inbox_sync_enabled = false;
    killSwitches.llm_calls_enabled = false;

    try {
      const result = await classifySignalNoise(
        makeNormalizedMessage(),
        "msg-never-persisted",
        "thread-never-persisted",
      );
      expect(result.skipped).toBe(true);
      expect(result.priority_class).toBe("signal");
      expect(result.noise_subclass).toBeNull();
      expect(result.reason).toContain("kill switch");
    } finally {
      killSwitches.inbox_sync_enabled = prevSync;
      killSwitches.llm_calls_enabled = prevLlm;
    }
  });
});
