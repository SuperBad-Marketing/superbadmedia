import type { VendorManifest } from "@/lib/wizards/types";

export const googlePagespeedManifest: VendorManifest = {
  vendorKey: "google-pagespeed",
  jobs: [
    {
      name: "google.pagespeed.run",
      defaultBand: { p95: 8000, p99: 15000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Google PageSpeed Insights — website performance scoring for lead enrichment.",
};

export const PAGESPEED_API_BASE =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
