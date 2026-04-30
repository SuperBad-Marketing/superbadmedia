import { z } from "zod";
import { beehiivManifest, BEEHIIV_API_BASE } from "@/lib/integrations/vendors/beehiiv";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type BeehiivPayload = {
  apiKey: string;
  publicationId: string;
  verifiedAt: number;
  confirmedAt: number;
};

export const beehiivCredentialsSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(1, "Paste your Beehiiv API key."),
  publicationId: z
    .string()
    .trim()
    .regex(
      /^pub_[a-f0-9-]+$/i,
      "Publication ID starts with pub_ (from Settings > API).",
    ),
});

export function maskBeehiivKey(key: string): string {
  return key.length >= 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : key;
}

export function maskBeehiivPubId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 6)}…` : id;
}

async function pingBeehiivPublication(
  apiKey: string,
  publicationId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(
      `${BEEHIIV_API_BASE}/publications/${publicationId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `Beehiiv rejected those credentials: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Beehiiv ping failed: ${err.message}`
          : "Beehiiv ping failed.",
    };
  }
}

export const beehiivWizard: WizardDefinition<BeehiivPayload> = {
  key: "beehiiv",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-credentials",
      type: "form",
      label: "Paste credentials",
      resumable: true,
      config: { schema: beehiivCredentialsSchema },
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
    required: ["apiKey", "publicationId", "verifiedAt", "confirmedAt"],
    verify: async (p) => pingBeehiivPublication(p.apiKey, p.publicationId),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: beehiivManifest,
  voiceTreatment: {
    introCopy:
      "Beehiiv. Grab your API key and publication ID from Settings > API, paste them in, and blog posts syndicate to your newsletter.",
    outroCopy:
      "Beehiiv's connected. Published posts will syndicate to your newsletter with a canonical backlink.",
    tabTitlePool: {
      setup: ["Setup — Beehiiv"],
      connecting: ["Connecting Beehiiv…"],
      confirming: ["Confirming Beehiiv…"],
      connected: ["Beehiiv connected."],
      stuck: ["Beehiiv — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(beehiivWizard);
