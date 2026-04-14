/**
 * `google-ads` vendor manifest — third non-critical admin integration (SW-11).
 *
 * Google Ads runs over Google's OAuth 2.0 flow + the Google Ads API (REST /
 * gRPC). This manifest mirrors `meta-ads` in shape: narrow initial job set
 * (identity ping + campaigns read) sized to what the wizard exercises; feature
 * sessions extend via band-additions, not manifest rewrites.
 *
 * Kill-switch shares `setup_wizards_enabled` with the rest of the wizard
 * family — nothing Google-specific to disable independently.
 *
 * **Developer-token quirk (SW-11 brief §9).** Google Ads API calls (not the
 * oauth flow, not the `/userinfo` verify ping) additionally require a
 * `developer-token` HTTP header issued by Google to the MCC account. That's
 * a feature-session concern; the wizard's identity ping is plain bearer-only.
 * Flagged in `humanDescription` so ad-campaign-builder doesn't rediscover it.
 *
 * Owner: SW-11. Consumer: `lib/wizards/defs/google-ads.ts`.
 */
import type { VendorManifest } from "@/lib/wizards/types";

export const googleAdsManifest: VendorManifest = {
  vendorKey: "google-ads",
  jobs: [
    {
      name: "google.identity.read",
      defaultBand: { p95: 600, p99: 1800 },
      unit: "ms",
    },
    {
      name: "google.ads.campaigns.read",
      defaultBand: { p95: 900, p99: 2400 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Google Ads (Ads API) — admin-owned ad account access for campaign read/write. NOTE: Ads API calls require a `developer-token` HTTP header in addition to the OAuth bearer; the wizard's identity ping does not.",
};

/**
 * OAuth scopes the wizard requests. `adwords` grants Ads API access;
 * `openid email profile` enables the `/oauth2/v3/userinfo` identity ping.
 * Design-time constant; not an autonomy threshold.
 */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "openid",
  "email",
  "profile",
];

/**
 * Google's OAuth 2.0 authorize endpoint. Pinned here so the wizard def +
 * authorize URL builder + callback route share one constant.
 */
export const GOOGLE_OAUTH_AUTHORIZE_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * Google's userinfo endpoint — minimum authenticated identity check.
 */
export const GOOGLE_USERINFO_URL =
  "https://www.googleapis.com/oauth2/v3/userinfo";
