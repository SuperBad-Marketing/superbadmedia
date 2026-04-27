import type { VendorManifest } from "@/lib/wizards/types";

export const posthogManifest: VendorManifest = {
  vendorKey: "posthog",
  jobs: [
    {
      name: "posthog.capture",
      defaultBand: { p95: 200, p99: 800 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "integrations.posthog.enabled",
  humanDescription:
    "PostHog — product analytics, session recording, and heatmaps.",
};

export const POSTHOG_API_BASE = "https://us.i.posthog.com";
