import { db } from "@/lib/db";
import { messages, threads } from "@/lib/db/schema/messages";
import { killSwitches } from "@/lib/kill-switches";
import type { GraphClient } from "./client";
import { updateThreadTimestamps } from "./thread";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

export interface SendViaGraphAttachment {
  name: string;
  contentType: string;
  /** Base-64 encoded file body. Small-attachment path only (≤3 MB each). */
  contentBase64: string;
  /** Decoded size in bytes — callers report this when validating. */
  sizeBytes: number;
}

export type SendViaGraphInput = {
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  attachments?: SendViaGraphAttachment[];
};

export type SendViaGraphResult = {
  messageId: string;
  graphMessageId: string | null;
};

export async function sendViaGraph(
  client: GraphClient,
  input: SendViaGraphInput,
): Promise<SendViaGraphResult> {
  if (!killSwitches.inbox_sync_enabled) {
    throw new Error("Graph API calls are disabled (inbox_sync_enabled = false)");
  }

  const toRecipients = input.to.map((addr) => ({
    emailAddress: { address: addr },
  }));
  const ccRecipients = (input.cc ?? []).map((addr) => ({
    emailAddress: { address: addr },
  }));
  const bccRecipients = (input.bcc ?? []).map((addr) => ({
    emailAddress: { address: addr },
  }));

  const sendPath = input.from.toLowerCase().includes("support@")
    ? `/users/${input.from}/sendMail`
    : "/me/sendMail";

  const graphAttachments = (input.attachments ?? []).map((a) => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: a.name,
    contentType: a.contentType,
    contentBytes: a.contentBase64,
  }));

  const res = await client.fetch(sendPath, {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: { contentType: "HTML", content: input.bodyHtml },
        toRecipients,
        ccRecipients,
        bccRecipients,
        ...(graphAttachments.length > 0
          ? { attachments: graphAttachments }
          : {}),
      },
      saveToSentItems: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph sendMail failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const now = Date.now();
  const messageId = randomUUID();

  await db.insert(messages).values({
    id: messageId,
    thread_id: input.threadId,
    direction: "outbound",
    channel: "email",
    from_address: input.from,
    to_addresses: input.to,
    cc_addresses: input.cc ?? [],
    bcc_addresses: input.bcc ?? [],
    subject: input.subject,
    body_text: input.bodyText,
    body_html: input.bodyHtml,
    headers: {},
    message_id_header: null,
    in_reply_to_header: null,
    references_header: null,
    sent_at_ms: now,
    received_at_ms: now,
    priority_class: "signal",
    noise_subclass: null,
    notification_priority: null,
    router_classification: null,
    router_reason: null,
    is_engaged: true,
    engagement_signals: [{ type: "sent", at: now }],
    import_source: "live",
    has_attachments: (input.attachments?.length ?? 0) > 0,
    has_calendar_invite: false,
    graph_message_id: null,
    created_at_ms: now,
    updated_at_ms: now,
  });

  await updateThreadTimestamps(input.threadId, "outbound", now);

  await db
    .update(threads)
    .set({
      has_cached_draft: false,
      cached_draft_body: null,
      cached_draft_stale: false,
      updated_at_ms: now,
    })
    .where(eq(threads.id, input.threadId));

  return { messageId, graphMessageId: null };
}
