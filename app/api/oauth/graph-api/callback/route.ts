/**
 * `/api/oauth/graph-api/callback` — Microsoft Graph OAuth2 authorization-
 * code callback endpoint.
 *
 * Upgraded from SW-7-a skeleton to real code→token exchange in UI-1.
 *
 * Flow:
 *   1. Microsoft redirects here with ?code=<auth_code>&state=<csrf_state>.
 *   2. Exchange the code for access + refresh tokens.
 *   3. Set an httpOnly signed cookie `graph_oauth_pending` carrying the
 *      encrypted token payload.
 *   4. Redirect to the wizard; a Server Action `claimGraphOAuthTokenAction`
 *      reads + clears the cookie and seeds `state.consent.token`.
 *
 * Error case: Microsoft redirects with ?error=<code>&error_description=<msg>.
 * We redirect back to the wizard with `oauth=error` params.
 *
 * Owner: SW-7 (skeleton) → UI-1 (real exchange).
 */
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeForTokens, encryptCredentials } from "@/lib/graph";

const WIZARD_PATH = "/lite/setup/critical-flight/graph-api-admin";
const COOKIE_NAME = "graph_oauth_pending";
const COOKIE_MAX_AGE = 300;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const redirectUrl = new URL(WIZARD_PATH, appUrl);

  if (error) {
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set("reason", errorDescription ?? error);
    console.warn(
      `[graph-api oauth] callback error: ${error}${errorDescription ? ` — ${errorDescription}` : ""}`,
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set("reason", "No authorization code received");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const creds = await exchangeCodeForTokens(code);
    const encrypted = encryptCredentials(creds);

    redirectUrl.searchParams.set("oauth", "success");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(COOKIE_NAME, encrypted, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("[graph-api oauth] Token exchange failed:", err);
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set(
      "reason",
      err instanceof Error ? err.message.slice(0, 200) : "Token exchange failed",
    );
    return NextResponse.redirect(redirectUrl);
  }
}
