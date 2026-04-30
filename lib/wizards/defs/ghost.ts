import { z } from "zod";
import { createHmac } from "node:crypto";
import { ghostManifest } from "@/lib/integrations/vendors/ghost";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type GhostPayload = {
  adminApiKey: string;
  adminUrl: string;
  verifiedAt: number;
  confirmedAt: number;
};

export const ghostCredentialsSchema = z.object({
  adminApiKey: z
    .string()
    .trim()
    .regex(
      /^[a-f0-9]{24}:[a-f0-9]{64}$/,
      "Ghost Admin API key format: {id}:{secret} (24:64 hex chars).",
    ),
  adminUrl: z
    .string()
    .trim()
    .url("Enter the full Ghost admin URL (e.g. https://yourblog.ghost.io)."),
});

export function maskGhostKey(key: string): string {
  const id = key.split(":")[0] ?? "";
  return id.length > 4 ? `${id.slice(0, 4)}…` : key;
}

export function maskGhostUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function buildGhostJwt(apiKey: string): string {
  const [id, secret] = apiKey.split(":");
  if (!id || !secret) throw new Error("Invalid Ghost Admin API key format.");

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: "/admin/",
  })).toString("base64url");

  const signature = createHmac("sha256", Buffer.from(secret, "hex"))
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

async function pingGhostAdmin(
  adminApiKey: string,
  adminUrl: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const jwt = buildGhostJwt(adminApiKey);
    const base = adminUrl.replace(/\/+$/, "");
    const res = await fetch(`${base}/ghost/api/admin/posts/?limit=1`, {
      headers: { Authorization: `Ghost ${jwt}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `Ghost rejected that key: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Ghost ping failed: ${err.message}`
          : "Ghost ping failed.",
    };
  }
}

export const ghostWizard: WizardDefinition<GhostPayload> = {
  key: "ghost",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-credentials",
      type: "form",
      label: "Paste credentials",
      resumable: true,
      config: { schema: ghostCredentialsSchema },
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
    required: ["adminApiKey", "adminUrl", "verifiedAt", "confirmedAt"],
    verify: async (p) => pingGhostAdmin(p.adminApiKey, p.adminUrl),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: ghostManifest,
  voiceTreatment: {
    introCopy:
      "Ghost CMS. Grab your Admin API key from Settings > Integrations, paste it with your blog URL, and posts syndicate automatically.",
    outroCopy:
      "Ghost is connected. Published posts will syndicate to your Ghost blog with a canonical backlink.",
    tabTitlePool: {
      setup: ["Setup — Ghost"],
      connecting: ["Connecting Ghost…"],
      confirming: ["Confirming Ghost…"],
      connected: ["Ghost connected."],
      stuck: ["Ghost — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(ghostWizard);
