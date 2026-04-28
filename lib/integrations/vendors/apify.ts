import type { VendorManifest } from "@/lib/wizards/types";

export const apifyManifest: VendorManifest = {
  vendorKey: "apify",
  jobs: [
    {
      name: "apify.google_search",
      defaultBand: { p95: 30000, p99: 60000 },
      unit: "ms",
    },
    {
      name: "apify.email_finder",
      defaultBand: { p95: 25000, p99: 35000 },
      unit: "ms",
    },
    {
      name: "apify.website_crawler",
      defaultBand: { p95: 40000, p99: 60000 },
      unit: "ms",
    },
    {
      name: "apify.facebook_page",
      defaultBand: { p95: 30000, p99: 45000 },
      unit: "ms",
    },
    {
      name: "apify.linkedin_company",
      defaultBand: { p95: 35000, p99: 50000 },
      unit: "ms",
    },
    {
      name: "apify.tiktok_profile",
      defaultBand: { p95: 30000, p99: 45000 },
      unit: "ms",
    },
    {
      name: "apify.meta_ad_library",
      defaultBand: { p95: 90000, p99: 120000 },
      unit: "ms",
    },
    {
      name: "apify.instagram_location",
      defaultBand: { p95: 60000, p99: 90000 },
      unit: "ms",
    },
    {
      name: "apify.instagram_profile",
      defaultBand: { p95: 45000, p99: 70000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Apify — contact info scraper for email discovery. Fallback source when Hunter.io has no match. Admin pastes API token from console.apify.com.",
};

export const APIFY_API_BASE = "https://api.apify.com/v2";
