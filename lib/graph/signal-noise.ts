/**
 * Signal/noise classifier — Haiku-tier LLM call per spec §7.3 (Q12).
 *
 * Classifies inbound messages on the content-priority axis as
 * signal / noise / spam, with an optional noise sub-class. Writes to
 * `messages.priority_class`, `messages.noise_subclass`,
 * `messages.keep_until_ms`, and recomputes thread-level
 * `threads.keep_until_ms` as the MAX across all messages on the thread
 * (spec §9.1, discipline #56 — one signal message rescues the thread).
 *
 * Also updates `threads.priority_class` to match this inbound's class
 * (spec §5.1 — thread inherits from latest message).
 *
 * Gated by `inbox_sync_enabled` + `llm_calls_enabled`. When either is
 * off, returns a skip result with no side effects.
 *
 * Fallback asymmetry (discipline #63): on LLM/parse failure, defaults
 * to `signal` with `keep_until_ms = NULL`. Rationale: a false signal
 * in Focus is an annoyance Andy can correct; a false noise that gets
 * auto-deleted after 30 days is a broken relationship.
 *
 * Daily auto-delete sweep lives in
 * `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts`.
 */
import { z } from "zod";
import { and, eq, isNull, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, threads } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import type { NormalizedMessage } from "./normalize";
import {
  loadSignalNoisePromptContext,
  buildSignalNoisePrompt,
} from "./signal-noise-prompt";

// ── Retention constants ──────────────────────────────────────────────
// Spec §9.1 values. Lexical spec constants (precedent: UI-2 SPAM_KEEP_DAYS
// in router.ts). Candidate for settings-table move if tuning is wanted.

const KEEP_DAYS_NOISE_TRANSACTIONAL = 180;
const KEEP_DAYS_NOISE_DEFAULT = 30;
const KEEP_DAYS_SPAM = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── Output schema ────────────────────────────────────────────────────

export const SignalNoiseOutputSchema = z.object({
  priority_class: z.enum(["signal", "noise", "spam"]),
  noise_subclass: z
    .enum(["transactional", "marketing", "automated", "update", "other"])
    .nullable(),
  reason: z.string(),
});

export type SignalNoiseOutput = z.infer<typeof SignalNoiseOutputSchema>;

export interface SignalNoiseResult {
  priority_class: SignalNoiseOutput["priority_class"];
  noise_subclass: SignalNoiseOutput["noise_subclass"];
  reason: string;
  skipped: boolean;
}

// ── Main entry point ─────────────────────────────────────────────────

export async function classifySignalNoise(
  msg: NormalizedMessage,
  messageId: string,
  threadId: string,
): Promise<SignalNoiseResult> {
  if (!killSwitches.inbox_sync_enabled || !killSwitches.llm_calls_enabled) {
    return {
      priority_class: "signal",
      noise_subclass: null,
      reason: "skipped (kill switch)",
      skipped: true,
    };
  }

  const ctx = await loadSignalNoisePromptContext(msg, threadId);
  const prompt = buildSignalNoisePrompt(ctx);

  let parsed: SignalNoiseOutput;
  try {
    const text = await invokeLlmText({
      job: "inbox-classify-signal-noise",
      prompt,
      maxTokens: 160,
    });
    const json = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    parsed = SignalNoiseOutputSchema.parse(JSON.parse(json));
  } catch (err) {
    console.error(
      "[signal-noise] Classification failed, falling back to signal:",
      err,
    );
    await persistClassification(
      messageId,
      threadId,
      msg,
      { priority_class: "signal", noise_subclass: null, reason: "fallback — LLM/parse error" },
    );
    return {
      priority_class: "signal",
      noise_subclass: null,
      reason: "fallback — LLM/parse error",
      skipped: false,
    };
  }

  // Normalise: noise_subclass must be null when priority_class !== 'noise'.
  const normalised: SignalNoiseOutput = {
    priority_class: parsed.priority_class,
    noise_subclass:
      parsed.priority_class === "noise" ? parsed.noise_subclass : null,
    reason: parsed.reason,
  };

  await persistClassification(messageId, threadId, msg, normalised);

  return {
    priority_class: normalised.priority_class,
    noise_subclass: normalised.noise_subclass,
    reason: normalised.reason,
    skipped: false,
  };
}

// ── Persistence ──────────────────────────────────────────────────────

async function persistClassification(
  messageId: string,
  threadId: string,
  msg: NormalizedMessage,
  output: SignalNoiseOutput,
): Promise<void> {
  const nowMs = Date.now();

  const overrides = await loadOverridesForThread(threadId);
  const baselineMs = msg.sent_at_ms ?? msg.received_at_ms ?? nowMs;
  const keepUntilMs = computeMessageKeepUntilMs(
    output.priority_class,
    output.noise_subclass,
    baselineMs,
    overrides,
  );

  await db
    .update(messages)
    .set({
      priority_class: output.priority_class,
      noise_subclass: output.noise_subclass,
      keep_until_ms: keepUntilMs,
      updated_at_ms: nowMs,
    })
    .where(eq(messages.id, messageId));

  await recomputeThreadKeepUntil(threadId, overrides);

  // Thread priority_class inherits from latest inbound message
  // (spec §5.1). Last-inbound-wins; agrees with router.handleSpam when
  // both classifiers agree on spam.
  await db
    .update(threads)
    .set({ priority_class: output.priority_class, updated_at_ms: nowMs })
    .where(eq(threads.id, threadId));
}

// ── Keep-until math ──────────────────────────────────────────────────

export interface ThreadKeepOverrides {
  keep_pinned: boolean;
  always_keep_noise: boolean;
}

async function loadOverridesForThread(
  threadId: string,
): Promise<ThreadKeepOverrides> {
  const threadRow = await db
    .select({
      keep_pinned: threads.keep_pinned,
      contact_id: threads.contact_id,
    })
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();

  if (!threadRow) {
    return { keep_pinned: false, always_keep_noise: false };
  }

  if (!threadRow.contact_id) {
    return { keep_pinned: threadRow.keep_pinned, always_keep_noise: false };
  }

  const contactRow = await db
    .select({ always_keep_noise: contacts.always_keep_noise })
    .from(contacts)
    .where(eq(contacts.id, threadRow.contact_id))
    .get();

  return {
    keep_pinned: threadRow.keep_pinned,
    always_keep_noise: contactRow?.always_keep_noise ?? false,
  };
}

/**
 * Computes `keep_until_ms` for a single message from its classification +
 * thread/contact overrides. Spec §9.1.
 *
 * Returns `null` = keep indefinitely (signal, or override engaged).
 */
export function computeMessageKeepUntilMs(
  priorityClass: SignalNoiseOutput["priority_class"],
  noiseSubclass: SignalNoiseOutput["noise_subclass"],
  baselineMs: number,
  overrides: ThreadKeepOverrides,
): number | null {
  if (priorityClass === "signal") return null;
  if (overrides.keep_pinned) return null;
  if (overrides.always_keep_noise) return null;

  if (priorityClass === "spam") {
    return baselineMs + KEEP_DAYS_SPAM * MS_PER_DAY;
  }

  // priority_class = noise
  const days =
    noiseSubclass === "transactional"
      ? KEEP_DAYS_NOISE_TRANSACTIONAL
      : KEEP_DAYS_NOISE_DEFAULT;
  return baselineMs + days * MS_PER_DAY;
}

/**
 * Recomputes the thread-level `keep_until_ms` as the MAX across every
 * message on the thread (spec §9.1, discipline #56 — one signal message
 * rescues the whole thread to NULL).
 *
 * Rule:
 *  - If any override is engaged (keep_pinned OR always_keep_noise) → NULL.
 *  - Else if ANY message on the thread has `keep_until_ms = NULL` → NULL.
 *  - Else thread keep_until_ms = MAX of message keep_until_ms values.
 */
export async function recomputeThreadKeepUntil(
  threadId: string,
  overrides?: ThreadKeepOverrides,
): Promise<void> {
  const effectiveOverrides =
    overrides ?? (await loadOverridesForThread(threadId));

  if (effectiveOverrides.keep_pinned || effectiveOverrides.always_keep_noise) {
    await db
      .update(threads)
      .set({ keep_until_ms: null, updated_at_ms: Date.now() })
      .where(eq(threads.id, threadId));
    return;
  }

  // Any live message with NULL keep_until_ms → thread is NULL.
  const hasNull = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.thread_id, threadId),
        isNull(messages.keep_until_ms),
        isNull(messages.deleted_at_ms),
      ),
    )
    .limit(1)
    .get();

  if (hasNull) {
    await db
      .update(threads)
      .set({ keep_until_ms: null, updated_at_ms: Date.now() })
      .where(eq(threads.id, threadId));
    return;
  }

  const [maxRow] = await db
    .select({ value: max(messages.keep_until_ms) })
    .from(messages)
    .where(
      and(eq(messages.thread_id, threadId), isNull(messages.deleted_at_ms)),
    );

  const newValue: number | null =
    typeof maxRow?.value === "number" ? maxRow.value : null;

  await db
    .update(threads)
    .set({ keep_until_ms: newValue, updated_at_ms: Date.now() })
    .where(eq(threads.id, threadId));
}
