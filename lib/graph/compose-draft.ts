/**
 * Compose-side LLM helpers for the Unified Inbox outbound path (UI-6).
 *
 * Two entry points:
 *   - `generateComposeDraft({ intent, contactId?, threadId?, sendingAddress })`
 *     Opus generator — Andy types a one-line intent, we draft the full
 *     email body. Reuses UI-5's `buildDraftReplySystemPrompt` for voice
 *     and Brand DNA framing; layers a compose-specific user prompt that
 *     leads with the intent and adds thread history (reply-compose) OR
 *     recent Andy-sent messages (compose-from-scratch) as few-shot voice.
 *   - `generateComposeSubject({ bodyText })`
 *     Haiku helper — called by `sendCompose` only when Andy leaves the
 *     subject blank. Returns a ≤60-char subject; fallback is a
 *     first-10-words heuristic so the send never blocks on LLM failure.
 *
 * Shared discipline with UI-5 (`lib/graph/draft-reply.ts`):
 *  - Two-perpetual-contexts (Brand DNA system + CCE user) per memory
 *    `project_two_perpetual_contexts`.
 *  - Conservative-side fallback (#63): compose-draft failure returns
 *    empty body + logs; UI shows "Drafting failed — try again" rather
 *    than a misleading auto-populated draft.
 *  - Kill-switch gate on `llm_calls_enabled`. Does NOT gate on
 *    `inbox_sync_enabled` — compose-draft is pure LLM, never hits Graph.
 *  - Model registry only; no raw model IDs (memory
 *    `project_llm_model_registry`).
 */
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, threads } from "@/lib/db/schema/messages";
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
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

// ── Constants (mirrored from UI-5 where semantics overlap) ───────────

const MAX_THREAD_MESSAGES = 20;
const MAX_FEW_SHOTS = 10;
const MAX_BODY_CHARS = 2000;
const MAX_INTENT_CHARS = 500;
const DRAFT_MAX_OUTPUT_TOKENS = 1200;

/** Subject cap from spec §4.4 "auto-generates at send time from body if blank". */
export const COMPOSE_SUBJECT_MAX_LEN = 60;
const SUBJECT_MAX_OUTPUT_TOKENS = 120;

// ── Compose-draft generator ──────────────────────────────────────────

export interface GenerateComposeDraftInput {
  intent: string;
  contactId?: string | null;
  threadId?: string | null;
  sendingAddress: string;
}

export type ComposeDraftOutcome =
  | "generated"
  | "skipped_kill_switch"
  | "skipped_empty_intent"
  | "fallback_error";

export interface ComposeDraftResult {
  outcome: ComposeDraftOutcome;
  draft_body: string;
  low_confidence_flags: DraftReplyOutput["low_confidence_flags"];
  reason: string;
}

export async function generateComposeDraft(
  input: GenerateComposeDraftInput,
): Promise<ComposeDraftResult> {
  if (!killSwitches.llm_calls_enabled) {
    return {
      outcome: "skipped_kill_switch",
      draft_body: "",
      low_confidence_flags: [],
      reason: "skipped (llm_calls_enabled = false)",
    };
  }

  const trimmedIntent = input.intent.trim().slice(0, MAX_INTENT_CHARS);
  if (trimmedIntent.length === 0) {
    return {
      outcome: "skipped_empty_intent",
      draft_body: "",
      low_confidence_flags: [],
      reason: "intent was empty",
    };
  }

  const [brand, cce, threadHistory, fewShots] = await Promise.all([
    loadBrandDna(),
    loadClientContextOrStub(input.contactId ?? null),
    input.threadId
      ? loadThreadHistory(input.threadId)
      : Promise.resolve([] as ThreadMessageSnapshot[]),
    input.threadId
      ? Promise.resolve([] as ThreadMessageSnapshot[])
      : input.contactId
        ? loadRecentAndySentToContact(input.contactId)
        : Promise.resolve([] as ThreadMessageSnapshot[]),
  ]);

  const systemPrompt = buildDraftReplySystemPrompt(brand);
  const userPrompt = buildComposeUserPrompt({
    intent: trimmedIntent,
    sendingAddress: input.sendingAddress,
    clientContext: cce,
    threadHistory,
    recentAndySent: fewShots,
  });

  // UI-5 precedent: `invokeLlmText` only takes a single string; fold the
  // system prompt in as a labelled preamble. PATCHES_OWED carries the
  // refactor to route via Anthropic's `system` field.
  const combinedPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  let parsed: DraftReplyOutput;
  try {
    const text = await invokeLlmText({
      job: "inbox-compose-draft",
      prompt: combinedPrompt,
      maxTokens: DRAFT_MAX_OUTPUT_TOKENS,
    });
    const json = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    parsed = DraftReplyOutputSchema.parse(JSON.parse(json));
  } catch (err) {
    console.error(
      "[compose-draft] Generation failed — returning empty body:",
      err,
    );
    return {
      outcome: "fallback_error",
      draft_body: "",
      low_confidence_flags: [],
      reason: "fallback — LLM/parse error",
    };
  }

  return {
    outcome: "generated",
    draft_body: parsed.draft_body,
    low_confidence_flags: parsed.low_confidence_flags,
    reason: "ok",
  };
}

// ── Compose-subject helper ───────────────────────────────────────────

export const ComposeSubjectOutputSchema = z.object({
  subject: z.string(),
});

export interface GenerateComposeSubjectInput {
  bodyText: string;
}

export type ComposeSubjectOutcome =
  | "generated"
  | "skipped_kill_switch"
  | "fallback_heuristic";

export interface ComposeSubjectResult {
  outcome: ComposeSubjectOutcome;
  subject: string;
  reason: string;
}

export async function generateComposeSubject(
  input: GenerateComposeSubjectInput,
): Promise<ComposeSubjectResult> {
  const heuristic = firstWordsHeuristic(input.bodyText);

  if (!killSwitches.llm_calls_enabled) {
    return {
      outcome: "skipped_kill_switch",
      subject: heuristic,
      reason: "skipped (llm_calls_enabled = false) — first-words heuristic",
    };
  }

  const trimmedBody = input.bodyText.slice(0, MAX_BODY_CHARS);
  if (trimmedBody.trim().length === 0) {
    return {
      outcome: "fallback_heuristic",
      subject: heuristic,
      reason: "body empty — first-words heuristic",
    };
  }

  try {
    const prompt = `Write a short email subject line for the message below. Plain, specific, ${COMPOSE_SUBJECT_MAX_LEN} characters or fewer. No quotes, no emoji, no "Re:"/"Fwd:" prefixes. Match Andy's voice (dry, observational, never explains the joke).

EMAIL BODY:
${trimmedBody}

Respond with ONLY a JSON object: {"subject":"..."}. No prose outside the JSON.`;
    const text = await invokeLlmText({
      job: "inbox-compose-subject",
      prompt,
      maxTokens: SUBJECT_MAX_OUTPUT_TOKENS,
    });
    const json = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    const parsed = ComposeSubjectOutputSchema.parse(JSON.parse(json));
    const capped = capSubject(parsed.subject);
    if (capped.length === 0) {
      return {
        outcome: "fallback_heuristic",
        subject: heuristic,
        reason: "LLM returned empty subject — first-words heuristic",
      };
    }
    return {
      outcome: "generated",
      subject: capped,
      reason: "ok",
    };
  } catch (err) {
    console.error(
      "[compose-subject] Generation failed — first-words heuristic:",
      err,
    );
    return {
      outcome: "fallback_heuristic",
      subject: heuristic,
      reason: "fallback — LLM/parse error",
    };
  }
}

// ── Prompt builders ──────────────────────────────────────────────────

interface ComposeUserPromptInput {
  intent: string;
  sendingAddress: string;
  clientContext: ClientContextSnapshot;
  threadHistory: ThreadMessageSnapshot[];
  recentAndySent: ThreadMessageSnapshot[];
}

export function buildComposeUserPrompt(
  input: ComposeUserPromptInput,
): string {
  const client = formatClientContext(input.clientContext);
  const history = input.threadHistory.length > 0
    ? formatThreadHistory(input.threadHistory)
    : "(no existing thread — Andy is composing from scratch)";
  const fewShots = input.recentAndySent.length > 0
    ? formatFewShots(input.recentAndySent)
    : "";

  return `WHO THEY ARE / WHERE YOU ARE WITH THEM:
${client}

${input.threadHistory.length > 0 ? `THREAD HISTORY (oldest → newest, for context — do not rehash):` : `RECENT VOICE ANCHORS (prior Andy-sent emails to this contact, for voice calibration — do not quote):`}
${input.threadHistory.length > 0 ? history : fewShots || "(no prior outbound on record)"}

SENDING FROM: ${input.sendingAddress}

ANDY'S INTENT (one line, what he's trying to say):
${input.intent}

TASK: Draft the outbound email body Andy is describing. Use the client context to ground specifics; use the voice anchors / thread history to match his register. If the intent implies a claim you can't verify from the context (price, date, project name), either ask one plain question in Andy's voice OR leave the uncertain claim out — never invent. Flag any span you weren't sure about in "low_confidence_flags".

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

function formatFewShots(shots: ThreadMessageSnapshot[]): string {
  return shots
    .map((m, i) => {
      const date = m.sent_at_ms
        ? new Date(m.sent_at_ms).toISOString().slice(0, 10)
        : "unknown date";
      return `Example ${i + 1} [${date}]:\n${m.body_text.trim()}`;
    })
    .join("\n\n---\n\n");
}

// ── Context loaders ──────────────────────────────────────────────────

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

/**
 * Load up to `MAX_FEW_SHOTS` recent outbound messages Andy has sent to
 * the given contact, newest first. Used as voice anchors when composing
 * from scratch (no thread context to draw on).
 */
async function loadRecentAndySentToContact(
  contactId: string,
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
    .innerJoin(threads, eq(messages.thread_id, threads.id))
    .where(
      and(
        eq(threads.contact_id, contactId),
        eq(messages.direction, "outbound"),
      ),
    )
    .orderBy(desc(messages.created_at_ms))
    .limit(MAX_FEW_SHOTS);

  return rows.map((m) => ({
    direction: m.direction,
    from_address: m.from_address,
    subject: m.subject,
    body_text: (m.body_text ?? "").slice(0, MAX_BODY_CHARS),
    sent_at_ms: m.sent_at_ms ?? m.received_at_ms ?? m.created_at_ms,
  }));
}

// ── Subject helpers ──────────────────────────────────────────────────

function capSubject(raw: string): string {
  const stripped = raw
    .replace(/^\s*"(.*)"\s*$/, "$1")
    .replace(/^\s*'(.*)'\s*$/, "$1")
    .trim();
  if (stripped.length <= COMPOSE_SUBJECT_MAX_LEN) return stripped;
  return stripped.slice(0, COMPOSE_SUBJECT_MAX_LEN).trimEnd();
}

function firstWordsHeuristic(bodyText: string): string {
  const normalised = bodyText.trim().replace(/\s+/g, " ");
  if (normalised.length === 0) return "Message from Andy";
  const words = normalised.split(" ").slice(0, 10).join(" ");
  return capSubject(words);
}
