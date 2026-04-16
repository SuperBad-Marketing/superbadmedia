/**
 * Compose-send wrapper (UI-6). Sits between the server action and the
 * lower-level primitives:
 *   - `resolveRecipientContact(email)` — email → `{ contactId, companyId }`
 *     or null (walk-in). Case-insensitive match on `contacts.email_normalised`.
 *   - `ensureThreadForCompose(input)` — reuses the existing thread when
 *     `threadId` is supplied, otherwise synthesises a new thread. Keeps
 *     the thread-creation shape consistent with `resolveThread()` in
 *     `thread.ts` (same default columns).
 *   - `sendComposeMessage(input)` — glue: ensures a thread, resolves the
 *     Haiku-derived subject when Andy leaves it blank, calls `sendViaGraph`
 *     (which inserts the outbound row + updates thread timestamps +
 *     clears `has_cached_draft` on the thread), then calls
 *     `invalidateCachedDraft(threadId, reason)` so the `inbox_draft_discarded`
 *     activity log + `cached_draft_low_confidence_flags` clear both fire.
 *     Finally emits `inbox_message_sent` + deletes any `compose_drafts`
 *     row that backed this compose session.
 *
 * Kill switches: `inbox_send_enabled` guards this path specifically;
 * `inbox_sync_enabled` guards the HTTP call inside `sendViaGraph`.
 * Both must be ON for a send to land; either OFF throws a descriptive
 * error that the server action surfaces to the UI.
 */
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { threads, type ThreadInsert } from "@/lib/db/schema/messages";
import { compose_drafts } from "@/lib/db/schema/compose-drafts";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import type { GraphClient } from "./client";
import { sendViaGraph, type SendViaGraphResult } from "./send";
import { invalidateCachedDraft } from "./draft-reply";
import { generateComposeSubject } from "./compose-draft";

export interface ResolveRecipientResult {
  contactId: string;
  companyId: string;
}

/**
 * Exact match on `contacts.email_normalised` (lower-case). Returns the
 * first contact hit; multi-contact collisions are rare in practice and
 * the first-match behaviour matches the router's existing convention.
 */
export async function resolveRecipientContact(
  email: string,
): Promise<ResolveRecipientResult | null> {
  const normalised = email.trim().toLowerCase();
  if (normalised.length === 0) return null;
  const row = await db
    .select({ id: contacts.id, company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.email_normalised, normalised))
    .limit(1)
    .get();
  if (!row) return null;
  return { contactId: row.id, companyId: row.company_id };
}

export interface EnsureThreadInput {
  threadId?: string | null;
  contactId: string | null;
  companyId: string | null;
  subject: string | null;
  sendingAddress: string;
}

/**
 * When `threadId` is supplied, return it as-is (the outbound lands on
 * an existing thread — typical for a reply-from-compose flow). Otherwise
 * create a new thread with shape parallel to `resolveThread`'s synth
 * path: channel=email, priority=signal, no cached-draft, timestamps set
 * to now. We DON'T set `last_inbound_at_ms` since the first event on
 * this thread will be the outbound send.
 */
export async function ensureThreadForCompose(
  input: EnsureThreadInput,
): Promise<string> {
  if (input.threadId) {
    return input.threadId;
  }
  const now = Date.now();
  const threadId = randomUUID();
  const row: ThreadInsert = {
    id: threadId,
    contact_id: input.contactId,
    company_id: input.companyId,
    channel_of_origin: "email",
    sending_address: input.sendingAddress,
    subject: input.subject,
    priority_class: "signal",
    keep_until_ms: null,
    keep_pinned: false,
    last_message_at_ms: now,
    last_inbound_at_ms: null,
    last_outbound_at_ms: now,
    has_cached_draft: false,
    cached_draft_body: null,
    cached_draft_generated_at_ms: null,
    cached_draft_stale: false,
    snoozed_until_ms: null,
    created_at_ms: now,
    updated_at_ms: now,
  };
  await db.insert(threads).values(row);
  return threadId;
}

export interface SendComposeInput {
  /** Existing thread to reply into; null/undefined → new thread. */
  threadId?: string | null;
  /** Resolved recipient contact (from `resolveRecipientContact`). */
  contactId: string | null;
  /** Resolved recipient company. */
  companyId: string | null;
  /** Andy's sending address (`/me` or `/users/support@…`). */
  sendingAddress: string;
  /** Primary recipient list. */
  to: string[];
  /** CC recipients; optional. */
  cc?: string[];
  /** BCC recipients; optional. */
  bcc?: string[];
  /**
   * Subject line. Blank/whitespace → Haiku-derive via
   * `generateComposeSubject` (falls back to first-10-words heuristic).
   */
  subject?: string | null;
  /** Body as plain text (the compose surface is plain-text first). */
  bodyText: string;
  /** Auth scope — actor tag, logged into `activity_log.created_by`. */
  createdBy: string | null;
  /** If this send drained a `compose_drafts` row, supply the id so it's deleted. */
  composeDraftId?: string | null;
}

export interface SendComposeResult {
  threadId: string;
  messageId: string;
  graphMessageId: string | null;
  subject: string;
  subjectSource: "user" | "generated" | "heuristic" | "kill_switch_heuristic";
}

export async function sendComposeMessage(
  client: GraphClient,
  input: SendComposeInput,
): Promise<SendComposeResult> {
  if (!killSwitches.inbox_send_enabled) {
    throw new Error(
      "Outbound compose send is disabled (inbox_send_enabled = false)",
    );
  }

  // Subject resolution — Andy-supplied wins; blank triggers Haiku.
  const userSubject = (input.subject ?? "").trim();
  let finalSubject: string;
  let subjectSource: SendComposeResult["subjectSource"];
  if (userSubject.length > 0) {
    finalSubject = userSubject;
    subjectSource = "user";
  } else {
    const gen = await generateComposeSubject({ bodyText: input.bodyText });
    finalSubject = gen.subject;
    subjectSource =
      gen.outcome === "generated"
        ? "generated"
        : gen.outcome === "skipped_kill_switch"
          ? "kill_switch_heuristic"
          : "heuristic";
  }

  const threadId = await ensureThreadForCompose({
    threadId: input.threadId ?? null,
    contactId: input.contactId,
    companyId: input.companyId,
    subject: finalSubject,
    sendingAddress: input.sendingAddress,
  });

  const send: SendViaGraphResult = await sendViaGraph(client, {
    threadId,
    from: input.sendingAddress,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: finalSubject,
    bodyHtml: textToSimpleHtml(input.bodyText),
    bodyText: input.bodyText,
  });

  // UI-5 export: clears low-confidence-flags column + logs
  // `inbox_draft_discarded`. Idempotent on top of `sendViaGraph`'s
  // own cached-draft clear (belt and braces).
  await invalidateCachedDraft(threadId, "outbound send");

  await logActivity({
    companyId: input.companyId,
    contactId: input.contactId,
    kind: "inbox_message_sent",
    body: `Outbound compose sent (${input.to.length} recipients, ${finalSubject.length}-char subject).`,
    meta: {
      thread_id: threadId,
      message_id: send.messageId,
      graph_message_id: send.graphMessageId,
      to_count: input.to.length,
      cc_count: input.cc?.length ?? 0,
      bcc_count: input.bcc?.length ?? 0,
      subject_source: subjectSource,
    },
    createdBy: input.createdBy,
  });

  if (input.composeDraftId) {
    await db.delete(compose_drafts).where(eq(compose_drafts.id, input.composeDraftId));
  }

  return {
    threadId,
    messageId: send.messageId,
    graphMessageId: send.graphMessageId,
    subject: finalSubject,
    subjectSource,
  };
}

// ── Draft persistence (Option B — explicit Save button only) ─────────

export interface SaveComposeDraftInput {
  /** Existing draft id (update) or null (insert). */
  id?: string | null;
  authorUserId: string;
  threadId: string | null;
  contactId: string | null;
  companyId: string | null;
  sendingAddress: string;
  to: string[] | null;
  cc?: string[] | null;
  bcc?: string[] | null;
  subject: string | null;
  bodyText: string;
}

export async function saveComposeDraftRow(
  input: SaveComposeDraftInput,
): Promise<{ id: string; created: boolean }> {
  const now = Date.now();
  if (input.id) {
    const existing = await db
      .select({ id: compose_drafts.id })
      .from(compose_drafts)
      .where(
        and(
          eq(compose_drafts.id, input.id),
          eq(compose_drafts.author_user_id, input.authorUserId),
        ),
      )
      .get();
    if (existing) {
      await db
        .update(compose_drafts)
        .set({
          thread_id: input.threadId,
          contact_id: input.contactId,
          company_id: input.companyId,
          sending_address: input.sendingAddress,
          to_addresses: input.to,
          cc_addresses: input.cc ?? null,
          bcc_addresses: input.bcc ?? null,
          subject: input.subject,
          body_text: input.bodyText,
          updated_at_ms: now,
        })
        .where(eq(compose_drafts.id, input.id));
      return { id: input.id, created: false };
    }
  }
  const id = input.id ?? randomUUID();
  await db.insert(compose_drafts).values({
    id,
    author_user_id: input.authorUserId,
    thread_id: input.threadId,
    contact_id: input.contactId,
    company_id: input.companyId,
    sending_address: input.sendingAddress,
    to_addresses: input.to,
    cc_addresses: input.cc ?? null,
    bcc_addresses: input.bcc ?? null,
    subject: input.subject,
    body_text: input.bodyText,
    created_at_ms: now,
    updated_at_ms: now,
  });
  return { id, created: true };
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Minimal text → HTML for Graph's `body.contentType = "HTML"`. Wraps
 * the body in a `<div>`, converts newlines to `<br>`, and escapes the
 * four HTML-sensitive characters. Intentionally dumb — Graph renders
 * plain-text bodies fine this way and we don't want to drift into a
 * Markdown/rich-text compose surface in UI-6.
 */
export function textToSimpleHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const withBreaks = escaped.replace(/\r?\n/g, "<br>");
  return `<div>${withBreaks}</div>`;
}
