/**
 * UI-7 — Refine-chat generator (`lib/graph/refine-draft.ts`).
 *
 * Covers:
 *  - Output-schema reuse (1 — UI-7 inherits UI-5's DraftReplyOutputSchema)
 *  - Prompt builder content (4 — prior draft, instruction, prior turns, thread history, CCE client block)
 *  - Kill-switch short-circuit preserves prior draft (1)
 *  - Empty-instruction skip preserves prior draft (1)
 *  - Empty prior-draft skip (1)
 *  - Happy path returns parsed rewrite (1)
 *  - Fallback discipline #63 — malformed JSON preserves prior draft, NOT empty (1)
 *  - Fallback — empty LLM body preserves prior draft (1)
 *  - Prior turns cap head-first at MAX_REFINE_TURNS (1)
 *  - Instruction cap at MAX_REFINE_INSTRUCTION_CHARS (1)
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

const TEST_DB = path.join(process.cwd(), "tests/.test-graph-refine-draft.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const {
  generateRefinedDraft,
  buildRefineUserPrompt,
  MAX_REFINE_INSTRUCTION_CHARS,
  MAX_REFINE_TURNS,
} = await import("@/lib/graph/refine-draft");
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
        "Andy writes tight. Dry, observational. Short sentences.",
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

async function seedThreadWithInbound(
  contactId: string,
  companyId: string,
): Promise<string> {
  const threadId = randomUUID();
  testDb
    .insert(threads)
    .values({
      id: threadId,
      contact_id: contactId,
      company_id: companyId,
      channel_of_origin: "email",
      subject: "Trial shoot schedule",
      priority_class: "signal",
      last_message_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  testDb
    .insert(messages)
    .values({
      id: randomUUID(),
      thread_id: threadId,
      direction: "inbound",
      channel: "email",
      from_address: "sam@acme.test",
      to_addresses: ["andy@superbadmedia.com.au"],
      subject: "Trial shoot schedule",
      body_text: "Hey Andy — can we push the trial? Something's come up.",
      received_at_ms: NOW - 7200_000,
      created_at_ms: NOW - 7200_000,
      updated_at_ms: NOW - 7200_000,
    })
    .run();
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

// ── Schema reuse ────────────────────────────────────────────────────

describe("UI-7 output schema reuse", () => {
  it("DraftReplyOutputSchema parses the refine-draft shape (same contract as UI-5/UI-6)", () => {
    const parsed = DraftReplyOutputSchema.parse({
      draft_body: "Sam — sure, next week's fine. —A",
      low_confidence_flags: [],
    });
    expect(parsed.draft_body).toContain("Sam");
    expect(parsed.low_confidence_flags).toEqual([]);
  });
});

// ── Prompt builder ──────────────────────────────────────────────────

describe("buildRefineUserPrompt", () => {
  const baseCtx = {
    priorDraft: "Original draft: Sam — let's push next week. Cheers.",
    instruction: "shorter, less formal",
    priorTurns: [],
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
  };

  it("embeds the prior draft and the new instruction", () => {
    const prompt = buildRefineUserPrompt(baseCtx);
    expect(prompt).toContain("CURRENT DRAFT");
    expect(prompt).toContain("Original draft: Sam");
    expect(prompt).toContain("ANDY'S NEW INSTRUCTION");
    expect(prompt).toContain("shorter, less formal");
  });

  it("includes thread history section when provided (reply refine)", () => {
    const prompt = buildRefineUserPrompt({
      ...baseCtx,
      threadHistory: [
        {
          direction: "inbound",
          from_address: "sam@acme.test",
          subject: "x",
          body_text: "Inbound from Sam asking to push.",
          sent_at_ms: NOW - 86_400_000,
        },
      ],
    });
    expect(prompt).toContain("THREAD HISTORY");
    expect(prompt).toContain("Inbound from Sam asking to push.");
  });

  it("includes prior refine turns when supplied (iteration history)", () => {
    const prompt = buildRefineUserPrompt({
      ...baseCtx,
      priorTurns: [
        { instruction: "make it friendlier", result_body: "Warmer draft v1." },
        { instruction: "tighten", result_body: "Tighter draft v2." },
      ],
    });
    expect(prompt).toContain("PRIOR REFINE TURNS");
    expect(prompt).toContain("make it friendlier");
    expect(prompt).toContain("Warmer draft v1.");
    expect(prompt).toContain("Tighter draft v2.");
  });

  it("renders CCE block (who they are / where you are with them)", () => {
    const prompt = buildRefineUserPrompt(baseCtx);
    expect(prompt).toContain("WHO THEY ARE / WHERE YOU ARE WITH THEM");
    expect(prompt).toContain("Sam Ryder");
    expect(prompt).toContain("client");
  });
});

// ── generateRefinedDraft — outcomes ─────────────────────────────────

describe("generateRefinedDraft", () => {
  it("skipped_kill_switch preserves the prior draft (never empty)", async () => {
    mockKillSwitches.llm_calls_enabled = false;
    const result = await generateRefinedDraft({
      priorDraft: "Hi Sam — original body.",
      instruction: "shorter",
      sendingAddress: "andy@superbadmedia.com.au",
    });
    expect(result.outcome).toBe("skipped_kill_switch");
    expect(result.draft_body).toBe("Hi Sam — original body.");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("skipped_empty_instruction preserves the prior draft (whitespace-only)", async () => {
    const result = await generateRefinedDraft({
      priorDraft: "Hi Sam — original body.",
      instruction: "   ",
      sendingAddress: "andy@superbadmedia.com.au",
    });
    expect(result.outcome).toBe("skipped_empty_instruction");
    expect(result.draft_body).toBe("Hi Sam — original body.");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("skipped_empty_prior_draft when there's nothing to refine", async () => {
    const result = await generateRefinedDraft({
      priorDraft: "",
      instruction: "make it tighter",
      sendingAddress: "andy@superbadmedia.com.au",
    });
    expect(result.outcome).toBe("skipped_empty_prior_draft");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("generated — parses LLM JSON and returns the rewritten draft", async () => {
    await seedBrandDna();
    const { contactId, companyId } = await seedContactWithCompany();
    const threadId = await seedThreadWithInbound(contactId, companyId);

    mockLlmJson({
      draft_body: "Sam — sure, next week. —A",
      low_confidence_flags: [
        { span: "next week", reason: "assumed the exact week" },
      ],
    });

    const result = await generateRefinedDraft({
      priorDraft: "Hi Sam, pushing next week works fine for me as well.",
      instruction: "shorter, less formal",
      contactId,
      threadId,
      sendingAddress: "andy@superbadmedia.com.au",
    });
    expect(result.outcome).toBe("generated");
    expect(result.draft_body).toBe("Sam — sure, next week. —A");
    expect(result.low_confidence_flags).toHaveLength(1);
  });

  it("fallback_error preserves the prior draft when LLM output is malformed (discipline #63)", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "totally not json" }],
    });
    const prior = "Hi Sam, this is the existing draft body.";
    const result = await generateRefinedDraft({
      priorDraft: prior,
      instruction: "shorter",
      sendingAddress: "andy@superbadmedia.com.au",
    });
    expect(result.outcome).toBe("fallback_error");
    expect(result.draft_body).toBe(prior);
    expect(result.low_confidence_flags).toEqual([]);
  });

  it("fallback_error when LLM returns empty body (prior draft preserved, not blanked)", async () => {
    mockLlmJson({ draft_body: "   ", low_confidence_flags: [] });
    const prior = "Hi Sam, this is the existing draft body.";
    const result = await generateRefinedDraft({
      priorDraft: prior,
      instruction: "shorter",
      sendingAddress: "andy@superbadmedia.com.au",
    });
    expect(result.outcome).toBe("fallback_error");
    expect(result.draft_body).toBe(prior);
  });

  it("caps prior turns head-first at MAX_REFINE_TURNS", async () => {
    mockLlmJson({ draft_body: "Rewritten body.", low_confidence_flags: [] });
    const overflow = MAX_REFINE_TURNS + 3;
    const priorTurns = Array.from({ length: overflow }, (_, i) => ({
      instruction: `turn-${i}-instruction`,
      result_body: `turn-${i}-body`,
    }));
    await generateRefinedDraft({
      priorDraft: "Hi Sam.",
      instruction: "tighter",
      priorTurns,
      sendingAddress: "andy@superbadmedia.com.au",
    });

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const sentCall = mockMessagesCreate.mock.calls[0][0] as {
      messages: Array<{ content: string | Array<{ text: string }> }>;
    };
    const body = Array.isArray(sentCall.messages[0].content)
      ? sentCall.messages[0].content.map((b) => b.text).join("")
      : (sentCall.messages[0].content as string);
    // The first 3 turns are dropped; only the most recent MAX_REFINE_TURNS stay.
    expect(body).not.toContain("turn-0-instruction");
    expect(body).not.toContain("turn-1-instruction");
    expect(body).not.toContain("turn-2-instruction");
    expect(body).toContain(`turn-${overflow - 1}-instruction`);
  });

  it("truncates the instruction at MAX_REFINE_INSTRUCTION_CHARS", async () => {
    mockLlmJson({ draft_body: "Rewritten body.", low_confidence_flags: [] });
    const longInstruction = "x".repeat(MAX_REFINE_INSTRUCTION_CHARS + 100);
    await generateRefinedDraft({
      priorDraft: "Hi Sam.",
      instruction: longInstruction,
      sendingAddress: "andy@superbadmedia.com.au",
    });
    const sentCall = mockMessagesCreate.mock.calls[0][0] as {
      messages: Array<{ content: string | Array<{ text: string }> }>;
    };
    const body = Array.isArray(sentCall.messages[0].content)
      ? sentCall.messages[0].content.map((b) => b.text).join("")
      : (sentCall.messages[0].content as string);
    // The full overflow string should not appear — only the capped prefix.
    expect(body).not.toContain("x".repeat(MAX_REFINE_INSTRUCTION_CHARS + 1));
  });
});
