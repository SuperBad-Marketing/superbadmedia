/**
 * `google-ads` — third non-critical admin integration wizard (SW-11).
 *
 * Structurally mirrors `meta-ads`: oauth-consent → review-and-confirm →
 * celebration. Google Ads uses Google's OAuth 2.0 flow; the access token
 * arrives via the callback route at `/api/oauth/google-ads/callback`.
 *
 * `completionContract.verify` pings `GET /oauth2/v3/userinfo` — the cheapest
 * authenticated identity check Google exposes. Any Ads API call requires a
 * `developer-token` header (see manifest humanDescription), which is a
 * feature-session concern.
 *
 * Artefact gate `integrationConnections: true`. `capstone` undefined — Google
 * Ads is non-critical, lives outside the first-run flight's capstone arc.
 *
 * Owner: SW-11. Consumer: /lite/setup/admin/[key].
 */
import {
  googleAdsManifest,
  GOOGLE_USERINFO_URL,
} from "@/lib/integrations/vendors/google-ads";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type GoogleAdsPayload = {
  accessToken: string;
  verifiedAt: number;
  confirmedAt: number;
};

async function pingGoogleUserinfo(
  token: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const snippet = body.slice(0, 140);
      return {
        ok: false,
        reason: `Google rejected that token: ${res.status} ${snippet || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Google rejected that token: ${err.message}`
          : "Google userinfo ping failed.",
    };
  }
}

export const googleAdsWizard: WizardDefinition<GoogleAdsPayload> = {
  key: "google-ads",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "consent",
      type: "oauth-consent",
      label: "Authorise Google",
      resumable: false,
      config: { vendorLabel: "Google" },
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
    required: ["accessToken", "verifiedAt", "confirmedAt"],
    verify: async (p) => pingGoogleUserinfo(p.accessToken),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: googleAdsManifest,
  voiceTreatment: {
    introCopy:
      "Google next. Tap through the consent screen, we'll ping your profile, and the ad account's live.",
    outroCopy: "Google's hooked in. Campaigns can read and write from here.",
    tabTitlePool: {
      setup: ["Setup — Google"],
      connecting: ["Connecting Google…"],
      confirming: ["Confirming Google…"],
      connected: ["Google connected."],
      stuck: ["Google — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(googleAdsWizard);
