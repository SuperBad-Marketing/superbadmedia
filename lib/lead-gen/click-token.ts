import { createHmac } from "node:crypto";

export interface ClickPayload {
  send_id: string;
  url: string;
}

function getSecret(): string {
  const secret =
    process.env.OUTREACH_CLICK_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret)
    throw new Error("Missing OUTREACH_CLICK_SECRET or NEXTAUTH_SECRET");
  return secret;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createClickToken(payload: ClickPayload): string {
  const secret = getSecret();
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString("base64url");
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifyClickToken(
  token: string,
): { valid: true; payload: ClickPayload } | { valid: false } {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false };

  const [encoded, signature] = parts;
  const secret = getSecret();
  const expected = sign(encoded!, secret);

  if (signature !== expected) return { valid: false };

  try {
    const json = Buffer.from(encoded!, "base64url").toString("utf-8");
    const payload = JSON.parse(json) as ClickPayload;
    if (!payload.send_id || !payload.url) return { valid: false };
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export function wrapOutreachLink(sendId: string, targetUrl: string): string {
  const token = createClickToken({ send_id: sendId, url: targetUrl });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${base}/api/outreach/click?t=${encodeURIComponent(token)}`;
}
