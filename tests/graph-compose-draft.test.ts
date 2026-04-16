/**
 * UI-6 — Compose-side LLM helpers (`lib/graph/compose-draft.ts`).
 *
 * Covers:
 *  - DraftReplyOutputSchema reuse (2 — re-export contract check + subject schema)
 *  - Prompt builder content (3 — intent, brand voice, thread history / few-shots)
 *  - Kill-switch short-circuit (1 — llm_calls_enabled off)
 *  - Empty-intent skip (1)
 *  - Generator happy path returns parsed draft (1)
 *  - Fallback discipline #63 — malformed JSON → empty body (1)
 *  - Subject generator: happy path (1) + fallback heuristic (1) + kill-switch heuristic (1)
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

// ── Hoisted mocks ────────────────────────────────────────────────────

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockMessagesCreate };
  },
}));

const mockKillSwitches = vi.hoisted(() => ({
  inbox_sync_enabled: true,
  inbox_send_enabled: true,
  llm_calls_enabled: true,
  scheduled_tasks_enabled: false,
  outreach_send_enabled: false,
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: mockKillSwitches,
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-graph-compose-draft.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const {
  generateComposeDraft,
  generateComposeSubject,
  buildComposeUserPrompt,
  ComposeSubjectOutputSchema,
  COMPOSE_SUBJECT_MAX_LEN,
} = await import("@/lib/graph/compose-draft");
const { DraftReplyOutputSchema } = await import("@/lib/graph/draft-reply");
const { threads, messages } = await import("@/lib/db/schema/messages");
const { companies } = await import("@/lib/db/schema/companies");
const { contacts } = await import("@/lib/db/schema/contacts");
const { brand_dna_profiles } = await import(
  "@/lib/db/schema/brand-dna-profiles"
);
const { activity_log } = await import("@/lib/db/schema/activity-log");

const NOW = 1_700_000_000_000;

// ── Fixtures ────────────────────────────────────────────────────────

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
        "Andy writes tight. Dry, observational. Short sentences. Ban 'touch base'.",
      first_impression: "A founder allergic to corporate jargon.",
      completed_at_ms: NOW - 86_400_000,
      created_at_ms: NOW - 86_400_000,
      updated_at_ms: NOW - 86_400_000,
    })
    .run();
}

async function seedContactWithCompany(): Promise<{
  contactId: string;
  companyId: string;
}> {
  const companyId = randomUUID();
  const contactId = randomUUID();
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
      email_normalised: "sam@acme.test",
      relationship_type: "client",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return { contactId, companyId };
}

async function seedAndySentHistory(
  contactId: string,
  companyId: string,
  count = 2,
): Promise<string> {
  const threadId = randomUUID();
  testDb
    .insert(threads)
    .values({
      id: threadId,
      contact_id: contactId,
      company_id: companyId,
      channel_of_origin: "email",
      subject: "Re: shoot schedule",
      priority_class: "signal",
      last_message_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  for (let i = 0; i < count; i++) {
    testDb
      .insert(messages)
      .values({
        id: randomUUID(),
        thread_id: threadId,
        direction: "outbound",
        channel: "email",
        from_address: "andy@superbadmedia.com.au",
        to_addresses: [`sam@acme.test`],
        subject: "Re: shoot schedule",
        body_text: `Andy note #${i} — keep it tight.`,
        sent_at_ms: NOW - i * 3600_000,
        created_at_ms: NOW - i * 3600_000,
        updated_at_ms: NOW - i * 3600_000,
      })
      .run();
  }
  return threadId;
}

function mockLlmJson(output: unknown): void {
  mockMessagesCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(output) }],
  });
}

// ── Lifecycle ───────────────────────────────────────────────────────

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
  mockKillSwitches.llm_calls_enabled = true;
  mockKillSwitches.inbox_sync_enabled = true;
  mockKillSwitches.inbox_send_enabled = true;
});

// ── Schemas ─────────────────────────────────────────────────────────

describe("UI-6 output schema reuse", () => {
  it("DraftReplyOutputSchema still accepts the compose-draft shape (reused from UI-5)", () => {
    const parsed = DraftReplyOutputSchema.parse({
      draft_body: "Sam — pushing next week, talk Mon. —A",
      low_confidence_flags: [
        { span: "Mon", reason: "guessed at the exact day" },
      ],
    });
    expect(parsed.draft_body).toContain("Sam");
    expect(parsed.low_confidence_flags).toHaveLength(1);
  });

  it("ComposeSubjectOutputSchema accepts a short subject string", () => {
    const parsed = ComposeSubjectOutputSchema.parse({ subject: "Quick update" });
    expect(parsed.subject).toBe("Quick update");
  });
});

// ── Prompt builder ──────────────────────────────────────────────────

describe("buildComposeUserPrompt", () => {
  const baseCtx = {
    intent: "follow up with Sam re trial shoot — push next week",
    sendingAddress: "andy@superbadmedia.com.au",
    clientContext: {
      relationship_type: "client" as const,
      display_name: "Sam Ryder",
      summary: null,
      open_action_items: [],
      recent_activity: [],
      source: "stub" as const,
    },
    threadHistory: [],
    recentAndySent: [],
  };

  it("leads with Andy's intent line", () => {
    const prompt = buildComposeUserPrompt(baseCtx);
    expect(prompt).toContain("ANDY'S INTENT");
    expect(prompt).toContain("push next week");
  });

  it("includes thread history section when threadHistory provided (reply-compose)", () => {
    const prompt = buildComposeUserPrompt({
      ...baseCtx,
      threadHistory: [
        {
          direction: "outbound",
          from_address: "andy@superbadmedia.com.au",
          subject: "Re: x",
          body_text: "Prior outbound message body.",
          sent_at_ms: NOW - 86_400_000,
        },
      ],
    });
    expect(prompt).toContain("THREAD HISTORY");
    expect(prompt).toContain("Prior outbound message body.");
  });

  it("shows voice-anchor section when composing from scratch (recentAndySent)", () => {
    const prompt = buildComposeUserPrompt({
      ...baseCtx,
      recentAndySent: [
        {
          direction: "outbound",
          from_address: "andy@superbadmedia.com.au",
          subject: "Re: y",
          body_text: "Andy note — tight and dry.",
          sent_at_ms: NOW - 86_400_000,
        },
      ],
    });
    expect(prompt).toContain("RECENT VOICE ANCHORS");
    expect(prompt).toContain("Andy note — tight and dry.");
    expect(prompt).not.toContain("THREAD HISTORY");
  });
});

// ── generateComposeDraft ────────────────────────────────────────────

describe("generateComposeDraft", () => {
  it("returns skipped_kill_switch when llm_calls_enabled is off", async () => {
    mockKillSwitches.llm_calls_enabled = false;
    const result = await generateComposeDraft({
      intent: "anything",
      sendingAddress: "andy@superbadmedia.com.au",
    });
    expect(result.outcome).toBe("skipped_kill_switch");
    expect(result.draft_body).toBe("");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns skipped_empty_intent when intent is whitespace-only", async () => {
    const result = await generateComposeDraft({
      intent: "   ",
      sendingAddress: "andy@superbadmedia.com.au",
    });
    expect(result.outcome).toBe("skipped_empty_intent");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("parses LLM JSON and returns the generated draft body", async () => {
    await seedBrandDna();
    const { contactId, companyId } = await seedContactWithCompany();
    await seedAndySentHistory(contactId, companyId, 1);

    mockLlmJson({
      draft_body: "Sam — pushing next week. —A",
      low_confidence_flags: [
        { span: "next week", reason: "guessed at the exact day" },
      ],
    });

    const result = await generateComposeDraft({
      intent: "follow up with Sam re trial — push next week",
      contactId,
      sendingAddress: "andy@superbadmedia.com.au",
    });
    expect(result.outcome).toBe("generated");
    expect(result.draft_body).toContain("Sam");
    expect(result.low_confidence_flags).toHaveLength(1);
  });

  it("returns fallback_error with empty body when LLM output is malformed (discipline #63)", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "totally not json" }],
    });
    const result = await generateComposeDraft({
      intent: "write a reply",
      sendingAddress: "andy@superbadmedia.com.au",
    });
    expect(result.outcome).toBe("fallback_error");
    expect(result.draft_body).toBe("");
    expect(result.low_confidence_flags).toEqual([]);
  });
});

// ── generateComposeSubject ──────────────────────────────────────────

describe("generateComposeSubject", () => {
  it("returns the LLM-generated subject when under the cap", async () => {
    mockLlmJson({ subject: "Trial shoot push to next week" });
    const result = await generateComposeSubject({
      bodyText: "Sam — pushing the trial next week. —A",
    });
    expect(result.outcome).toBe("generated");
    expect(result.subject).toBe("Trial shoot push to next week");
    expect(result.subject.length).toBeLessThanOrEqual(COMPOSE_SUBJECT_MAX_LEN);
  });

  it("caps subject length and falls back to first-words heuristic when LLM fails", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "garbage non json" }],
    });
    const body =
      "Sam I am pushing the trial shoot to next week so we can sort the lighting";
    const result = await generateComposeSubject({ bodyText: body });
    expect(result.outcome).toBe("fallback_heuristic");
    expect(result.subject.length).toBeLessThanOrEqual(COMPOSE_SUBJECT_MAX_LEN);
    expect(result.subject.length).toBeGreaterThan(0);
  });

  it("skips LLM and returns heuristic when kill-switch off (never blocks send)", async () => {
    mockKillSwitches.llm_calls_enabled = false;
    const result = await generateComposeSubject({
      bodyText: "Short note about next week's shoot and lighting plan.",
    });
    expect(result.outcome).toBe("skipped_kill_switch");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.subject.length).toBeLessThanOrEqual(COMPOSE_SUBJECT_MAX_LEN);
  });
});
