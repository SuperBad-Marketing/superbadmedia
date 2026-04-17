/**
 * Content Engine onboarding wizard definition (CE-12).
 *
 * Three-step client-facing wizard rendered inside <WizardShell>:
 *   Step 1 — Domain verification (Cloudflare path routing + Resend SPF/DKIM)
 *   Step 2 — Seed keyword review (auto-derived from Brand DNA, approve/tweak)
 *   Step 3 — Newsletter preferences (send window + optional CSV import + embed form)
 *
 * Spec: docs/specs/content-engine.md §3.3 + §1.1.
 * Wizard key: content-engine-onboarding. Render mode: slideover.
 *
 * Owner: CE-12. Consumers: onboarding page, getOnboardingState.
 */
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type ContentEngineOnboardingPayload = {
  domainVerified: boolean;
  seedKeywordsConfirmed: string[];
  sendWindowDay: string;
  sendWindowTime: string;
  sendWindowTz: string;
  csvImported: boolean;
  embedFormTokenGenerated: boolean;
  completedAt: number;
};

export const contentEngineOnboardingWizard: WizardDefinition<ContentEngineOnboardingPayload> = {
  key: "content-engine-onboarding",
  audience: "client",
  renderMode: "slideover",
  steps: [
    {
      key: "domain-verification",
      type: "dns-verify",
      label: "Domain setup",
      resumable: false,
      config: {
        instruction:
          "We need to verify your domain so your blog and newsletter send from your own address. " +
          "Add these DNS records — if you're not sure how, ask your web person to handle this one step.",
      },
    },
    {
      key: "seed-keyword-review",
      type: "review-and-confirm",
      label: "Your topics",
      resumable: true,
      config: {
        ctaLabel: "These look right",
        instruction:
          "We pulled these seed keywords from your Brand DNA and business details. " +
          "They'll guide what your content engine writes about. " +
          "Remove any that feel off, or add ones we missed.",
      },
    },
    {
      key: "newsletter-preferences",
      type: "form",
      label: "Newsletter",
      resumable: true,
      config: {
        instruction:
          "When should your newsletter land? Pick a day and time. " +
          "If you have an existing email list, you can import it here too.",
      },
    },
  ],
  completionContract: {
    required: ["domainVerified", "seedKeywordsConfirmed", "sendWindowDay", "completedAt"],
    verify: async (p) => {
      if (!p.domainVerified) {
        return { ok: false, reason: "Domain verification isn't complete yet." };
      }
      if (
        !Array.isArray(p.seedKeywordsConfirmed) ||
        p.seedKeywordsConfirmed.length === 0
      ) {
        return { ok: false, reason: "At least one seed keyword is needed." };
      }
      if (!p.sendWindowDay) {
        return { ok: false, reason: "Pick a send day for your newsletter." };
      }
      return { ok: true };
    },
    artefacts: {
      activityLog: "wizard_completed",
    },
  },
  voiceTreatment: {
    introCopy: "Let's get your content engine running. Three quick steps.",
    outroCopy:
      "Your engine is live. First draft incoming — we'll let you know when it's ready for review.",
    tabTitlePool: {
      setup: ["SuperBad — content engine setup"],
      connecting: ["Verifying…"],
      confirming: ["Almost there…"],
      connected: ["Engine ready."],
      stuck: ["Content setup — stuck?"],
    },
  },
};

registerWizard(contentEngineOnboardingWizard);
