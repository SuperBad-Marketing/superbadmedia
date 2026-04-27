/**
 * `posthog` — setup wizard for PostHog product analytics.
 *
 * 3 steps: paste project API key → review → celebrate.
 *
 * PostHog keys are browser-visible (phc_…), so they're stored in
 * integration_connections like any other credential but also read by
 * the client-side PostHog provider via a server-rendered prop.
 *
 * Owner: analytics setup.
 */
import { posthogManifest, POSTHOG_API_BASE } from "@/lib/integrations/vendors/posthog";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";
import type { PosthogPayload } from "./posthog-schema";

export async function verifyPosthogKey(
  key: string,
  host?: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!key || !key.startsWith("phc_")) {
    return { ok: false, reason: "PostHog project API keys start with phc_." };
  }
  const base = host?.trim() || POSTHOG_API_BASE;
  try {
    const res = await fetch(`${base}/decide/?v=3`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, distinct_id: "wizard-verify" }),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: `PostHog rejected that key (${res.status}).`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? `PostHog ping failed: ${err.message}` : "PostHog ping failed.",
    };
  }
}

export const posthogWizard: WizardDefinition<PosthogPayload> = {
  key: "posthog",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-key",
      type: "api-key-paste",
      label: "API key",
      resumable: true,
      config: { label: "PostHog project API key" },
    },
    {
      key: "review",
      type: "review-and-confirm",
      label: "Review",
      resumable: true,
      config: { ctaLabel: "Connect PostHog" },
    },
    {
      key: "celebrate",
      type: "celebration",
      label: "Done",
      resumable: false,
    },
  ],
  completionContract: {
    required: ["apiKey", "verifiedAt", "confirmedAt"],
    verify: async (p) => verifyPosthogKey(p.apiKey, p.posthogHost),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: posthogManifest,
  voiceTreatment: {
    introCopy:
      "PostHog handles analytics, session recording, and heatmaps. Paste your project API key and we'll wire it in.",
    outroCopy:
      "PostHog's connected. Pageviews, sessions, and heatmaps are live.",
    tabTitlePool: {
      setup: ["Setup — PostHog"],
      connecting: ["Connecting PostHog…"],
      confirming: ["Confirming PostHog…"],
      connected: ["PostHog connected."],
      stuck: ["PostHog — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(posthogWizard);
