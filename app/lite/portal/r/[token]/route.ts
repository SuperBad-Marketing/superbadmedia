/**
 * Magic-link redemption endpoint.
 *
 * GET /lite/portal/r/[token]
 *
 * Exchanges a one-time token for a portal session cookie and redirects to
 * the originally requested portal URL (or the portal root if unknown).
 *
 * Flow:
 *   1. `redeemMagicLink(token)` — validates TTL + single-use, marks consumed.
 *   2. On success: encode session as base64url, set as httpOnly cookie,
 *      log `portal_session_started`, redirect to portal root.
 *   3. On failure (invalid / expired / already used): redirect to recovery
 *      form with a non-revealing error query param.
 *
 * Cookie TTL: `settings.get('portal.session_cookie_ttl_days')` (default 90 d).
 *
 * Owner: A8.
 */
import { NextRequest, NextResponse } from "next/server";
import { redeemMagicLink } from "@/lib/portal/redeem-magic-link";
import {
  encodePortalSession,
  PORTAL_SESSION_COOKIE,
} from "@/lib/portal/guard";
import { logActivity } from "@/lib/activity-log";
import settings from "@/lib/settings";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || typeof token !== "string") {
    return NextResponse.redirect(
      new URL("/lite/portal/recover?reason=invalid", request.url),
    );
  }

  const session = await redeemMagicLink(token);

  if (!session) {
    return NextResponse.redirect(
      new URL("/lite/portal/recover?reason=expired", request.url),
    );
  }

  const ttlDays = await settings.get("portal.session_cookie_ttl_days");
  const maxAgeSeconds = ttlDays * 24 * 60 * 60;

  const cookieValue = encodePortalSession(session);

  await logActivity({
    contactId: session.contactId,
    kind: "portal_session_started",
    body: "Portal session started via magic link",
    meta: {
      submission_id: session.submissionId,
      client_id: session.clientId,
    },
  });

  // Determine redirect destination — default to portal root
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  const destination =
    callbackUrl && callbackUrl.startsWith("/lite/") ? callbackUrl : "/lite/portal";

  const response = NextResponse.redirect(new URL(destination, request.url));

  response.cookies.set(PORTAL_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  return response;
}
