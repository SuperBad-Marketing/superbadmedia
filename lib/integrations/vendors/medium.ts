import type { VendorManifest } from "@/lib/wizards/types";

export const mediumManifest: VendorManifest = {
  vendorKey: "medium",
  jobs: [
    {
      name: "medium.posts.create",
      defaultBand: { p95: 2000, p99: 5000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "content_syndication_enabled",
  humanDescription:
    "Medium — blog syndication with canonical backlink.",
};

export const MEDIUM_API_BASE = "https://api.medium.com/v1";
