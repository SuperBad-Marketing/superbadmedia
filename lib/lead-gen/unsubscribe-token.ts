/**
 * HMAC-signed unsubscribe tokens per §12.L.
 *
 * Token payload: { email, contact_id?, issued_at }
 * Format: base64url(JSON payload).base64url(HMAC-SHA256 signature)
 *
 * No expiry — unsubscribe links remain valid indefinitely (legal requirement).
 *
 * Owner: LG-10. Spec: lead-generation.md §12.3.
 */

import { createHmac } from "node:crypto";

export interface UnsubscribePayload {
  email: string;
  contact_id?: string;
  candidate_id?: string;
  issued_at: number;
}

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Missing UNSUBSCRIBE_TOKEN_SECRET or NEXTAUTH_SECRET");
  return secret;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createUnsubscribeToken(payload: UnsubscribePayload): string {
  const secret = getSecret();
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString("base64url");
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifyUnsubscribeToken(
  token: string,
): { valid: true; payload: UnsubscribePayload } | { valid: false; error: string } {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "malformed_token" };
  }

  const [encoded, signature] = parts;
  const secret = getSecret();
  const expected = sign(encoded, secret);

  if (signature !== expected) {
    return { valid: false, error: "invalid_signature" };
  }

  try {
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    const payload = JSON.parse(json) as UnsubscribePayload;
    if (!payload.email || typeof payload.email !== "string") {
      return { valid: false, error: "missing_email" };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: "invalid_payload" };
  }
}

export function createUnsubscribeUrl(payload: UnsubscribePayload): string {
  const token = createUnsubscribeToken(payload);
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/unsubscribe?token=${token}`;
}
