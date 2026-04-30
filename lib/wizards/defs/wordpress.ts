import { z } from "zod";
import {
  wordpressManifest,
  WORDPRESS_API_BASE,
} from "@/lib/integrations/vendors/wordpress";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type WordPressPayload = {
  accessToken: string;
  siteId: string;
  verifiedAt: number;
  confirmedAt: number;
};

export const wordpressCredentialsSchema = z.object({
  accessToken: z
    .string()
    .trim()
    .min(1, "Paste your WordPress.com access token."),
  siteId: z
    .string()
    .trim()
    .min(1, "Enter your WordPress.com site ID or domain (e.g. yoursite.wordpress.com)."),
});

export function maskWordPressToken(token: string): string {
  return token.length >= 8 ? `${token.slice(0, 4)}…${token.slice(-4)}` : token;
}

export function maskWordPressSiteId(id: string): string {
  return id;
}

async function pingWordPressSite(
  accessToken: string,
  siteId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(
      `${WORDPRESS_API_BASE}/sites/${encodeURIComponent(siteId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `WordPress rejected those credentials: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `WordPress ping failed: ${err.message}`
          : "WordPress ping failed.",
    };
  }
}

export const wordpressWizard: WizardDefinition<WordPressPayload> = {
  key: "wordpress",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-credentials",
      type: "form",
      label: "Paste credentials",
      resumable: true,
      config: { schema: wordpressCredentialsSchema },
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
    required: ["accessToken", "siteId", "verifiedAt", "confirmedAt"],
    verify: async (p) => pingWordPressSite(p.accessToken, p.siteId),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: wordpressManifest,
  voiceTreatment: {
    introCopy:
      "WordPress.com. Paste your access token and site ID, we'll verify the connection, and blog posts syndicate automatically.",
    outroCopy:
      "WordPress is connected. Published posts will syndicate to your site with a canonical backlink.",
    tabTitlePool: {
      setup: ["Setup — WordPress"],
      connecting: ["Connecting WordPress…"],
      confirming: ["Confirming WordPress…"],
      connected: ["WordPress connected."],
      stuck: ["WordPress — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(wordpressWizard);
