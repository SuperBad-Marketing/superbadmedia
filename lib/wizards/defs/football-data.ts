import {
  footballDataManifest,
  FOOTBALL_DATA_API_BASE,
} from "@/lib/integrations/vendors/football-data";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type FootballDataPayload = {
  apiKey: string;
  verifiedAt: number;
  confirmedAt: number;
};

async function pingFootballData(
  apiKey: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${FOOTBALL_DATA_API_BASE}/competitions/PL`, {
      headers: { "X-Auth-Token": apiKey },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `Football-Data.org rejected that key: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Football-Data.org ping failed: ${err.message}`
          : "Football-Data.org ping failed.",
    };
  }
}

export const footballDataWizard: WizardDefinition<FootballDataPayload> = {
  key: "football-data",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-key",
      type: "api-key-paste",
      label: "Paste Football-Data key",
      resumable: true,
      config: { label: "Football-Data.org API key" },
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
    verify: async (p) => pingFootballData(p.apiKey),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: footballDataManifest,
  voiceTreatment: {
    introCopy:
      "Football-Data.org. Paste the key, we'll check the Premier League endpoint, and Forest fixtures go live on the cockpit.",
    outroCopy:
      "Football-Data.org is wired in. EPL scores and fixtures are live.",
    tabTitlePool: {
      setup: ["Setup — Football Data"],
      connecting: ["Connecting Football Data…"],
      confirming: ["Confirming Football Data…"],
      connected: ["Football Data connected."],
      stuck: ["Football Data — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(footballDataWizard);
