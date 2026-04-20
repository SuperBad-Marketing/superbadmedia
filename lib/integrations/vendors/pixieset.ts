/**
 * `pixieset` vendor manifest — first non-critical admin integration (SW-9).
 *
 * Pixieset has no public API per the P0 spike (see
 * `sessions/p0-pixieset-spike-handoff.md`). Outcome B locked Path B — an
 * on-brand link-out rather than an inline native gallery. There are no
 * live vendor calls to time or ring-fence, so the manifest declares a
 * single design-time band (`pixieset.link.paste`) with nominal timings
 * just so the Observatory registration path has something to hash. The
 * band is never hit by real traffic.
 *
 * Kill-switch shares `setup_wizards_enabled` with the rest of the wizard
 * family — nothing Pixieset-specific to disable independently.
 *
 * Owner: SW-9. Consumer: `lib/wizards/defs/pixieset-admin.ts`.
 */
import type { VendorManifest } from "@/lib/wizards/types";

export const pixiesetManifest: VendorManifest = {
  vendorKey: "pixieset",
  jobs: [
    {
      name: "pixieset.link.paste",
      defaultBand: { p95: 1, p99: 1 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Pixieset gallery link-out — captures the canonical per-client gallery URL. No live API access (P0 spike outcome B).",
};
