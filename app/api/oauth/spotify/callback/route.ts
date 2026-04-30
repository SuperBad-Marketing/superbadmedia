export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { vault } from "@/lib/crypto/vault";
import { SPOTIFY_TOKEN_URL } from "@/lib/integrations/vendors/spotify";
import { getAppUrl } from "@/lib/env/app-url";

const WIZARD_PATH = "/lite/setup/admin/spotify";
const VAULT_CONTEXT = "spotify.credentials";

function getClientId(): string {
  const v = process.env.SPOTIFY_CLIENT_ID;
  if (!v) throw new Error("SPOTIFY_CLIENT_ID env var is not set");
  return v;
}

function getClientSecret(): string {
  const v = process.env.SPOTIFY_CLIENT_SECRET;
  if (!v) throw new Error("SPOTIFY_CLIENT_SECRET env var is not set");
  return v;
}

function getRedirectUri(): string {
  return `${getAppUrl()}/api/oauth/spotify/callback`;
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token: string;
}

async function exchangeCodeForTokens(
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAtMs: number }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
  });

  const basic = Buffer.from(
    `${getClientId()}:${getClientSecret()}`,
  ).toString("base64");

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Spotify token exchange failed: ${res.status} ${text.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as SpotifyTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAtMs: Date.now() + data.expires_in * 1000,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  const appUrl = getAppUrl();
  const redirectUrl = new URL(WIZARD_PATH, appUrl);

  if (error) {
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set("reason", error);
    console.warn(`[spotify oauth] callback error: ${error}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set("reason", "No authorization code received");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const { accessToken, refreshToken, expiresAtMs } =
      await exchangeCodeForTokens(code);

    const encrypted = vault.encrypt(
      JSON.stringify({ accessToken, refreshToken, expiresAtMs }),
      VAULT_CONTEXT,
    );

    redirectUrl.searchParams.set("oauth", "success");
    redirectUrl.searchParams.set("ct", encrypted);
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("[spotify oauth] Token exchange failed:", err);
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set(
      "reason",
      err instanceof Error ? err.message.slice(0, 200) : "Token exchange failed",
    );
    return NextResponse.redirect(redirectUrl);
  }
}
