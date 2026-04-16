/**
 * Notification triage classifier — Haiku-tier LLM call per spec §7.2 (Q10).
 *
 * Classifies inbound messages as urgent / push / silent for interruption
 * priority. Writes a `notifications` row per result + populates
 * `messages.notification_priority`. Actual push / PWA transports land in
 * a later UI session (spec §17 wave E); UI-3 writes rows with
 * `fired_transport = NULL` for push/urgent and `"none"` for silent.
 *
 * Gated by `inbox_sync_enabled` + `llm_calls_enabled`. When either is
 * off, returns a skip result with no side effects.
 *
 * Fallback asymmetry: on LLM/parse failure, defaults to `silent` (spec
 * discipline — missed urgency is recoverable via morning digest; a
 * spurious urgent push erodes trust faster).
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { messages, threads } from "@/lib/db/schema/messages";
import { notifications } from "@/lib/db/schema/notifications";
import { user } from "@/lib/db/schema/user";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmText } from "@/lib/ai/invoke";
import type { NormalizedMessage } from "./normalize";
import {
  loadNotifierPromptContext,
  buildNotifierPrompt,
} from "./notifier-prompt";

// ── Output schema ────────────────────────────────────────────────────

export const NotifierOutputSchema = z.object({
  priority: z.enum(["urgent", "push", "silent"]),
  reason: z.string(),
});

export type NotifierOutput = z.infer<typeof NotifierOutputSchema>;

export interface NotifierResult {
  priority: NotifierOutput["priority"];
  reason: string;
  skipped: boolean;
}

// ── Main entry point ─────────────────────────────────────────────────

export async function classifyNotificationPriority(
  msg: NormalizedMessage,
  messageId: string,
  threadId: string,
): Promise<NotifierResult> {
  if (!killSwitches.inbox_sync_enabled || !killSwitches.llm_calls_enabled) {
    return {
      priority: "silent",
      reason: "skipped (kill switch)",
      skipped: true,
    };
  }

  const ctx = await loadNotifierPromptContext(msg, threadId);
  const prompt = buildNotifierPrompt(ctx);

  let parsed: NotifierOutput;
  try {
    const text = await invokeLlmText({
      job: "inbox-classify-notification-priority",
      prompt,
      maxTokens: 128,
    });
    const json = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    parsed = NotifierOutputSchema.parse(JSON.parse(json));
  } catch (err) {
    // Fallback: silent on LLM/parse failure. Missed urgency recoverable
    // from morning digest; a spurious urgent push erodes trust.
    console.error(
      "[notifier] Classification failed, falling back to silent:",
      err,
    );
    await persistClassification(messageId, "silent", "fallback — LLM/parse error");
    return {
      priority: "silent",
      reason: "fallback — LLM/parse error",
      skipped: false,
    };
  }

  await persistClassification(messageId, parsed.priority, parsed.reason);

  return {
    priority: parsed.priority,
    reason: parsed.reason,
    skipped: false,
  };
}

// ── Persistence ──────────────────────────────────────────────────────

/**
 * Writes the classification to both `messages.notification_priority`
 * (for thread-level queries + activity log) and a new `notifications`
 * row (for dispatcher consumption + morning digest).
 *
 * `fired_transport`:
 *  - silent → `"none"` (morning digest reads these)
 *  - push/urgent → `NULL` (dispatcher picks these up when UI-E lands)
 */
async function persistClassification(
  messageId: string,
  priority: NotifierOutput["priority"],
  reason: string,
): Promise<void> {
  const nowMs = Date.now();

  await db
    .update(messages)
    .set({ notification_priority: priority, updated_at_ms: nowMs })
    .where(eq(messages.id, messageId));

  const adminUserId = await resolveAdminUserId();
  if (!adminUserId) {
    // No admin seeded — test harness or pre-A8 state. Skip notifications
    // row; the messages update already happened.
    return;
  }

  await db.insert(notifications).values({
    id: randomUUID(),
    message_id: messageId,
    user_id: adminUserId,
    priority,
    fired_transport: priority === "silent" ? "none" : null,
    fired_at_ms: nowMs,
    reason,
  });

  const contactId = await lookupContactForMessage(messageId);
  await logActivity({
    companyId: null,
    contactId,
    kind: "inbox_notification_fired",
    body: `Inbound notification classified as ${priority}: ${reason}`,
    meta: {
      priority,
      message_id: messageId,
      reason,
      fired_transport: priority === "silent" ? "none" : null,
    },
  });
}

/**
 * Resolves the admin user id. v1 is solo — any row with `role='admin'`
 * is Andy. Per discipline #58 this is scaffolded for future hiring.
 */
async function resolveAdminUserId(): Promise<string | null> {
  const row = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))
    .limit(1)
    .get();
  return row?.id ?? null;
}

async function lookupContactForMessage(
  messageId: string,
): Promise<string | null> {
  const row = await db
    .select({ thread_id: messages.thread_id })
    .from(messages)
    .where(eq(messages.id, messageId))
    .get();
  if (!row) return null;

  const thread = await db
    .select({ contact_id: threads.contact_id })
    .from(threads)
    .where(eq(threads.id, row.thread_id))
    .get();
  return thread?.contact_id ?? null;
}
