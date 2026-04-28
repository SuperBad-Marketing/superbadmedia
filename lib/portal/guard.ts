/**
 * Portal session guard.
 *
 * Portal sessions (prospects + clients) are separate from the admin
 * NextAuth session. They are lightweight JSON payloads stored in an
 * HMAC-SHA256-signed, httpOnly session cookie set by the magic-link
 * redeem endpoint.
 *
 * Cookie format: `{base64url_payload}.{hex_hmac_signature}`
 *
 * Exported functions:
 *   - `getPortalSession()`   — reads + decodes the session cookie.
 *                              Returns null if absent, malformed, or
 *                              signature invalid.
 *   - `encodePortalSession()`— encode + sign a session payload to a
 *                              cookie value.
 *   - `decodePortalSession()`— verify signature + decode a cookie value
 *                              to a session payload.
 *
 * `getPortalSession` uses `next/headers` (Server Component / Route Handler
 * context). For unit tests, call `decodePortalSession` directly.
 *
 * Cookie TTL: `settings.get('portal.session_cookie_ttl_days')` (default 90 d).
 * The cookie is httpOnly + Secure + SameSite=Lax. It is NOT encrypted —
 * do not store sensitive data beyond the contact/client id.
 *
 * Owner: A8.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const PORTAL_SESSION_COOKIE = "sbl_portal_session";

export type PortalSession = {
  contactId: string;
  clientId: string | null;
  submissionId: string | null;
};

const DEV_FALLBACK_SECRET = "dev-portal-session-secret-not-for-production";
let devWarningLogged = false;

function getSigningSecret(): string {
  const secret =
    process.env.PORTAL_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PORTAL_SESSION_SECRET or NEXTAUTH_SECRET must be set in production",
    );
  }

  if (!devWarningLogged) {
    console.error(
      "Portal session: no PORTAL_SESSION_SECRET or NEXTAUTH_SECRET set — using insecure dev fallback",
    );
    devWarningLogged = true;
  }
  return DEV_FALLBACK_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
}

/**
 * Encode a PortalSession to the signed cookie value.
 * Exported for use in the redeem endpoint and tests.
 */
export function encodePortalSession(session: PortalSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/**
 * Decode the raw cookie value back to a PortalSession.
 * Returns null if the value is missing, the HMAC signature is invalid,
 * the JSON is malformed, or `contactId` is absent.
 */
export function decodePortalSession(raw: string): PortalSession | null {
  try {
    const dotIndex = raw.lastIndexOf(".");
    if (dotIndex === -1) return null;

    const payload = raw.slice(0, dotIndex);
    const signature = raw.slice(dotIndex + 1);
    if (!payload || !signature) return null;

    const expected = sign(payload);
    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8"),
    ) as Partial<PortalSession>;
    if (!parsed?.contactId || typeof parsed.contactId !== "string") {
      return null;
    }
    return {
      contactId: parsed.contactId,
      clientId: parsed.clientId ?? null,
      submissionId: parsed.submissionId ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Read the portal session from the request cookie store.
 * Server Component / Route Handler context only (uses `next/headers`).
 * Returns null when the cookie is absent or the payload is malformed —
 * callers should redirect to `/lite/portal/recover`.
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodePortalSession(raw);
}
