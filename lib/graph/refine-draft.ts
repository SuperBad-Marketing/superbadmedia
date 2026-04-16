/**
 * Refine-chat generator (UI-7). The third Opus call in the draft family —
 * sits on top of UI-5's cached reply draft and UI-6's compose-intent draft.
 *
 *   Andy opens the refine sidecar on a thread that already has a draft,
 *   types an instruction ("shorter, less formal" / "push the meeting to
 *   next week" / "drop the price reference"), and Opus rewrites the draft
 *   in place. Iterable — each turn layers on prior turns until Andy is
 *   happy, then he sends via UI-6's `sendCompose` with the refined body.
 *
 * Spec §7.4: "Refine-chat: when Andy opens the refine sidecar,
 * conversation is: his instructions in, new draft out, iterate. Stores as
 * an ephemeral in-memory session, no persistence unless useful for future
 * learning." — so turns live in React state client-side and are passed
 * back in on each call. Nothing persists here.
 *
 * Fallback asymmetry (discipline #63): UI-7's conservative side is
 * **preserve the prior draft**. UI-5 no-writes to cache on failure; UI-6
 * returns empty body so the user knows to retry; UI-7 returns the prior
 * draft unchanged so Andy's typing state isn't clobbered by an LLM hiccup
 * mid-iteration.
 *
 * Kill switch: `llm_calls_enabled` only. Refine is pure LLM — never
 * touches Graph — so `inbox_sync_enabled` / `inbox_send_enabled` are out
 * of scope. When off, returns the prior draft with outcome
 * `skipped_kill_switch`.
 *
 * Two-perpetual-contexts (memory `project_two_perpetual_contexts`):
 * reuses UI-5's `buildDraftReplySystemPrompt` verbatim (Brand DNA in
 * system) and `loadClientContextOrStub` (CCE in user) so the voice
 * calibration across reply / compose / refine stays identical.
 */
import { asc, desc, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema/messages";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import {
  loadClientContextOrStub,
  buildDraftReplySystemPrompt,
  type BrandDnaContext,
  type ClientContextSnapshot,
  type ThreadMessageSnapshot,
} from "./draft-reply-prompt";
import { DraftReplyOutputSchema, type DraftReplyOutput } from "./draft-reply";

// ── Constants ────────────────────────────────────────────────────────

import {
  MAX_REFINE_INSTRUCTION_CHARS,
  MAX_REFINE_TURNS,
  type RefineTurn,
} from "./refine-draft-limits";
export { MAX_REFINE_INSTRUCTION_CHARS, MAX_REFINE_TURNS, type RefineTurn };

const MAX_THREAD_MESSAGES = 20;
const MAX_BODY_CHARS = 2000;
const REFINE_MAX_OUTPUT_TOKENS = 1500;

export interface GenerateRefinedDraftInput {
  /** The draft being refined — from UI-5 cache, UI-6 intent, or a prior UI-7 turn. */
  priorDraft: string;
  /** Andy's new instruction. */
  instruction: string;
  /** Prior refine turns on this session (oldest → newest). Capped at `MAX_REFINE_TURNS`. */
  priorTurns?: RefineTurn[];
  /** Recipient contact (lights up CCE). Null = walk-in / unknown. */
  contactId?: string | null;
  /** Thread the draft belongs to (lights up thread history). Null = compose-from-scratch. */
  threadId?: string | null;
  /** Andy's sending address (for the prompt's "SENDING FROM" line). */
  sendingAddress: string;
}

export type RefineDraftOutcome =
  | "generated"
  | "skipped_kill_switch"
  | "skipped_empty_instruction"
  | "skipped_empty_prior_draft"
  | "fallback_error";

export interface RefineDraftResult {
  outcome: RefineDraftOutcome;
  /** The new draft on success; the prior draft on every non-success outcome. Never empty unless the caller passed an empty priorDraft. */
  draft_body: string;
  low_confidence_flags: DraftReplyOutput["low_confidence_flags"];
  reason: string;
}

// ── Main entry point ─────────────────────────────────────────────────

export async function generateRefinedDraft(
  input: GenerateRefinedDraftInput,
): Promise<RefineDraftResult> {
  const priorDraft = input.priorDraft ?? "";

  if (!killSwitches.llm_calls_enabled) {
    return {
      outcome: "skipped_kill_switch",
      draft_body: priorDraft,
      low_confidence_flags: [],
      reason: "skipped (llm_calls_enabled = false)",
    };
  }

  const trimmedInstruction = input.instruction.trim().slice(0, MAX_REFINE_INSTRUCTION_CHARS);
  if (trimmedInstruction.length === 0) {
    return {
      outcome: "skipped_empty_instruction",
      draft_body: priorDraft,
      low_confidence_flags: [],
      reason: "instruction was empty",
    };
  }

  if (priorDraft.trim().length === 0) {
    return {
      outcome: "skipped_empty_prior_draft",
      draft_body: priorDraft,
      low_confidence_flags: [],
      reason: "prior draft was empty — nothing to refine",
    };
  }

  // Cap prior turns head-first so the most recent iteration context is kept.
  const cappedTurns = (input.priorTurns ?? []).slice(-MAX_REFINE_TURNS);

  const [brand, cce, threadHistory] = await Promise.all([
    loadBrandDna(),
    loadClientContextOrStub(input.contactId ?? null),
    input.threadId
      ? loadThreadHistory(input.threadId)
      : Promise.resolve([] as ThreadMessageSnapshot[]),
  ]);

  const systemPrompt = buildDraftReplySystemPrompt(brand);
  const userPrompt = buildRefineUserPrompt({
    priorDraft,
    instruction: trimmedInstruction,
    priorTurns: cappedTurns,
    sendingAddress: input.sendingAddress,
    clientContext: cce,
    threadHistory,
  });

  // Single-string prompt: matches UI-5/UI-6 pattern until `invoke.ts`
  // ships a first-class `system` param (PATCHES_OWED from UI-5).
  const combinedPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  let parsed: DraftReplyOutput;
  try {
    const text = await invokeLlmText({
      job: "inbox-draft-refine",
      prompt: combinedPrompt,
      maxTokens: REFINE_MAX_OUTPUT_TOKENS,
    });
    const json = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    parsed = DraftReplyOutputSchema.parse(JSON.parse(json));
  } catch (err) {
    console.error(
      "[refine-draft] Rewrite failed — preserving prior draft:",
      err,
    );
    return {
      outcome: "fallback_error",
      draft_body: priorDraft,
      low_confidence_flags: [],
      reason: "fallback — LLM/parse error (prior draft preserved)",
    };
  }

  // Defensive: if the model returns empty body, keep the prior draft.
  // A refine turn should never silently blank the user's work.
  if (!parsed.draft_body || parsed.draft_body.trim() === "") {
    return {
      outcome: "fallback_error",
      draft_body: priorDraft,
      low_confidence_flags: [],
      reason: "model returned empty body — prior draft preserved",
    };
  }

  return {
    outcome: "generated",
    draft_body: parsed.draft_body,
    low_confidence_flags: parsed.low_confidence_flags,
    reason: "ok",
  };
}

// ── Prompt builder ───────────────────────────────────────────────────

interface RefineUserPromptInput {
  priorDraft: string;
  instruction: string;
  priorTurns: RefineTurn[];
  sendingAddress: string;
  clientContext: ClientContextSnapshot;
  threadHistory: ThreadMessageSnapshot[];
}

export function buildRefineUserPrompt(input: RefineUserPromptInput): string {
  const client = formatClientContext(input.clientContext);
  const historyBlock = input.threadHistory.length > 0
    ? `THREAD HISTORY (oldest → newest, for context — do not rehash):\n${formatThreadHistory(input.threadHistory)}\n\n`
    : "";
  const turnsBlock = input.priorTurns.length > 0
    ? `PRIOR REFINE TURNS (oldest → newest — earlier iterations Andy has already tried):\n${formatPriorTurns(input.priorTurns)}\n\n`
    : "";

  return `WHO THEY ARE / WHERE YOU ARE WITH THEM:
${client}

${historyBlock}SENDING FROM: ${input.sendingAddress}

CURRENT DRAFT (the one being refined):
${input.priorDraft.slice(0, MAX_BODY_CHARS * 2)}

${turnsBlock}ANDY'S NEW INSTRUCTION:
${input.instruction}

TASK: Rewrite the current draft to satisfy Andy's new instruction. Keep everything the instruction doesn't touch — changes should be surgical, not total rewrites, unless the instruction asks for a total rewrite. Preserve facts grounded in the thread history / client context; don't invent. If the instruction would require a claim you can't verify, either ask one plain question in Andy's voice or leave the uncertain claim out — never fabricate. Flag any span you weren't sure about in "low_confidence_flags".

Respond with the JSON object described in the system prompt. JSON only.`;
}

function formatClientContext(cc: ClientContextSnapshot): string {
  const lines: string[] = [];
  lines.push(`- Name: ${cc.display_name ?? "unknown"}`);
  lines.push(`- Relationship: ${cc.relationship_type ?? "unknown"}`);
  if (cc.summary) {
    lines.push(`- Summary: ${cc.summary}`);
  }
  if (cc.open_action_items.length > 0) {
    lines.push(`- Open action items:`);
    for (const item of cc.open_action_items) {
      lines.push(`    • ${item}`);
    }
  }
  if (cc.recent_activity.length > 0) {
    lines.push(`- Recent activity (newest first):`);
    for (const row of cc.recent_activity) {
      const date = new Date(row.created_at_ms).toISOString().slice(0, 10);
      lines.push(`    • [${date} · ${row.kind}] ${row.body.slice(0, 240)}`);
    }
  } else if (!cc.summary) {
    lines.push(`- (No prior activity on record. Treat as a fresh conversation.)`);
  }
  if (cc.source === "stub") {
    lines.push(
      `- Note: Client Context Engine is not yet live — this block is a minimal fallback. Avoid claims that would require full context.`,
    );
  }
  return lines.join("\n");
}

function formatThreadHistory(history: ThreadMessageSnapshot[]): string {
  return history
    .map((m) => {
      const date = m.sent_at_ms
        ? new Date(m.sent_at_ms).toISOString().slice(0, 16).replace("T", " ")
        : "unknown time";
      const sender = m.direction === "outbound" ? "Andy" : m.from_address;
      return `[${date} · ${sender}]\n${m.body_text.trim()}`;
    })
    .join("\n\n");
}

function formatPriorTurns(turns: RefineTurn[]): string {
  return turns
    .map((t, i) => {
      const instruction = t.instruction.trim().slice(0, MAX_REFINE_INSTRUCTION_CHARS);
      const result = t.result_body.slice(0, MAX_BODY_CHARS);
      return `Turn ${i + 1}:\nInstruction: ${instruction}\nResult:\n${result}`;
    })
    .join("\n\n---\n\n");
}

// ── Context loaders (shape-parallel to compose-draft.ts) ─────────────

async function loadBrandDna(): Promise<BrandDnaContext> {
  const row = await db
    .select({
      prose_portrait: brand_dna_profiles.prose_portrait,
      first_impression: brand_dna_profiles.first_impression,
    })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.is_superbad_self, true),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .orderBy(desc(brand_dna_profiles.completed_at_ms))
    .limit(1)
    .get();
  return {
    prose_portrait: row?.prose_portrait ?? null,
    first_impression: row?.first_impression ?? null,
  };
}

async function loadThreadHistory(
  threadId: string,
): Promise<ThreadMessageSnapshot[]> {
  const rows = await db
    .select({
      direction: messages.direction,
      from_address: messages.from_address,
      subject: messages.subject,
      body_text: messages.body_text,
      sent_at_ms: messages.sent_at_ms,
      received_at_ms: messages.received_at_ms,
      created_at_ms: messages.created_at_ms,
    })
    .from(messages)
    .where(eq(messages.thread_id, threadId))
    .orderBy(asc(messages.created_at_ms))
    .limit(MAX_THREAD_MESSAGES);

  return rows.map((m) => ({
    direction: m.direction,
    from_address: m.from_address,
    subject: m.subject,
    body_text: (m.body_text ?? "").slice(0, MAX_BODY_CHARS),
    sent_at_ms: m.sent_at_ms ?? m.received_at_ms ?? m.created_at_ms,
  }));
}
