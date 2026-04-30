import type { VendorManifest } from "@/lib/wizards/types";

export const linkedinArticlesManifest: VendorManifest = {
  vendorKey: "linkedin_articles",
  jobs: [
    {
      name: "linkedin.articles.create",
      defaultBand: { p95: 3000, p99: 6000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "content_syndication_enabled",
  humanDescription:
    "LinkedIn Articles — blog syndication as LinkedIn article.",
};

export const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
