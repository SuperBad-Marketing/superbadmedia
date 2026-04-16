/**
 * Thread draft-reply generator — Opus-tier LLM call per spec §7.4
 * (Q14, Q15) + §6.2 (cached-draft lifecycle).
 *
 * Called asynchronously by the `inbox_draft_generate` scheduled task
 * handler after the three parallel classifiers have settled. Loads
 * the two perpetual contexts (Brand DNA + Client Context Engine),
 * composes a prompt around the trimmed thread history, asks Opus for
 * a draft, and caches the result on the thread row.
 *
 * Gated by `inbox_sync_enabled` + `llm_calls_enabled`. When either
 * is off, returns a skip result and does nothing.
 *
 * Fallback asymmetry (discipline #63): on LLM/parse failure the
 * generator logs and **does NOT write** — the missing draft is a
 * minor annoyance Andy absorbs; a subtly-wrong cached draft Andy
 * trusts and sends is a burned client. The prior cached draft (if
 * any) stays put until the next inbound re-triggers.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { threads } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmText } from "@/lib/ai/invoke";
import {
  loadDraftReplyPromptContext,
  buildDraftReplyUserPrompt,
  buildDraftReplySystemPrompt,
  type DraftReplyPromptContext,
} from "./draft-reply-prompt";

// ── Output schema ────────────────────────────────────────────────────

export const DraftReplyLowConfidenceFlagSchema = z.object({
  span: z.string(),
  reason: z.string(),
});

export const DraftReplyOutputSchema = z.object({
  draft_body: z.string(),
  low_confidence_flags: z.array(DraftReplyLowConfidenceFlagSchema).default([]),
});

export type DraftReplyLowConfidenceFlag = z.infer<
  typeof DraftReplyLowConfidenceFlagSchema
>;
export type DraftReplyOutput = z.infer<typeof DraftReplyOutputSchema>;

export type DraftReplyOutcome =
  | "generated"
  | "skipped_kill_switch"
  | "skipped_no_context"
  | "skipped_empty_body"
  | "fallback_error";

export interface DraftReplyResult {
  outcome: DraftReplyOutcome;
  draft_body: string | null;
  low_confidence_flags: DraftReplyLowConfidenceFlag[];
  reason: string;
}

const MAX_OUTPUT_TOKENS = 1200;

// ── Main entry point ─────────────────────────────────────────────────

export async function generateCachedDraftReply(
  threadId: string,
): Promise<DraftReplyResult> {
  if (!killSwitches.inbox_sync_enabled || !killSwitches.llm_calls_enabled) {
    return {
      outcome: "skipped_kill_switch",
      draft_body: null,
      low_confidence_flags: [],
      reason: "skipped (kill switch)",
    };
  }

  const ctx = await loadDraftReplyPromptContext(threadId);
  if (!ctx) {
    return {
      outcome: "skipped_no_context",
      draft_body: null,
      low_confidence_flags: [],
      reason: "thread missing or has no inbound messages",
    };
  }

  const systemPrompt = buildDraftReplySystemPrompt(ctx.brand_dna);
  const userPrompt = buildDraftReplyUserPrompt(ctx);
  // The SDK boundary (`invokeLlmText`) accepts a single prompt string.
  // Fold the system prompt in as a labelled preamble; Opus handles the
  // role framing in-text fine and we keep the boundary tight.
  const combinedPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  let parsed: DraftReplyOutput;
  try {
    const text = await invokeLlmText({
      job: "inbox-draft-reply",
      prompt: combinedPrompt,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
    const json = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    parsed = DraftReplyOutputSchema.parse(JSON.parse(json));
  } catch (err) {
    console.error(
      `[draft-reply] Generation failed for thread ${threadId} — leaving prior draft in place:`,
      err,
    );
    return {
      outcome: "fallback_error",
      draft_body: null,
      low_confidence_flags: [],
      reason: "fallback — LLM/parse error (no write)",
    };
  }

  // Empty-body response = the model judged no reply warranted. Respect
  // that: clear `has_cached_draft` so the UI doesn't dangle an old
  // draft, but don't emit a draft.
  if (!parsed.draft_body || parsed.draft_body.trim() === "") {
    await clearCachedDraft(threadId);
    return {
      outcome: "skipped_empty_body",
      draft_body: "",
      low_confidence_flags: [],
      reason: "model returned empty body (no reply warranted)",
    };
  }

  await persistCachedDraft(threadId, parsed, ctx);

  return {
    outcome: "generated",
    draft_body: parsed.draft_body,
    low_confidence_flags: parsed.low_confidence_flags,
    reason: "ok",
  };
}

// ── Persistence ──────────────────────────────────────────────────────

async function persistCachedDraft(
  threadId: string,
  output: DraftReplyOutput,
  ctx: DraftReplyPromptContext,
): Promise<void> {
  const nowMs = Date.now();

  await db
    .update(threads)
    .set({
      cached_draft_body: output.draft_body,
      cached_draft_generated_at_ms: nowMs,
      cached_draft_stale: false,
      has_cached_draft: true,
      cached_draft_low_confidence_flags:
        output.low_confidence_flags.length > 0
          ? output.low_confidence_flags
          : null,
      updated_at_ms: nowMs,
    })
    .where(eq(threads.id, threadId));

  const contactId = await lookupContactIdForThread(threadId);

  await logActivity({
    companyId: null,
    contactId,
    kind: "inbox_draft_generated",
    body: `Cached draft generated (${ctx.thread_history.length} msgs of history, ${ctx.few_shots.length} few-shots, ${output.low_confidence_flags.length} low-confidence flags).`,
    meta: {
      thread_id: threadId,
      generated_at_ms: nowMs,
      history_size: ctx.thread_history.length,
      few_shot_count: ctx.few_shots.length,
      low_confidence_flag_count: output.low_confidence_flags.length,
      cce_source: ctx.client_context.source,
    },
  });
}

async function clearCachedDraft(threadId: string): Promise<void> {
  const nowMs = Date.now();
  await db
    .update(threads)
    .set({
      cached_draft_body: null,
      cached_draft_generated_at_ms: null,
      cached_draft_stale: false,
      has_cached_draft: false,
      cached_draft_low_confidence_flags: null,
      updated_at_ms: nowMs,
    })
    .where(eq(threads.id, threadId));
}

/**
 * UI-6 inheritance contract (brief §5 + §"What UI-6 inherits"): outbound
 * send invalidates the cached draft because the thread has moved on.
 * Clears body + flags, drops `has_cached_draft`, and leaves `stale=false`
 * (there's nothing to re-draft against until the next inbound arrives).
 * Exported from UI-5 so UI-6/UI-7 can wire it into the send path without
 * reaching across modules to touch `threads` directly.
 */
export async function invalidateCachedDraft(
  threadId: string,
  reason: string,
): Promise<void> {
  await clearCachedDraft(threadId);
  const contactId = await lookupContactIdForThread(threadId);
  await logActivity({
    companyId: null,
    contactId,
    kind: "inbox_draft_discarded",
    body: `Cached draft invalidated (${reason}).`,
    meta: {
      thread_id: threadId,
      invalidated_at_ms: Date.now(),
      reason,
    },
  });
}

async function lookupContactIdForThread(
  threadId: string,
): Promise<string | null> {
  const row = await db
    .select({ contact_id: threads.contact_id })
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();
  if (!row?.contact_id) return null;

  // Guard: contact may have been deleted after the enqueue. Resolve and
  // return null on miss so logActivity's contact_id FK is safe.
  const contact = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.id, row.contact_id))
    .get();
  return contact?.id ?? null;
}
