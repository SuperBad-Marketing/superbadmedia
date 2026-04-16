import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, threads } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { graph_api_state } from "@/lib/db/schema/graph-api-state";
import { killSwitches } from "@/lib/kill-switches";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import type { GraphClient } from "./client";
import { GraphDeltaResponseSchema, GraphMessageSchema } from "./types";
import { normalizeGraphMessage } from "./normalize";
import { resolveThread, updateThreadTimestamps } from "./thread";
import { classifyAndRouteInbound, type RouterResult } from "./router";
import { classifyNotificationPriority } from "./notifier";
import { classifySignalNoise, type SignalNoiseResult } from "./signal-noise";

// Debounce window: coalesce multiple inbound messages on the same
// thread into a single draft-generate run if they arrive within 60s.
// Spec §6.2 + brief §A.7.
const DRAFT_DEBOUNCE_MS = 60 * 1000;

// Relationship types that warrant a cached reply draft (spec §7.4,
// brief §A.3). Supplier / personal / null relationships skip generation.
const DRAFTABLE_RELATIONSHIPS = new Set(["client", "past_client", "lead"]);

const MESSAGES_DELTA_URL =
  "/me/mailFolders('Inbox')/messages/delta?$select=id,internetMessageId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,internetMessageHeaders,hasAttachments,isRead,isDraft,conversationId";
const SENT_ITEMS_URL =
  "/me/mailFolders('SentItems')/messages?$select=id,internetMessageId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,internetMessageHeaders,hasAttachments,isRead,isDraft,conversationId&$top=50&$orderby=sentDateTime desc";

async function isMessageDuplicate(graphMessageId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.graph_message_id, graphMessageId))
    .limit(1);
  return !!existing;
}

function detectSendingAddress(
  fromAddress: string,
): string | null {
  const lower = fromAddress.toLowerCase();
  if (lower.includes("support@")) return "support@";
  if (lower.includes("andy@")) return "andy@";
  return null;
}

function isOutbound(fromAddress: string): boolean {
  const lower = fromAddress.toLowerCase();
  return (
    lower.includes("andy@superbadmedia.com.au") ||
    lower.includes("support@superbadmedia.com.au")
  );
}

export type SyncResult = {
  inserted: number;
  skipped: number;
  errors: number;
  newDeltaToken: string | null;
};

export async function runDeltaSync(
  client: GraphClient,
  stateId: string,
): Promise<SyncResult> {
  if (!killSwitches.inbox_sync_enabled) {
    return { inserted: 0, skipped: 0, errors: 0, newDeltaToken: null };
  }

  const [state] = await db
    .select()
    .from(graph_api_state)
    .where(eq(graph_api_state.id, stateId))
    .limit(1);
  if (!state) throw new Error(`No graph_api_state row: ${stateId}`);

  let url = state.last_delta_token ?? MESSAGES_DELTA_URL;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let newDeltaToken: string | null = null;

  let pages = 0;
  const MAX_PAGES = 100;

  while (url && pages < MAX_PAGES) {
    pages++;
    const raw = await client.fetchJson<unknown>(url);
    const delta = GraphDeltaResponseSchema.parse(raw);

    for (const gm of delta.value) {
      if (gm.isDraft) {
        skipped++;
        continue;
      }

      try {
        if (await isMessageDuplicate(gm.id)) {
          skipped++;
          continue;
        }

        const direction = isOutbound(gm.from?.emailAddress?.address ?? "")
          ? "outbound"
          : "inbound";
        const sendingAddress = detectSendingAddress(
          gm.from?.emailAddress?.address ?? "",
        );

        const normalized = normalizeGraphMessage(gm, direction, sendingAddress);
        const threadId = await resolveThread(normalized, sendingAddress);

        await db.insert(messages).values({
          ...normalized,
          thread_id: threadId,
          internetMessageId: undefined,
          inReplyTo: undefined,
          referencesHeader: undefined,
        } as typeof messages.$inferInsert);

        await updateThreadTimestamps(
          threadId,
          direction,
          normalized.received_at_ms ?? Date.now(),
        );

        // Run the inbound classifiers in parallel per discipline #52
        // (spec §§7.1 router + 7.2 notifier + 7.3 signal/noise). Each
        // is non-fatal — classifier failure never blocks message insert.
        if (direction === "inbound") {
          const results = await Promise.allSettled([
            classifyAndRouteInbound(normalized, normalized.id, threadId),
            classifyNotificationPriority(normalized, normalized.id, threadId),
            classifySignalNoise(normalized, normalized.id, threadId),
          ]);
          const labels = ["router", "notifier", "signal_noise"] as const;
          for (const [idx, result] of results.entries()) {
            if (result.status === "rejected") {
              console.error(
                `[graph-sync] ${labels[idx]} failed for ${gm.id}:`,
                result.reason,
              );
            }
          }

          const routerResult =
            results[0].status === "fulfilled"
              ? (results[0].value as RouterResult)
              : null;
          const signalNoiseResult =
            results[2].status === "fulfilled"
              ? (results[2].value as SignalNoiseResult)
              : null;
          await maybeEnqueueDraftGeneration(
            threadId,
            routerResult,
            signalNoiseResult,
          );
        }

        inserted++;
      } catch (err) {
        console.error(`[graph-sync] Failed to process message ${gm.id}:`, err);
        errors++;
      }
    }

    if (delta["@odata.deltaLink"]) {
      newDeltaToken = delta["@odata.deltaLink"];
      url = "";
    } else if (delta["@odata.nextLink"]) {
      url = delta["@odata.nextLink"];
    } else {
      url = "";
    }
  }

  if (newDeltaToken) {
    await db
      .update(graph_api_state)
      .set({
        last_delta_token: newDeltaToken,
        last_full_sync_at_ms: Date.now(),
        updated_at_ms: Date.now(),
      })
      .where(eq(graph_api_state.id, stateId));
  }

  return { inserted, skipped, errors, newDeltaToken };
}

export async function syncSentItems(
  client: GraphClient,
): Promise<{ inserted: number; skipped: number }> {
  if (!killSwitches.inbox_sync_enabled) {
    return { inserted: 0, skipped: 0 };
  }

  const raw = await client.fetchJson<{ value: unknown[] }>(SENT_ITEMS_URL);
  let inserted = 0;
  let skipped = 0;

  for (const item of raw.value) {
    const parsed = GraphMessageSchema.safeParse(item);
    if (!parsed.success) {
      skipped++;
      continue;
    }
    const gm = parsed.data;
    if (await isMessageDuplicate(gm.id)) {
      skipped++;
      continue;
    }

    const sendingAddress = detectSendingAddress(
      gm.from?.emailAddress?.address ?? "",
    );
    const normalized = normalizeGraphMessage(gm, "outbound", sendingAddress);
    const threadId = await resolveThread(normalized, sendingAddress);

    await db.insert(messages).values({
      ...normalized,
      thread_id: threadId,
      internetMessageId: undefined,
      inReplyTo: undefined,
      referencesHeader: undefined,
    } as typeof messages.$inferInsert);

    await updateThreadTimestamps(
      threadId,
      "outbound",
      normalized.sent_at_ms ?? Date.now(),
    );
    inserted++;
  }

  return { inserted, skipped };
}

/**
 * Decide whether the inbound message just inserted warrants an
 * Opus-drafted cached reply, and if so:
 *   1. Mark the thread's existing cached draft stale so the UI shows
 *      a "refreshing…" state instead of an out-of-date draft.
 *   2. Enqueue `inbox_draft_generate` with a 60s debounce via an
 *      idempotency key keyed to the 60s run-time bucket, so a burst
 *      of inbounds on the same thread produces one draft run.
 *
 * Gates (brief §A.3):
 *  - kill switches `inbox_sync_enabled` + `llm_calls_enabled` both on
 *  - router classification != 'spam'
 *  - signal/noise priority_class != 'spam'
 *  - contact relationship_type ∈ {client, past_client, lead}
 *
 * Either classifier may be null (rejected), in which case we apply the
 * spam check to whichever side survived and proceed if the other gate
 * passes — a missing side shouldn't wedge drafting for real clients.
 */
export async function maybeEnqueueDraftGeneration(
  threadId: string,
  routerResult: RouterResult | null,
  signalNoiseResult: SignalNoiseResult | null,
): Promise<boolean> {
  if (!killSwitches.inbox_sync_enabled || !killSwitches.llm_calls_enabled) {
    return false;
  }
  if (routerResult?.classification === "spam") return false;
  if (signalNoiseResult?.priority_class === "spam") return false;

  const contactId = routerResult?.contactId ?? (await lookupThreadContactId(threadId));
  if (!contactId) return false;

  const contact = await db
    .select({ relationship_type: contacts.relationship_type })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();
  const relationship = contact?.relationship_type ?? null;
  if (!relationship || !DRAFTABLE_RELATIONSHIPS.has(relationship)) {
    return false;
  }

  // Stale-flag the existing cached draft immediately so the UI can
  // render a "refreshing…" indicator until the new one lands. Doing it
  // before the enqueue guarantees invalidation even if enqueue throws.
  const nowMs = Date.now();
  await db
    .update(threads)
    .set({ cached_draft_stale: true, updated_at_ms: nowMs })
    .where(eq(threads.id, threadId));

  const runAtMs = nowMs + DRAFT_DEBOUNCE_MS;
  const bucket = Math.floor(runAtMs / DRAFT_DEBOUNCE_MS);
  const idempotencyKey = `inbox-draft-generate:${threadId}:${bucket}`;
  await enqueueTask({
    task_type: "inbox_draft_generate",
    runAt: runAtMs,
    payload: { thread_id: threadId },
    idempotencyKey,
  });
  return true;
}

async function lookupThreadContactId(
  threadId: string,
): Promise<string | null> {
  const row = await db
    .select({ contact_id: threads.contact_id })
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();
  return row?.contact_id ?? null;
}
