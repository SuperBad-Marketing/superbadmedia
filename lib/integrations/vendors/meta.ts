/**
 * `meta` vendor manifest — unified Meta integration (ads + Instagram).
 *
 * Renamed from `meta-ads` to reflect the broader scope: Instagram
 * publishing, insights, audience management, and ads all share one
 * OAuth token via the same Meta app.
 *
 * Kill-switch shares `setup_wizards_enabled` with the rest of the wizard
 * family.
 *
 * Owner: SW-10. Extended by Instagram channel session.
 */
import type { VendorManifest } from "@/lib/wizards/types";

export const metaManifest: VendorManifest = {
  vendorKey: "meta",
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
    {
      name: "meta.instagram.publish",
      defaultBand: { p95: 3000, p99: 8000 },
      unit: "ms",
    },
    {
      name: "meta.instagram.insights",
      defaultBand: { p95: 1200, p99: 3000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Meta — Instagram publishing, insights, audience management, and ad campaigns.",
};

/**
 * OAuth scopes the wizard requests. Covers ads + Instagram publishing +
 * Instagram insights + Page management (required for IG Business accounts).
 */
export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_messaging",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "ads_read",
  "ads_management",
];

/**
 * Meta Graph API version pinned for identity pings + any direct fetch the
 * wizard issues. Instagram client uses v21.0 independently.
 */
export const META_GRAPH_API_VERSION = "v21.0";
