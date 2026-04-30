import {
  openweatherManifest,
  OPENWEATHER_API_BASE,
} from "@/lib/integrations/vendors/openweather";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type OpenWeatherPayload = {
  apiKey: string;
  verifiedAt: number;
  confirmedAt: number;
};

async function pingOpenWeather(
  apiKey: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(
      `${OPENWEATHER_API_BASE}/onecall?lat=-37.81&lon=144.96&exclude=minutely,hourly,daily,alerts&appid=${apiKey}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `OpenWeather rejected that key: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `OpenWeather ping failed: ${err.message}`
          : "OpenWeather ping failed.",
    };
  }
}

export const openweatherWizard: WizardDefinition<OpenWeatherPayload> = {
  key: "openweather",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-key",
      type: "api-key-paste",
      label: "Paste OpenWeather key",
      resumable: true,
      config: { label: "OpenWeather API key" },
    },
    {
      key: "review",
      type: "review-and-confirm",
      label: "Review",
      resumable: true,
      config: { ctaLabel: "Looks right — finish" },
    },
    {
      key: "celebrate",
      type: "celebration",
      label: "Done",
      resumable: false,
    },
  ],
  completionContract: {
    required: ["apiKey", "verifiedAt", "confirmedAt"],
    verify: async (p) => pingOpenWeather(p.apiKey),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: openweatherManifest,
  voiceTreatment: {
    introCopy:
      "OpenWeather next. Paste the API key, we'll ping Melbourne's forecast, and your cockpit gets live weather.",
    outroCopy:
      "OpenWeather's wired in. Melbourne weather is now live on the cockpit.",
    tabTitlePool: {
      setup: ["Setup — OpenWeather"],
      connecting: ["Connecting OpenWeather…"],
      confirming: ["Confirming OpenWeather…"],
      connected: ["OpenWeather connected."],
      stuck: ["OpenWeather — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(openweatherWizard);
