export const dynamic = "force-dynamic";

/**
 * `/api/oauth/meta/callback` — Meta OAuth 2.0 authorization-code callback.
 *
 * Renamed from `/api/oauth/meta-ads/callback`. Same flow:
 *   1. Meta redirects here with ?code=<auth_code>&state=<csrf_state>.
 *   2. Exchange the code for a short-lived access token.
 *   3. Exchange the short-lived token for a long-lived token (~60 days).
 *   4. Encrypt and redirect to the wizard with `?oauth=success&ct=<encrypted>`.
 *
 * Owner: SW-10. Extended by Instagram channel session.
 */
import { NextResponse, type NextRequest } from "next/server";
import { vault } from "@/lib/crypto/vault";
import { META_GRAPH_API_VERSION } from "@/lib/integrations/vendors/meta";
import { getAppUrl } from "@/lib/env/app-url";

const WIZARD_PATH = "/lite/setup/admin/meta";
const VAULT_CONTEXT = "meta.credentials";

function getClientId(): string {
  const v = process.env.META_ADS_CLIENT_ID;
  if (!v) throw new Error("META_ADS_CLIENT_ID env var is not set");
  return v;
}

function getClientSecret(): string {
  const v = process.env.META_ADS_CLIENT_SECRET;
  if (!v) throw new Error("META_ADS_CLIENT_SECRET env var is not set");
  return v;
}

function getRedirectUri(): string {
  return `${getAppUrl()}/api/oauth/meta/callback`;
}

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: getRedirectUri(),
    code,
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token?${params.toString()}`,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as MetaTokenResponse;
  return data.access_token;
}

async function exchangeForLongLived(shortLivedToken: string): Promise<{ accessToken: string; expiresAtMs: number }> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: getClientId(),
    client_secret: getClientSecret(),
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token?${params.toString()}`,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Long-lived token exchange failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as MetaTokenResponse;
  return {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + (data.expires_in ?? 5184000) * 1000,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");

  const appUrl = getAppUrl();
  const redirectUrl = new URL(WIZARD_PATH, appUrl);

  if (error) {
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set("reason", errorDescription ?? error);
    console.warn(
      `[meta oauth] callback error: ${error}${errorDescription ? ` — ${errorDescription}` : ""}`,
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set("reason", "No authorization code received");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const shortLived = await exchangeCodeForToken(code);
    const { accessToken, expiresAtMs } = await exchangeForLongLived(shortLived);

    const encrypted = vault.encrypt(
      JSON.stringify({ accessToken, expiresAtMs }),
      VAULT_CONTEXT,
    );

    redirectUrl.searchParams.set("oauth", "success");
    redirectUrl.searchParams.set("ct", encrypted);
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("[meta oauth] Token exchange failed:", err);
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set(
      "reason",
      err instanceof Error ? err.message.slice(0, 200) : "Token exchange failed",
    );
    return NextResponse.redirect(redirectUrl);
  }
}
