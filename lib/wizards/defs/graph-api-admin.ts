/**
 * `graph-api-admin` — third and final critical-flight wizard (SW-7).
 *
 * Structurally different from stripe-admin / resend: replaces api-key-paste
 * with oauth-consent. The admin taps "Continue to Microsoft", authorises the
 * app, and the oauth callback route hands the access token back into the
 * wizard's state. Review-and-confirm + celebration close the arc.
 *
 * `completionContract.verify` pings `GET https://graph.microsoft.com/v1.0/me`
 * — the minimum scope every access token can read; fastest proof that the
 * pasted-equivalent (post-consent token) actually works.
 *
 * Artefact gate `integrationConnections: true` ensures the row written by
 * `registerIntegration()` exists before the celebration orchestrator writes
 * `wizard_completions`.
 *
 * Registers itself via `registerWizard()` on module import; ships through
 * the `lib/wizards/defs` barrel. Capstone is deliberately `undefined` —
 * the critical-flight capstone is arc-level at /lite/first-run.
 *
 * No Microsoft Graph SDK dependency — one endpoint, `fetch` is enough.
 *
 * Owner: SW-7. Consumer: /lite/setup/critical-flight/[key].
 */
import { graphApiManifest } from "@/lib/integrations/vendors/graph-api";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type GraphAdminPayload = {
  accessToken: string;
  verifiedAt: number;
  confirmedAt: number;
};

async function pingGraphMe(
  token: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const snippet = body.slice(0, 140);
      return {
        ok: false,
        reason: `Microsoft rejected that token: ${res.status} ${snippet || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Microsoft rejected that token: ${err.message}`
          : "Microsoft Graph ping failed.",
    };
  }
}

export const graphApiAdminWizard: WizardDefinition<GraphAdminPayload> = {
  key: "graph-api-admin",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "consent",
      type: "oauth-consent",
      label: "Authorise Microsoft",
      resumable: false,
      config: { vendorLabel: "Microsoft" },
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
    verify: async (p) => pingGraphMe(p.accessToken),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: graphApiManifest,
  voiceTreatment: {
    introCopy:
      "Microsoft next. Tap through the consent screen, we'll ping your profile, and mail + calendar are live.",
    outroCopy: "Microsoft's hooked in. Mail can leave; calendar can read.",
    tabTitlePool: {
      setup: ["Setup — Microsoft"],
      connecting: ["Connecting Microsoft…"],
      confirming: ["Confirming Microsoft…"],
      connected: ["Microsoft connected."],
      stuck: ["Microsoft — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(graphApiAdminWizard);
