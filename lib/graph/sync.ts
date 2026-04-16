import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema/messages";
import { graph_api_state } from "@/lib/db/schema/graph-api-state";
import { killSwitches } from "@/lib/kill-switches";
import type { GraphClient } from "./client";
import { GraphDeltaResponseSchema, GraphMessageSchema } from "./types";
import { normalizeGraphMessage } from "./normalize";
import { resolveThread, updateThreadTimestamps } from "./thread";

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
