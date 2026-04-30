import { mediumManifest, MEDIUM_API_BASE } from "@/lib/integrations/vendors/medium";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type MediumPayload = {
  integrationToken: string;
  userId: string;
  verifiedAt: number;
  confirmedAt: number;
};

export async function verifyMediumToken(
  token: string,
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${MEDIUM_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `Medium rejected that token: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }
    const json = (await res.json()) as { data?: { id?: string } };
    const userId = json.data?.id ?? "";
    return { ok: true, userId };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Medium ping failed: ${err.message}`
          : "Medium ping failed.",
    };
  }
}

export const mediumWizard: WizardDefinition<MediumPayload> = {
  key: "medium",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-key",
      type: "api-key-paste",
      label: "Paste integration token",
      resumable: true,
      config: { label: "Medium integration token" },
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
    required: ["integrationToken", "userId", "verifiedAt", "confirmedAt"],
    verify: async (p) => {
      const result = await verifyMediumToken(p.integrationToken);
      if (!result.ok) return result;
      return { ok: true };
    },
    artefacts: { integrationConnections: true },
  },
  vendorManifest: mediumManifest,
  voiceTreatment: {
    introCopy:
      "Medium next. Grab your integration token from medium.com/me/settings, paste it in, and blog posts syndicate automatically.",
    outroCopy:
      "Medium's connected. Published posts will syndicate with a canonical backlink to your site.",
    tabTitlePool: {
      setup: ["Setup — Medium"],
      connecting: ["Connecting Medium…"],
      confirming: ["Confirming Medium…"],
      connected: ["Medium connected."],
      stuck: ["Medium — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(mediumWizard);
