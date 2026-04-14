/**
 * `/api/oauth/google-ads/callback` — Google OAuth 2.0 authorization-code
 * callback endpoint.
 *
 * **SW-11-a scope (this session):** skeleton only. The real code→token
 * exchange ships in SW-11-b, paired with Andy registering a Google Cloud
 * app (client id + secret + redirect whitelist + consent screen config).
 * Until then, this route mirrors the meta-ads callback pattern:
 *   - accepts the ?code / ?state / ?error params Google returns,
 *   - logs error attempts so incidents don't silently disappear,
 *   - redirects back to the wizard with `oauth=pending` (or `oauth=error`)
 *     so the celebration doesn't fire off a missing token.
 *
 * The Playwright E2E hits the wizard via `?testToken=…` direct injection
 * (gated server-side on NODE_ENV !== "production"), so this route being
 * skeletal does not block the arc smoke.
 *
 * Owner: SW-11 (skeleton) → SW-11-b (hardening).
 */
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const redirect = new URL("/lite/setup/admin/google-ads", url.origin);
  if (error) {
    redirect.searchParams.set("oauth", "error");
    redirect.searchParams.set("reason", errorDescription ?? error);
    console.warn(
      `[google-ads oauth] callback error: ${error}${errorDescription ? ` — ${errorDescription}` : ""}`,
    );
  } else {
    redirect.searchParams.set("oauth", "pending");
  }
  return NextResponse.redirect(redirect);
}
