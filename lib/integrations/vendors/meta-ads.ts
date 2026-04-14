/**
 * `meta-ads` vendor manifest — second non-critical admin integration (SW-10).
 *
 * Meta Ads (Facebook Marketing API) runs over a standard OAuth 2.0 handshake
 * + Graph-style REST API. This manifest mirrors `graph-api` in shape: narrow
 * initial job set (identity ping + campaign fetch) sized to what the wizard
 * exercises; feature sessions that consume more of the surface extend via
 * band-additions patches, not manifest rewrites.
 *
 * Kill-switch shares `setup_wizards_enabled` with the rest of the wizard
 * family — nothing Meta-specific to disable independently.
 *
 * Owner: SW-10. Consumer: `lib/wizards/defs/meta-ads.ts`.
 */
import type { VendorManifest } from "@/lib/wizards/types";

export const metaAdsManifest: VendorManifest = {
  vendorKey: "meta-ads",
  jobs: [
    {
      name: "meta.identity.read",
      defaultBand: { p95: 600, p99: 1800 },
      unit: "ms",
    },
    {
      name: "meta.campaigns.read",
      defaultBand: { p95: 900, p99: 2400 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Meta Ads (Facebook Marketing API) — admin-owned ad account access for campaign read/write.",
};

/**
 * OAuth scopes the wizard requests. Design-time constant; not an autonomy
 * threshold — lives here rather than in settings.
 */
export const META_OAUTH_SCOPES = ["ads_read", "ads_management"];

/**
 * Meta Graph API version pinned for identity pings + any direct fetch the
 * wizard issues. Feature sessions that want to pin differently can read
 * their own constant; manifest-adjacent callers use this.
 */
export const META_GRAPH_API_VERSION = "v20.0";
