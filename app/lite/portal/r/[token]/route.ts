/**
 * Magic-link OTT redeem endpoint.
 *
 * GET /lite/portal/r/[token]
 *
 * Exchanges a one-time-use token for a portal session cookie and redirects
 * to the portal root. Invalid / expired / already-consumed tokens redirect
 * to the recovery form with an `error` query param.
 *
 * Cookie attributes: httpOnly, Secure (production), SameSite=Lax, 90-day
 * rolling TTL (from `portal.session_cookie_ttl_days` setting).
 *
 * Owner: A8.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { redeemMagicLink } from "@/lib/portal/redeem-magic-link";
import { buildPortalCookieAttrs } from "@/lib/portal/guard";
import settings from "@/lib/settings";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.redirect(
      new URL("/lite/portal/recover?error=invalid", req.url),
    );
  }

  // Extract client IP for audit trail (header set by Coolify / reverse proxy)
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;

  const result = await redeemMagicLink(token, clientIp);

  if (!result.success) {
    const url = new URL("/lite/portal/recover", req.url);
    url.searchParams.set("error", result.reason);
    return NextResponse.redirect(url);
  }

  // Issue portal session cookie
  const ttlDays = await settings.get("portal.session_cookie_ttl_days");
  const cookieAttrs = buildPortalCookieAttrs(result.contactId, ttlDays);

  const response = NextResponse.redirect(new URL("/lite/portal", req.url));
  response.cookies.set(cookieAttrs.name, cookieAttrs.value, {
    httpOnly: cookieAttrs.httpOnly,
    sameSite: cookieAttrs.sameSite,
    path: cookieAttrs.path,
    maxAge: cookieAttrs.maxAge,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
