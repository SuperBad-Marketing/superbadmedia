import { z } from "zod";
import {
  linkedinArticlesManifest,
  LINKEDIN_API_BASE,
} from "@/lib/integrations/vendors/linkedin-articles";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type LinkedinArticlesPayload = {
  accessToken: string;
  authorUrn: string;
  verifiedAt: number;
  confirmedAt: number;
};

export const linkedinArticlesSchema = z.object({
  accessToken: z
    .string()
    .trim()
    .min(1, "Paste your LinkedIn access token."),
  authorUrn: z
    .string()
    .trim()
    .regex(
      /^urn:li:(person|organization):\w+$/,
      "Author URN format: urn:li:person:XXXXX or urn:li:organization:XXXXX",
    ),
});

export function maskLinkedinToken(token: string): string {
  return token.length >= 8 ? `${token.slice(0, 4)}…${token.slice(-4)}` : token;
}

export function maskLinkedinUrn(urn: string): string {
  const parts = urn.split(":");
  const id = parts[parts.length - 1] ?? "";
  return id.length > 4 ? `…${id.slice(-4)}` : urn;
}

async function pingLinkedinProfile(
  accessToken: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${LINKEDIN_API_BASE}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `LinkedIn rejected that token: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `LinkedIn ping failed: ${err.message}`
          : "LinkedIn ping failed.",
    };
  }
}

export const linkedinArticlesWizard: WizardDefinition<LinkedinArticlesPayload> = {
  key: "linkedin_articles",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-credentials",
      type: "form",
      label: "Paste credentials",
      resumable: true,
      config: { schema: linkedinArticlesSchema },
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
    required: ["accessToken", "authorUrn", "verifiedAt", "confirmedAt"],
    verify: async (p) => pingLinkedinProfile(p.accessToken),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: linkedinArticlesManifest,
  voiceTreatment: {
    introCopy:
      "LinkedIn Articles. Paste your access token and author URN, we'll verify the connection, and blog posts syndicate as LinkedIn articles.",
    outroCopy:
      "LinkedIn's connected. Published posts will syndicate as articles under your profile.",
    tabTitlePool: {
      setup: ["Setup — LinkedIn Articles"],
      connecting: ["Connecting LinkedIn…"],
      confirming: ["Confirming LinkedIn…"],
      connected: ["LinkedIn connected."],
      stuck: ["LinkedIn — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(linkedinArticlesWizard);
