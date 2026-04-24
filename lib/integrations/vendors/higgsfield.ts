import type { VendorManifest } from "@/lib/wizards/types";

export const higgsFieldManifest: VendorManifest = {
  vendorKey: "higgsfield",
  jobs: [
    {
      name: "higgsfield.generate",
      defaultBand: { p95: 120_000, p99: 300_000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Higgsfield — AI video generation. Admin pastes API key from cloud.higgsfield.ai.",
};

export const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai";
