import { z } from "zod";
import { spotifyManifest } from "@/lib/integrations/vendors/spotify";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type SpotifyPayload = {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  verifiedAt: number;
  confirmedAt: number;
};

export const spotifyCredentialsSchema = z.object({
  clientId: z.string().trim().min(1, "Paste your Spotify client ID."),
  clientSecret: z.string().trim().min(1, "Paste your Spotify client secret."),
});

export function maskSpotifyClientId(id: string): string {
  return id.length >= 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

export function maskSpotifySecret(secret: string): string {
  return secret.length >= 4 ? `…${secret.slice(-4)}` : secret;
}

async function pingSpotifyMe(
  token: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `Spotify rejected that token: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Spotify ping failed: ${err.message}`
          : "Spotify ping failed.",
    };
  }
}

export const spotifyWizard: WizardDefinition<SpotifyPayload> = {
  key: "spotify",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-credentials",
      type: "form",
      label: "App credentials",
      resumable: true,
      config: { schema: spotifyCredentialsSchema },
    },
    {
      key: "consent",
      type: "oauth-consent",
      label: "Authorise Spotify",
      resumable: false,
      config: { vendorLabel: "Spotify" },
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
    required: ["clientId", "clientSecret", "accessToken", "refreshToken", "verifiedAt", "confirmedAt"],
    verify: async (p) => pingSpotifyMe(p.accessToken),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: spotifyManifest,
  voiceTreatment: {
    introCopy:
      "Spotify. Grab your client ID and secret from the Spotify Developer Dashboard, then we'll walk through the OAuth consent.",
    outroCopy:
      "Spotify's connected. Pick a playlist from the cockpit and you're sorted.",
    tabTitlePool: {
      setup: ["Setup — Spotify"],
      connecting: ["Connecting Spotify…"],
      confirming: ["Confirming Spotify…"],
      connected: ["Spotify connected."],
      stuck: ["Spotify — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(spotifyWizard);
