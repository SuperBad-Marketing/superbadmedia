/**
 * Portal session guard.
 *
 * Portal sessions (prospects + clients) are separate from the admin
 * NextAuth session. They are lightweight JSON payloads stored in a
 * signed, httpOnly session cookie set by the magic-link redeem endpoint.
 *
 * Exported functions:
 *   - `getPortalSession()`   — reads + decodes the session cookie.
 *                              Returns null if absent or malformed.
 *   - `encodePortalSession()`— encode a session payload to a cookie value.
 *   - `decodePortalSession()`— decode a cookie value to a session payload.
 *
 * `getPortalSession` uses `next/headers` (Server Component / Route Handler
 * context). For unit tests, call `decodePortalSession` directly.
 *
 * Cookie TTL: `settings.get('portal.session_cookie_ttl_days')` (default 90 d).
 * The cookie is httpOnly + Secure + SameSite=Lax. It is NOT encrypted beyond
 * base64 encoding — do not store sensitive data beyond the contact/client id.
 * A future session adds signing (e.g. iron-session / JWT). PATCHES_OWED:
 * `a8_portal_cookie_unsigned`.
 *
 * Owner: A8.
 */
import { cookies } from "next/headers";

export const PORTAL_SESSION_COOKIE = "sbl_portal_session";

export type PortalSession = {
  contactId: string;
  clientId: string | null;
  submissionId: string | null;
};

/**
 * Encode a PortalSession to the base64url string stored in the cookie.
 * Exported for use in the redeem endpoint and tests.
 */
export function encodePortalSession(session: PortalSession): string {
  return Buffer.from(JSON.stringify(session)).toString("base64url");
}

/**
 * Decode the raw cookie value back to a PortalSession.
 * Returns null if the value is missing, not valid JSON, or lacks `contactId`.
 */
export function decodePortalSession(raw: string): PortalSession | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf-8"),
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
