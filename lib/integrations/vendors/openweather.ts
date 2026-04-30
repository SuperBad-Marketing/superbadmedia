import type { VendorManifest } from "@/lib/wizards/types";

export const OPENWEATHER_API_BASE =
  "https://api.openweathermap.org/data/3.0";

export const openweatherManifest: VendorManifest = {
  vendorKey: "openweather",
  jobs: [
    {
      name: "openweather.onecall.fetch",
      defaultBand: { p95: 800, p99: 2000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "OpenWeather One Call 3.0 — Melbourne weather for the cockpit ticker.",
};
