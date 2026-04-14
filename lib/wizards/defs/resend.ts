/**
 * `resend` — second critical-flight wizard. Composes SW-2 step-types
 * (api-key-paste → review-and-confirm → celebration). Resend does not
 * expose a handshake probe at provisioning time, so the wizard is one
 * step shorter than `stripe-admin` (no webhook-probe). The first real
 * transactional send is the eventual proof; at provisioning time, the
 * `completionContract.verify` identity-pings `apiKeys.list()` as the
 * cheapest authenticated call that confirms the pasted key works.
 *
 * Artefact gate `integrationConnections: true` ensures the row written
 * by `registerIntegration()` exists before the celebration step's
 * orchestrator writes `wizard_completions`.
 *
 * Registers itself via `registerWizard()` on module import. The SW-6
 * barrel at `lib/wizards/defs/index.ts` is the canonical place route
 * code imports to trigger registration for every wizard.
 *
 * `capstone` is `undefined` — per spec §8.3, the critical-flight capstone
 * is arc-level (rendered at /lite/first-run once the last critical wizard
 * completes), never per-wizard.
 *
 * Owner: SW-6. Consumer: /lite/setup/critical-flight/[key].
 */
import { Resend } from "resend";
import { resendManifest } from "@/lib/integrations/vendors/resend";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type ResendAdminPayload = {
  apiKey: string;
  verifiedAt: number;
  confirmedAt: number;
};

export const resendWizard: WizardDefinition<ResendAdminPayload> = {
  key: "resend",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-key",
      type: "api-key-paste",
      label: "Paste Resend key",
      resumable: true,
      config: { label: "Resend API key" },
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
    required: ["apiKey", "verifiedAt", "confirmedAt"],
    verify: async (p) => {
      try {
        const client = new Resend(p.apiKey);
        const { error } = await client.apiKeys.list();
        if (error) {
          return {
            ok: false,
            reason: `Resend rejected that key: ${error.message}`,
          };
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason:
            err instanceof Error
              ? `Resend rejected that key: ${err.message}`
              : "Resend key ping failed.",
        };
      }
    },
    artefacts: { integrationConnections: true },
  },
  vendorManifest: resendManifest,
  voiceTreatment: {
    introCopy:
      "Resend next. Paste the key, we'll ping it, then you're good — email can leave the building.",
    outroCopy: "Resend's wired in. Email can now leave the building.",
    tabTitlePool: {
      setup: ["Setup — Resend"],
      connecting: ["Connecting Resend…"],
      confirming: ["Confirming Resend…"],
      connected: ["Resend connected."],
      stuck: ["Resend — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(resendWizard);
