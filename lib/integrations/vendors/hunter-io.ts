import type { VendorManifest } from "@/lib/wizards/types";

export const hunterIoManifest: VendorManifest = {
  vendorKey: "hunter-io",
  jobs: [
    {
      name: "hunter.domain_search",
      defaultBand: { p95: 1500, p99: 5000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Hunter.io — email discovery for lead gen contact lookup. Admin pastes API key from hunter.io.",
};

export const HUNTER_API_BASE = "https://api.hunter.io/v2";
