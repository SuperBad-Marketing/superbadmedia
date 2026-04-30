import { spotifyManifest } from "@/lib/integrations/vendors/spotify";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type SpotifyPayload = {
  accessToken: string;
  refreshToken: string;
  verifiedAt: number;
  confirmedAt: number;
};

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
    required: ["accessToken", "refreshToken", "verifiedAt", "confirmedAt"],
    verify: async (p) => pingSpotifyMe(p.accessToken),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: spotifyManifest,
  voiceTreatment: {
    introCopy:
      "Spotify next. Tap through the consent screen and your playlists show up on the cockpit.",
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
