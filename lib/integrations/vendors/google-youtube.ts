import type { VendorManifest } from "@/lib/wizards/types";

export const googleYoutubeManifest: VendorManifest = {
  vendorKey: "google-youtube",
  jobs: [
    {
      name: "google.youtube.data_api",
      defaultBand: { p95: 2000, p99: 5000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "YouTube Data API v3 — channel stats and upload cadence for lead enrichment.",
};

export const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
