import type { AttachmentUploadFile } from "./attachment-upload";

/**
 * Client-side file → base64 encoder. Server actions can't receive `File`
 * objects directly — they're postMessage-shaped and lose their bytes at
 * the RSC boundary. We base64-encode each file inline and pass through
 * the `attachments` field on `sendCompose` / `closeTicketAction`.
 *
 * Cap per file is 3 MB (matches `lib/graph/upload-attachment.ts`
 * `SMALL_ATTACHMENT_CAP_BYTES`). Oversized files are rejected at the
 * drop-zone; this helper is defensive — it will throw on the same cap
 * so a late-bypass can't land on the Graph API.
 */

export interface EncodedAttachment {
  name: string;
  contentType: string;
  contentBase64: string;
  sizeBytes: number;
}

const MAX_BYTES = 3 * 1024 * 1024;

export async function encodeAttachmentsForUpload(
  files: AttachmentUploadFile[],
): Promise<EncodedAttachment[]> {
  const out: EncodedAttachment[] = [];
  for (const entry of files) {
    const f = entry.file;
    if (f.size > MAX_BYTES) {
      throw new Error(
        "That file didn't want to go. Try again or drop a different one.",
      );
    }
    const buf = await f.arrayBuffer();
    const base64 = bytesToBase64(new Uint8Array(buf));
    out.push({
      name: f.name,
      contentType: f.type || "application/octet-stream",
      contentBase64: base64,
      sizeBytes: f.size,
    });
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
}
