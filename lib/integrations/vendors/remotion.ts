/**
 * `remotion` vendor manifest — generic API-key wizard profile (SW-13).
 *
 * Remotion's credential is a commercial licence key (no hosted API at
 * provisioning time; renders run locally or on Remotion Lambda via AWS
 * creds, both out of scope for this wizard). There is no live
 * verify-ping — the licence key is validated for format only (non-empty
 * + reasonable length). The first real render is the eventual proof;
 * consumer feature sessions that wire Lambda deploys will add their own
 * AWS credential flow separately.
 *
 * This is the only vendor in the generic api-key wizard without a live
 * endpoint. Documented here so the lack of a network ping is obvious.
 *
 * Owner: SW-13. Consumer: `lib/wizards/defs/api-key.ts` (vendor profile).
 */
import type { VendorManifest } from "@/lib/wizards/types";

export const remotionManifest: VendorManifest = {
  vendorKey: "remotion",
  jobs: [
    {
      name: "remotion.render",
      defaultBand: { p95: 30000, p99: 120000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Remotion — programmatic video rendering. Admin pastes commercial licence key (no live verify endpoint).",
};
