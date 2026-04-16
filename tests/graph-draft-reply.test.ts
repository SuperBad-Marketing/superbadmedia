/**
 * UI-5 — Thread draft-reply generator (`lib/graph/draft-reply.ts`)
 * + prompt builder (`lib/graph/draft-reply-prompt.ts`).
 *
 * Covers:
 *  - DraftReplyOutputSchema Zod parsing (4)
 *  - Prompt builder content (4 — history, brand DNA, few-shots, CCE stub)
 *  - Persistence (3 — successful write, empty-body clear, fallback leaves prior)
 *  - Kill-switch short-circuit (1)
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

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockMessagesCreate };
  },
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

const TEST_DB = path.join(process.cwd(), "tests/.test-graph-draft-reply.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const {
  generateCachedDraftReply,
  invalidateCachedDraft,
  DraftReplyOutputSchema,
} = await import("@/lib/graph/draft-reply");
const {
  buildDraftReplyUserPrompt,
  buildDraftReplySystemPrompt,
  loadClientContextOrStub,
} = await import("@/lib/graph/draft-reply-prompt");
type DraftReplyPromptContext = import(
  "@/lib/graph/draft-reply-prompt"
).DraftReplyPromptContext;
const { threads, messages } = await import("@/lib/db/schema/messages");
const { companies } = await import("@/lib/db/schema/companies");
const { contacts } = await import("@/lib/db/schema/contacts");
const { brand_dna_profiles } = await import(
  "@/lib/db/schema/brand-dna-profiles"
);
const { activity_log } = await import("@/lib/db/schema/activity-log");

const NOW = 1_700_000_000_000;

// ── Fixtures / helpers ───────────────────────────────────────────────

async function seedBrandDna(): Promise<void> {
  testDb
    .insert(brand_dna_profiles)
    .values({
      id: "bdna-self",
      subject_type: "superbad_self",
      subject_id: null,
      is_superbad_self: true,
      status: "complete",
      prose_portrait:
        "Andy writes tight. Dry and observational. Short sentences. Leave room for the mutter.",
      first_impression:
        "A founder who would rather watch paint dry than write 'touch base'.",
      completed_at_ms: NOW - 86_400_000,
      created_at_ms: NOW - 86_400_000,
      updated_at_ms: NOW - 86_400_000,
    })
    .run();
}

async function seedClientThread(
  opts: {
    relationship?: "client" | "past_client" | "lead" | "non_client" | "supplier";
    inboundBody?: string;
    includeOutbound?: boolean;
  } = {},
): Promise<{ threadId: string; contactId: string; messageId: string }> {
  const companyId = randomUUID();
  const contactId = randomUUID();
  const threadId = randomUUID();
  const messageId = randomUUID();

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
      relationship_type: opts.relationship ?? "client",
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
      subject: "Re: project status",
      priority_class: "signal",
      last_message_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();

  if (opts.includeOutbound) {
    testDb
      .insert(messages)
      .values({
        id: randomUUID(),
        thread_id: threadId,
        direction: "outbound",
        channel: "email",
        from_address: "andy@superbadmedia.com.au",
        to_addresses: ["sam@acme.test"],
        subject: "Re: project status",
        body_text: "Will circle back with the updated plan tomorrow.",
        sent_at_ms: NOW - 3_600_000,
        created_at_ms: NOW - 3_600_000,
        updated_at_ms: NOW - 3_600_000,
      })
      .run();
  }

  testDb
    .insert(messages)
    .values({
      id: messageId,
      thread_id: threadId,
      direction: "inbound",
      channel: "email",
      from_address: "sam@acme.test",
      to_addresses: ["andy@superbadmedia.com.au"],
      subject: "Re: project status",
      body_text:
        opts.inboundBody ??
        "Hi Andy — any update on the plan you mentioned yesterday?",
      received_at_ms: NOW,
      sent_at_ms: NOW,
      priority_class: "signal",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();

  return { threadId, contactId, messageId };
}

function mockLlmOutput(output: unknown): void {
  mockMessagesCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(output) }],
  });
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
  testDb.delete(activity_log).run();
  testDb.delete(messages).run();
  testDb.delete(threads).run();
  testDb.delete(contacts).run();
  testDb.delete(companies).run();
  testDb.delete(brand_dna_profiles).run();
  mockMessagesCreate.mockReset();
  mockKillSwitches.inbox_sync_enabled = true;
  mockKillSwitches.llm_calls_enabled = true;
});

// ── DraftReplyOutputSchema — Zod parsing ─────────────────────────────

describe("DraftReplyOutputSchema — Zod parsing", () => {
  it("parses a draft with populated low-confidence flags", () => {
    const result = DraftReplyOutputSchema.parse({
      draft_body: "Sam — plan lands by Friday. —A",
      low_confidence_flags: [
        { span: "Friday", reason: "guessed at the deadline" },
      ],
    });
    expect(result.draft_body).toContain("Sam");
    expect(result.low_confidence_flags).toHaveLength(1);
    expect(result.low_confidence_flags[0].span).toBe("Friday");
  });

  it("defaults low_confidence_flags to [] when absent", () => {
    const result = DraftReplyOutputSchema.parse({
      draft_body: "All good — thanks.",
    });
    expect(result.low_confidence_flags).toEqual([]);
  });

  it("accepts explicit empty low_confidence_flags array", () => {
    const result = DraftReplyOutputSchema.parse({
      draft_body: "Short reply.",
      low_confidence_flags: [],
    });
    expect(result.low_confidence_flags).toEqual([]);
  });

  it("rejects malformed flag shape (missing reason)", () => {
    expect(() =>
      DraftReplyOutputSchema.parse({
        draft_body: "Body.",
        low_confidence_flags: [{ span: "Body" }],
      }),
    ).toThrow();
  });
});

// ── Prompt builder ───────────────────────────────────────────────────

describe("prompt builders", () => {
  function makeCtx(
    overrides: Partial<DraftReplyPromptContext> = {},
  ): DraftReplyPromptContext {
    const base: DraftReplyPromptContext = {
      thread_subject: "Re: project status",
      latest_inbound: {
        direction: "inbound",
        from_address: "sam@acme.test",
        subject: "Re: project status",
        body_text: "Hi Andy — any update on the plan?",
        sent_at_ms: NOW,
      },
      thread_history: [
        {
          direction: "outbound",
          from_address: "andy@superbadmedia.com.au",
          subject: "Re: project status",
          body_text: "Plan lands Friday.",
          sent_at_ms: NOW - 86_400_000,
        },
        {
          direction: "inbound",
          from_address: "sam@acme.test",
          subject: "Re: project status",
          body_text: "Hi Andy — any update on the plan?",
          sent_at_ms: NOW,
        },
      ],
      brand_dna: {
        prose_portrait: "Dry, observational. Short sentences.",
        first_impression: "A founder who bans 'touch base'.",
      },
      client_context: {
        relationship_type: "client",
        display_name: "Sam Ryder",
        summary: null,
        open_action_items: [],
        recent_activity: [
          {
            kind: "inbox_message_received",
            body: "Sam asked about the plan last week.",
            created_at_ms: NOW - 7 * 86_400_000,
          },
        ],
        source: "stub",
      },
      few_shots: [
        {
          inbound_body: "Can you send Thursday's figures?",
          andy_reply_body: "Sent. Sing out if the Q2 column looks off.",
        },
      ],
    };
    return { ...base, ...overrides };
  }

  it("user prompt includes latest inbound + thread history + client context", () => {
    const prompt = buildDraftReplyUserPrompt(makeCtx());
    expect(prompt).toContain("any update on the plan");
    expect(prompt).toContain("Plan lands Friday.");
    expect(prompt).toContain("Sam Ryder");
    expect(prompt).toContain("WHO THEY ARE / WHERE YOU ARE WITH THEM");
  });

  it("system prompt includes Brand DNA portrait + first impression", () => {
    const prompt = buildDraftReplySystemPrompt({
      prose_portrait: "Dry and observational.",
      first_impression: "Bans 'touch base'.",
    });
    expect(prompt).toContain("Dry and observational.");
    expect(prompt).toContain("Bans 'touch base'.");
    expect(prompt).toContain("BRAND DNA");
  });

  it("user prompt includes few-shot examples block", () => {
    const prompt = buildDraftReplyUserPrompt(makeCtx());
    expect(prompt).toContain("FEW-SHOT EXAMPLES");
    expect(prompt).toContain("Sing out if the Q2 column looks off.");
  });

  it("user prompt flags CCE stub source in the context block", () => {
    const prompt = buildDraftReplyUserPrompt(makeCtx());
    expect(prompt).toContain("Client Context Engine is not yet live");
  });

  it("loadClientContextOrStub falls back to stub when contact missing", async () => {
    const stub = await loadClientContextOrStub(null);
    expect(stub.source).toBe("stub");
    expect(stub.relationship_type).toBeNull();
    expect(stub.recent_activity).toEqual([]);
  });

  it("loadClientContextOrStub builds stub from DB when CCE module is absent", async () => {
    // Real contact + seeded activity rows. The dynamic import of
    // `@/lib/client-context/drafter-context` will throw in the current
    // tree (Wave 16 hasn't shipped); the catch-branch falls through to
    // buildClientContextStub which hydrates from contacts + activity_log.
    const { contactId } = await seedClientThread({ relationship: "past_client" });
    testDb
      .insert(activity_log)
      .values({
        id: randomUUID(),
        contact_id: contactId,
        kind: "note",
        body: "Called about the Q3 shoot schedule.",
        created_at_ms: NOW - 3_600_000,
      })
      .run();

    const stub = await loadClientContextOrStub(contactId);
    expect(stub.source).toBe("stub");
    expect(stub.relationship_type).toBe("past_client");
    expect(stub.display_name).toBe("Sam Ryder");
    expect(stub.recent_activity.length).toBe(1);
    expect(stub.recent_activity[0].body).toContain("Q3 shoot");
  });
});

// ── Persistence ──────────────────────────────────────────────────────

describe("generateCachedDraftReply — persistence", () => {
  it("writes cached draft body + flags + flips has_cached_draft on success", async () => {
    await seedBrandDna();
    const { threadId } = await seedClientThread({ includeOutbound: true });
    mockLlmOutput({
      draft_body: "Sam — plan lands Friday. —A",
      low_confidence_flags: [
        { span: "Friday", reason: "guessed at the deadline" },
      ],
    });

    const result = await generateCachedDraftReply(threadId);
    expect(result.outcome).toBe("generated");
    expect(result.draft_body).toContain("Sam");

    const row = testDb
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(row!.cached_draft_body).toContain("Sam");
    expect(row!.has_cached_draft).toBe(true);
    expect(row!.cached_draft_stale).toBe(false);
    expect(row!.cached_draft_generated_at_ms).not.toBeNull();
    const flags = row!.cached_draft_low_confidence_flags as Array<{
      span: string;
      reason: string;
    }> | null;
    expect(flags).not.toBeNull();
    expect(flags?.[0].span).toBe("Friday");

    const logRow = testDb
      .select()
      .from(activity_log)
      .where(eq(activity_log.kind, "inbox_draft_generated"))
      .get();
    expect(logRow).toBeTruthy();
  });

  it("empty model body clears the cached draft and doesn't log a draft", async () => {
    await seedBrandDna();
    const { threadId } = await seedClientThread();
    // Pre-seed an existing draft so we can see it cleared
    testDb
      .update(threads)
      .set({
        cached_draft_body: "previous draft",
        has_cached_draft: true,
        cached_draft_stale: true,
        cached_draft_generated_at_ms: NOW - 3600_000,
      })
      .where(eq(threads.id, threadId))
      .run();
    mockLlmOutput({ draft_body: "", low_confidence_flags: [] });

    const result = await generateCachedDraftReply(threadId);
    expect(result.outcome).toBe("skipped_empty_body");

    const row = testDb
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(row!.cached_draft_body).toBeNull();
    expect(row!.has_cached_draft).toBe(false);
    expect(row!.cached_draft_low_confidence_flags).toBeNull();
  });

  it("LLM/parse failure leaves prior cached draft untouched (no-write fallback)", async () => {
    await seedBrandDna();
    const { threadId } = await seedClientThread();
    // Pre-seed a prior cached draft that must survive the failure.
    testDb
      .update(threads)
      .set({
        cached_draft_body: "earlier good draft",
        has_cached_draft: true,
        cached_draft_stale: true,
        cached_draft_generated_at_ms: NOW - 3600_000,
      })
      .where(eq(threads.id, threadId))
      .run();
    // Return unparseable content so Zod rejects.
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "not json at all" }],
    });

    const result = await generateCachedDraftReply(threadId);
    expect(result.outcome).toBe("fallback_error");

    const row = testDb
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(row!.cached_draft_body).toBe("earlier good draft");
    expect(row!.has_cached_draft).toBe(true);
    expect(row!.cached_draft_stale).toBe(true);
  });
});

// ── Kill-switch skip ─────────────────────────────────────────────────

describe("generateCachedDraftReply — kill-switch short-circuit", () => {
  it("returns skip result and writes nothing when either switch is off", async () => {
    await seedBrandDna();
    const { threadId } = await seedClientThread();
    mockKillSwitches.inbox_sync_enabled = false;

    const result = await generateCachedDraftReply(threadId);
    expect(result.outcome).toBe("skipped_kill_switch");
    expect(mockMessagesCreate).not.toHaveBeenCalled();

    const row = testDb
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(row!.cached_draft_body).toBeNull();
    expect(row!.has_cached_draft).toBe(false);
  });
});

// ── invalidateCachedDraft (UI-6 inheritance contract) ────────────────

describe("invalidateCachedDraft", () => {
  it("clears the cached draft + flags and logs inbox_draft_discarded", async () => {
    const { threadId, contactId } = await seedClientThread();
    testDb
      .update(threads)
      .set({
        cached_draft_body: "prior draft about to be invalidated",
        has_cached_draft: true,
        cached_draft_stale: false,
        cached_draft_generated_at_ms: NOW - 120_000,
        cached_draft_low_confidence_flags: [
          { span: "prior", reason: "from earlier run" },
        ],
      })
      .where(eq(threads.id, threadId))
      .run();

    await invalidateCachedDraft(threadId, "outbound_send");

    const row = testDb
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .get();
    expect(row!.cached_draft_body).toBeNull();
    expect(row!.has_cached_draft).toBe(false);
    expect(row!.cached_draft_stale).toBe(false);
    expect(row!.cached_draft_low_confidence_flags).toBeNull();
    expect(row!.cached_draft_generated_at_ms).toBeNull();

    const logRow = testDb
      .select()
      .from(activity_log)
      .where(eq(activity_log.contact_id, contactId))
      .get();
    expect(logRow!.kind).toBe("inbox_draft_discarded");
    expect(logRow!.body).toContain("outbound_send");
  });
});
