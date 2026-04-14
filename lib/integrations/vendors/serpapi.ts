/**
 * `serpapi` vendor manifest — generic API-key wizard profile (SW-13).
 *
 * SerpAPI verifies via `GET /account?api_key=<key>` — returns account
 * status + plan + monthly-search quota. Cheapest authenticated check;
 * also confirms the key isn't exhausted.
 *
 * Owner: SW-13. Consumer: `lib/wizards/defs/api-key.ts` (vendor profile).
 */
import type { VendorManifest } from "@/lib/wizards/types";

export const serpapiManifest: VendorManifest = {
  vendorKey: "serpapi",
  jobs: [
    {
      name: "serpapi.search",
      defaultBand: { p95: 2500, p99: 8000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "SerpAPI — search-results scraping. Admin pastes API key from serpapi.com.",
};

export const SERPAPI_API_BASE = "https://serpapi.com";
