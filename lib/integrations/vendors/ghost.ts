import type { VendorManifest } from "@/lib/wizards/types";

export const ghostManifest: VendorManifest = {
  vendorKey: "ghost",
  jobs: [
    {
      name: "ghost.posts.create",
      defaultBand: { p95: 2000, p99: 5000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "content_syndication_enabled",
  humanDescription:
    "Ghost CMS — blog syndication with canonical backlink.",
};
