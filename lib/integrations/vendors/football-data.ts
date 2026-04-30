import type { VendorManifest } from "@/lib/wizards/types";

export const FOOTBALL_DATA_API_BASE =
  "https://api.football-data.org/v4";

export const footballDataManifest: VendorManifest = {
  vendorKey: "football-data",
  jobs: [
    {
      name: "football-data.matches.fetch",
      defaultBand: { p95: 1000, p99: 2500 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Football-Data.org v4 — EPL fixtures and results for the cockpit ticker.",
};
