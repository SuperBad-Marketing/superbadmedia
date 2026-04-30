import type { VendorManifest } from "@/lib/wizards/types";

export const beehiivManifest: VendorManifest = {
  vendorKey: "beehiiv",
  jobs: [
    {
      name: "beehiiv.posts.create",
      defaultBand: { p95: 2000, p99: 5000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "content_syndication_enabled",
  humanDescription:
    "Beehiiv — blog syndication to newsletter.",
};

export const BEEHIIV_API_BASE = "https://api.beehiiv.com/v2";
