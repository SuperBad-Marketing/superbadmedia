import type { GraphMessage } from "./types";
import type { MessageInsert } from "@/lib/db/schema/messages";
import { randomUUID } from "node:crypto";

function extractHeader(
  headers: { name: string; value: string }[],
  headerName: string,
): string | null {
  const h = headers.find(
    (h) => h.name.toLowerCase() === headerName.toLowerCase(),
  );
  return h?.value ?? null;
}

function toAddressList(
  recipients: { emailAddress: { name?: string; address: string } }[],
): string[] {
  return recipients.map((r) => r.emailAddress.address);
}

function headersToJson(
  headers: { name: string; value: string }[],
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const h of headers) {
    obj[h.name] = h.value;
  }
  return obj;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type NormalizedMessage = Omit<MessageInsert, "thread_id"> & {
  internetMessageId: string | null;
  inReplyTo: string | null;
  referencesHeader: string | null;
};

export function normalizeGraphMessage(
  gm: GraphMessage,
  direction: "inbound" | "outbound",
  sendingAddress: string | null,
): NormalizedMessage {
  const now = Date.now();
  const headers = gm.internetMessageHeaders ?? [];

  const bodyText =
    gm.body.contentType === "html" ? stripHtml(gm.body.content) : gm.body.content;

  const sentAtMs = gm.sentDateTime
    ? new Date(gm.sentDateTime).getTime()
    : now;
  const receivedAtMs = gm.receivedDateTime
    ? new Date(gm.receivedDateTime).getTime()
    : now;

  const internetMessageId =
    gm.internetMessageId ?? extractHeader(headers, "Message-ID");
  const inReplyTo = extractHeader(headers, "In-Reply-To");
  const referencesHeader = extractHeader(headers, "References");

  return {
    id: randomUUID(),
    direction,
    channel: "email",
    from_address: gm.from?.emailAddress?.address ?? sendingAddress ?? "",
    to_addresses: toAddressList(gm.toRecipients),
    cc_addresses: toAddressList(gm.ccRecipients),
    bcc_addresses: toAddressList(gm.bccRecipients),
    subject: gm.subject ?? null,
    body_text: bodyText,
    body_html: gm.body.contentType === "html" ? gm.body.content : null,
    headers: headersToJson(headers),
    message_id_header: internetMessageId,
    in_reply_to_header: inReplyTo,
    references_header: referencesHeader,
    sent_at_ms: sentAtMs,
    received_at_ms: receivedAtMs,
    priority_class: "signal",
    noise_subclass: null,
    notification_priority: null,
    router_classification: null,
    router_reason: null,
    is_engaged: false,
    engagement_signals: null,
    import_source: "live",
    has_attachments: gm.hasAttachments,
    has_calendar_invite: false,
    graph_message_id: gm.id,
    created_at_ms: now,
    updated_at_ms: now,
    internetMessageId,
    inReplyTo,
    referencesHeader,
  };
}
