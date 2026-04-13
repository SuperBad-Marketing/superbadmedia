/**
 * Portal session guard — client-portal authentication primitive.
 *
 * The client portal uses a separate, simpler auth mechanism from the admin
 * surface (NextAuth). Clients authenticate via magic-link OTT only. After a
 * successful redeem, an HMAC-signed session cookie is issued and checked on
 * every portal request.
 *
 * Cookie: `sbp_session` — httpOnly, Secure, SameSite=Lax, 90-day rolling TTL
 * (TTL from settings key `portal.session_cookie_ttl_days`).
 *
 * The signing key is `NEXTAUTH_SECRET` (same secret used for admin JWT). If
 * that env var is absent the cookie cannot be verified and access is denied.
 *
 * Owner: A8. Consumers: every `/lite/portal/*` route layout.
 *
 * @module
 */
import crypto from "node:crypto";

export const PORTAL_COOKIE_NAME = "sbp_session";

/**
 * Build a signed portal session cookie value.
 *
 * @param contactId - The authenticated contact's ID.
 * @param secret    - HMAC signing secret (defaults to `NEXTAUTH_SECRET`).
 * @returns Signed string `${contactId}.${hmac-hex}`
 */
export function buildPortalCookieValue(
  contactId: string,
  secret?: string,
): string {
  const key = secret ?? process.env.NEXTAUTH_SECRET ?? "";
  const hmac = crypto.createHmac("sha256", key);
  hmac.update(contactId);
  return `${contactId}.${hmac.digest("hex")}`;
}

/**
 * Verify a portal session cookie value.
 *
 * Uses `timingSafeEqual` to prevent timing attacks.
 *
 * @param value  - The raw cookie value string.
 * @param secret - HMAC signing secret (defaults to `NEXTAUTH_SECRET`).
 * @returns The `contactId` if the signature is valid, `null` otherwise.
 */
export function verifyPortalCookieValue(
  value: string | undefined,
  secret?: string,
): string | null {
  if (!value) return null;
  const lastDot = value.lastIndexOf(".");
  if (lastDot === -1) return null;

  const contactId = value.slice(0, lastDot);
  const sig = value.slice(lastDot + 1);
  if (!contactId || !sig) return null;

  const key = secret ?? process.env.NEXTAUTH_SECRET ?? "";
  const expected = crypto
    .createHmac("sha256", key)
    .update(contactId)
    .digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(sig, "hex");
    if (expectedBuf.length !== actualBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;
    return contactId;
  } catch {
    return null;
  }
}

export type PortalGuardResult =
  | { allowed: true; contactId: string }
  | { allowed: false; contactId?: never };

/**
 * Check whether a portal session cookie grants access.
 *
 * Call this at the top of any portal route that requires authentication.
 * If `allowed` is false, redirect to `/lite/portal/recover`.
 *
 * @param cookieValue - The raw value of the `sbp_session` cookie (or
 *                      `undefined` if absent).
 * @param secret      - Optional override for the HMAC key (used by tests).
 */
export function checkPortalGuard(
  cookieValue: string | undefined,
  secret?: string,
): PortalGuardResult {
  const contactId = verifyPortalCookieValue(cookieValue, secret);
  if (!contactId) return { allowed: false };
  return { allowed: true, contactId };
}

/**
 * Build the Set-Cookie header attributes for a new portal session.
 *
 * @param contactId - The authenticated contact's ID.
 * @param ttlDays   - Cookie max-age in days (from `portal.session_cookie_ttl_days`).
 * @param secret    - Optional override for the HMAC key.
 */
export function buildPortalCookieAttrs(
  contactId: string,
  ttlDays: number,
  secret?: string,
): {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    name: PORTAL_COOKIE_NAME,
    value: buildPortalCookieValue(contactId, secret),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ttlDays * 24 * 60 * 60,
  };
}
