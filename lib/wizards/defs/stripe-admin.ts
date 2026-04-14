/**
 * `stripe-admin` — first critical-flight wizard. Composes SW-2 step-types
 * via STEP_TYPE_REGISTRY (api-key-paste → webhook-probe → review-and-confirm
 * → celebration) and SW-3's vendorManifest + completion contract.
 *
 * `completionContract.verify` performs a live `balance.retrieve` ping with
 * the pasted key — the single source of truth that the admin's Stripe
 * credentials actually work. Artefact gate `integrationConnections: true`
 * ensures the row written by `registerIntegration()` exists before the
 * celebration step's orchestrator writes the wizard_completions row.
 *
 * Registers itself via `registerWizard()` on module import. Routes that
 * need this definition import the module to trigger registration.
 *
 * `capstone` is deliberately `undefined` — the critical-flight capstone is
 * the arc-level Tier-1 moment rendered at /lite/first-run once the last
 * critical wizard completes (see SW-4 handoff + spec §8.3). No per-wizard
 * capstone on stripe-admin.
 *
 * Owner: SW-5. Consumer: /lite/setup/critical-flight/[key].
 */
import Stripe from "stripe";
import { stripeManifest } from "@/lib/integrations/vendors/stripe";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type StripeAdminPayload = {
  apiKey: string;
  verifiedAt: number;
  webhookReceivedAt: number;
  confirmedAt: number;
};

export const stripeAdminWizard: WizardDefinition<StripeAdminPayload> = {
  key: "stripe-admin",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-key",
      type: "api-key-paste",
      label: "Paste Stripe key",
      resumable: true,
      config: { label: "Stripe secret key" },
    },
    {
      key: "webhook-probe",
      type: "webhook-probe",
      label: "Listen for webhook",
      resumable: false,
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
    required: ["apiKey", "verifiedAt", "webhookReceivedAt", "confirmedAt"],
    verify: async (p) => {
      try {
        const client = new Stripe(p.apiKey, {
          apiVersion: "2026-03-25.dahlia",
          typescript: true,
        });
        await client.balance.retrieve();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason:
            err instanceof Error
              ? `Stripe rejected that key: ${err.message}`
              : "Stripe key ping failed.",
        };
      }
    },
    artefacts: { integrationConnections: true },
  },
  vendorManifest: stripeManifest,
  voiceTreatment: {
    introCopy:
      "Right — Stripe first. Paste the key, we'll test it, then listen for a webhook so we know the pipe's open.",
    outroCopy: "Stripe's hooked in. Money can now arrive.",
    tabTitlePool: {
      setup: ["Setup — Stripe"],
      connecting: ["Connecting Stripe…"],
      confirming: ["Confirming Stripe…"],
      connected: ["Stripe connected."],
      stuck: ["Stripe — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(stripeAdminWizard);
