/**
 * `/api/oauth/meta-ads/callback` — Meta OAuth 2.0 authorization-code
 * callback endpoint.
 *
 * **SW-10-a scope (this session):** skeleton only. The real code→token
 * exchange + signed-cookie handoff ships in SW-10-b, paired with Andy
 * registering a Meta app (app id + secret + redirect whitelist). Until
 * then, this route mirrors the graph-api callback pattern:
 *   - accepts the ?code / ?state / ?error params Meta returns,
 *   - logs error attempts so incidents don't silently disappear,
 *   - redirects back to the wizard with `oauth=pending` (or `oauth=error`)
 *     so the celebration doesn't fire off a missing token.
 *
 * The Playwright E2E hits the wizard via `?testToken=…` direct injection
 * (gated server-side on NODE_ENV !== "production"), so this route being
 * skeletal does not block the arc smoke.
 *
 * SW-10-b turns this into a real exchange (see graph-api/callback for
 * the shape).
 *
 * Owner: SW-10 (skeleton) → SW-10-b (hardening).
 */
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const redirect = new URL("/lite/setup/admin/meta-ads", url.origin);
  if (error) {
    redirect.searchParams.set("oauth", "error");
    redirect.searchParams.set("reason", errorDescription ?? error);
    console.warn(
      `[meta-ads oauth] callback error: ${error}${errorDescription ? ` — ${errorDescription}` : ""}`,
    );
  } else {
    redirect.searchParams.set("oauth", "pending");
  }
  return NextResponse.redirect(redirect);
}
