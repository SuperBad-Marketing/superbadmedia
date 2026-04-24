/**
 * `meta` — admin integration wizard for Meta (Instagram + Ads).
 *
 * Renamed from `meta-ads`. OAuth flow connects a Meta app, discovers
 * linked Instagram Business Account, and creates an `instagram_accounts`
 * row on completion.
 *
 * Steps: oauth-consent → review-and-confirm → celebration.
 *
 * Owner: SW-10. Extended by Instagram channel session.
 */
import {
  metaManifest,
  META_GRAPH_API_VERSION,
} from "@/lib/integrations/vendors/meta";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type MetaPayload = {
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

export const metaWizard: WizardDefinition<MetaPayload> = {
  key: "meta",
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
  vendorManifest: metaManifest,
  voiceTreatment: {
    introCopy:
      "Meta next. Tap through the consent screen, we'll hook up Instagram and the ad account in one pass.",
    outroCopy: "Meta's hooked in. Instagram publishing, insights, and ads — all live.",
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

registerWizard(metaWizard);
