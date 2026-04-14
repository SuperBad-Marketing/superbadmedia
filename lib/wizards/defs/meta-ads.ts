/**
 * `meta-ads` — second non-critical admin integration wizard (SW-10).
 *
 * Structurally mirrors `graph-api-admin`: oauth-consent → review-and-confirm
 * → celebration. Meta Ads exposes a standard OAuth 2.0 flow; the access
 * token arrives via the callback route at `/api/oauth/meta-ads/callback`.
 *
 * `completionContract.verify` pings `GET /v20.0/me?fields=id,name` — the
 * cheapest authenticated identity check Meta exposes. Any other call
 * requires picking an ad account up front, which we defer to feature
 * sessions.
 *
 * Artefact gate `integrationConnections: true` ensures the row written by
 * `registerIntegration()` exists before `wizard_completions` inserts.
 *
 * `capstone` is `undefined` — Meta Ads is non-critical, lives outside the
 * first-run flight's capstone arc.
 *
 * Owner: SW-10. Consumer: /lite/setup/admin/[key].
 */
import {
  metaAdsManifest,
  META_GRAPH_API_VERSION,
} from "@/lib/integrations/vendors/meta-ads";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type MetaAdsPayload = {
  accessToken: string;
  verifiedAt: number;
  confirmedAt: number;
};

async function pingMetaMe(
  token: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me?fields=id,name`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const snippet = body.slice(0, 140);
      return {
        ok: false,
        reason: `Meta rejected that token: ${res.status} ${snippet || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Meta rejected that token: ${err.message}`
          : "Meta Graph ping failed.",
    };
  }
}

export const metaAdsWizard: WizardDefinition<MetaAdsPayload> = {
  key: "meta-ads",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "consent",
      type: "oauth-consent",
      label: "Authorise Meta",
      resumable: false,
      config: { vendorLabel: "Meta" },
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
    verify: async (p) => pingMetaMe(p.accessToken),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: metaAdsManifest,
  voiceTreatment: {
    introCopy:
      "Meta next. Tap through the consent screen, we'll ping your profile, and the ad account's live.",
    outroCopy: "Meta's hooked in. Campaigns can read and write from here.",
    tabTitlePool: {
      setup: ["Setup — Meta"],
      connecting: ["Connecting Meta…"],
      confirming: ["Confirming Meta…"],
      connected: ["Meta connected."],
      stuck: ["Meta — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(metaAdsWizard);
