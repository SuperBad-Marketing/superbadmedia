import type { VendorManifest } from "@/lib/wizards/types";

export const wordpressManifest: VendorManifest = {
  vendorKey: "wordpress",
  jobs: [
    {
      name: "wordpress.posts.create",
      defaultBand: { p95: 2000, p99: 5000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "content_syndication_enabled",
  humanDescription:
    "WordPress.com — blog syndication with canonical backlink.",
};

export const WORDPRESS_API_BASE =
  "https://public-api.wordpress.com/rest/v1.1";
