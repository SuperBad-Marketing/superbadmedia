/**
 * `/api/oauth/graph-api/callback` — Microsoft Graph OAuth2 authorization-
 * code callback endpoint.
 *
 * **SW-7-a scope (this session):** skeleton only. The real code→token
 * exchange + signed-cookie handoff to the client ships in SW-7-b, which
 * pairs with Andy registering an Azure app (client id + tenant + redirect
 * whitelist). Until then, this route:
 *   - accepts the ?code / ?state / ?error params that Microsoft returns,
 *   - logs the attempt (so incidents don't silently disappear),
 *   - redirects the admin back to the wizard with a friendly, branded
 *     `oauth=pending` note so the celebration doesn't fire off a missing
 *     token. The graph-api-admin client treats a missing token as "not
 *     authorised yet" — the admin can try again, or use the E2E test-token
 *     path in dev.
 *
 * The Playwright E2E exercises the wizard via `?testToken=…` direct
 * injection (gated on NODE_ENV !== "production" by the server page), so
 * this route being skeletal does not block the critical-flight arc smoke.
 *
 * SW-7-b turns this into a real exchange:
 *   1. Validate `state` against a pre-navigation cookie (CSRF).
 *   2. POST to `https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token`
 *      with code + client_id + client_secret + redirect_uri + grant_type.
 *   3. Set an httpOnly signed cookie `graph_oauth_pending` carrying the
 *      access_token + expiry.
 *   4. Redirect to the wizard; a Server Action `claimGraphOAuthTokenAction`
 *      reads + clears the cookie and seeds `state.consent.token`.
 *
 * Owner: SW-7 (skeleton) → SW-7-b (hardening).
 */
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // Hand back to the wizard. SW-7-b swaps this for a real exchange + token
  // handoff. Until then, always land on the wizard page; the client treats
  // a missing token as "not authorised".
  const redirect = new URL(
    "/lite/setup/critical-flight/graph-api-admin",
    url.origin,
  );
  if (error) {
    redirect.searchParams.set("oauth", "error");
    redirect.searchParams.set(
      "reason",
      errorDescription ?? error,
    );
    console.warn(
      `[graph-api oauth] callback error: ${error}${errorDescription ? ` — ${errorDescription}` : ""}`,
    );
  } else {
    redirect.searchParams.set("oauth", "pending");
  }
  return NextResponse.redirect(redirect);
}
