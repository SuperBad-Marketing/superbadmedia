import type { VendorManifest } from "@/lib/wizards/types";

export const apifyManifest: VendorManifest = {
  vendorKey: "apify",
  jobs: [
    {
      name: "apify.email_finder",
      defaultBand: { p95: 25000, p99: 35000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Apify — contact info scraper for email discovery. Fallback source when Hunter.io has no match. Admin pastes API token from console.apify.com.",
};

export const APIFY_API_BASE = "https://api.apify.com/v2";
