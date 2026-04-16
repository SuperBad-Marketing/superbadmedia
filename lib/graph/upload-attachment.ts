/**
 * Graph API attachment upload — small-attachment path only (≤3 MB).
 *
 * Microsoft Graph splits attachment upload into two regimes:
 *  - `POST /me/messages/{id}/attachments` with the file base64-encoded
 *    inline in the request body. Caps at ~3 MB per Graph API docs.
 *  - A multi-chunk upload session for larger files via
 *    `POST /me/messages/{id}/attachments/createUploadSession`.
 *
 * UI-10 ships the small-attachment path only — it covers the overwhelming
 * majority of support-ticket attachments (screenshots, PDFs). Larger
 * attachments surface an error toast via the caller ("That file didn't
 * want to go — try again or drop a different one") and are deferred.
 * Large-file support is tracked in PATCHES_OWED (`ui_10_large_attachment_upload_owed`).
 *
 * Gated by `inbox_sync_enabled` — no attach happens when the kill switch
 * is off. Never accepts files that would violate the <=3 MB cap: caller
 * must validate before calling (mirrors the client-side drop zone).
 */
import type { GraphClient } from "./client";
import { killSwitches } from "@/lib/kill-switches";

const SMALL_ATTACHMENT_CAP_BYTES = 3 * 1024 * 1024;

export interface UploadAttachmentInput {
  /** Graph message or draft id the attachment is being added to. */
  graphMessageId: string;
  /** `me` for andy@ drafts; for support@ pass the user principal. */
  mailboxUser?: string;
  name: string;
  contentType: string;
  contentBytes: Buffer | Uint8Array;
}

export interface UploadAttachmentResult {
  attachmentId: string;
  name: string;
  contentType: string;
  size: number;
}

export class AttachmentTooLargeError extends Error {
  constructor(sizeBytes: number) {
    super(
      `Attachment is ${sizeBytes} bytes — exceeds the ${SMALL_ATTACHMENT_CAP_BYTES}-byte small-attachment cap.`,
    );
    this.name = "AttachmentTooLargeError";
  }
}

export async function uploadAttachment(
  client: GraphClient,
  input: UploadAttachmentInput,
): Promise<UploadAttachmentResult> {
  if (!killSwitches.inbox_sync_enabled) {
    throw new Error(
      "Graph API calls are disabled (inbox_sync_enabled = false)",
    );
  }

  const bytes =
    input.contentBytes instanceof Buffer
      ? input.contentBytes
      : Buffer.from(input.contentBytes);

  if (bytes.byteLength > SMALL_ATTACHMENT_CAP_BYTES) {
    throw new AttachmentTooLargeError(bytes.byteLength);
  }

  const path = input.mailboxUser
    ? `/users/${input.mailboxUser}/messages/${input.graphMessageId}/attachments`
    : `/me/messages/${input.graphMessageId}/attachments`;

  const body = JSON.stringify({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: input.name,
    contentType: input.contentType,
    contentBytes: bytes.toString("base64"),
  });

  const res = await client.fetch(path, { method: "POST", body });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Graph attachment upload failed: ${res.status} ${text.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as {
    id: string;
    name: string;
    contentType: string;
    size: number;
  };
  return {
    attachmentId: json.id,
    name: json.name,
    contentType: json.contentType,
    size: json.size,
  };
}

export { SMALL_ATTACHMENT_CAP_BYTES };
