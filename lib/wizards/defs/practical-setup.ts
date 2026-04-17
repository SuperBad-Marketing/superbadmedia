/**
 * Practical setup wizard definitions — retainer-only, client-facing.
 *
 * Three independent wizards that retainer clients complete at their own
 * pace after Brand DNA. Completion tracked via `wizard_completions` and
 * consumed by `getOnboardingState()` via the PRACTICAL_SETUP_WIZARD_KEYS
 * constant.
 *
 * Spec: onboarding-and-segmentation.md §2.1 Step 5, §15.
 * Owner: OS-2. Consumer: getOnboardingState (OS-1).
 */
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

// ── 1. Contact Details ────────────────────────────────────────────────

export type ContactDetailsPayload = {
  contacts: Array<{
    name: string;
    email: string;
    phone?: string;
    role?: string;
  }>;
  confirmedAt: number;
};

export const practicalContactDetailsWizard: WizardDefinition<ContactDetailsPayload> = {
  key: "practical-contact-details",
  audience: "client",
  renderMode: "slideover",
  steps: [
    {
      key: "add-contacts",
      type: "form",
      label: "Your key people",
      resumable: true,
      config: {
        instruction:
          "Who should we know about? Names, emails, phone numbers for the people we'll be working with.",
      },
    },
    {
      key: "review",
      type: "review-and-confirm",
      label: "Review",
      resumable: true,
      config: { ctaLabel: "Looks right" },
    },
  ],
  completionContract: {
    required: ["contacts", "confirmedAt"],
    verify: async (p) => {
      if (!Array.isArray(p.contacts) || p.contacts.length === 0) {
        return { ok: false, reason: "At least one contact is required." };
      }
      for (const c of p.contacts) {
        if (!c.name?.trim()) return { ok: false, reason: "Every contact needs a name." };
        if (!c.email?.trim()) return { ok: false, reason: "Every contact needs an email." };
      }
      return { ok: true };
    },
    artefacts: {
      activityLog: "onboarding_practical_setup_step_completed",
    },
  },
  voiceTreatment: {
    introCopy: "Who are the key people we should know about?",
    outroCopy: "Got them. We'll know who to talk to.",
    tabTitlePool: {
      setup: ["SuperBad \u2014 your people"],
      connecting: ["Saving\u2026"],
      confirming: ["Confirming\u2026"],
      connected: ["Contacts saved."],
      stuck: ["Contacts \u2014 stuck?"],
    },
  },
};

registerWizard(practicalContactDetailsWizard);

// ── 2. Ad Account Access ──────────────────────────────────────────────

export type AdAccountPayload = {
  metaBusinessManagerId?: string;
  googleAdsCustomerId?: string;
  confirmedAt: number;
};

export const practicalAdAccountsWizard: WizardDefinition<AdAccountPayload> = {
  key: "practical-ad-accounts",
  audience: "client",
  renderMode: "slideover",
  steps: [
    {
      key: "meta-access",
      type: "form",
      label: "Meta Business Manager",
      resumable: true,
      config: {
        instruction:
          "If you run ads on Facebook or Instagram, we'll need access to your Meta Business Manager. Here's how to grant it \u2014 takes about 2 minutes.",
      },
    },
    {
      key: "google-ads-access",
      type: "form",
      label: "Google Ads",
      resumable: true,
      config: {
        instruction:
          "If you run Google Ads, we'll need your Customer ID. You'll find it in the top-right corner of your Google Ads dashboard.",
      },
    },
    {
      key: "review",
      type: "review-and-confirm",
      label: "Review",
      resumable: true,
      config: { ctaLabel: "All done" },
    },
  ],
  completionContract: {
    required: ["confirmedAt"],
    verify: async () => {
      // Both ad accounts are optional — some businesses don't run ads.
      // The confirm step is the gate.
      return { ok: true };
    },
    artefacts: {
      activityLog: "onboarding_practical_setup_step_completed",
    },
  },
  voiceTreatment: {
    introCopy: "Ad account access \u2014 so we can see what's running.",
    outroCopy: "Ad accounts sorted. We can see your campaigns now.",
    tabTitlePool: {
      setup: ["SuperBad \u2014 ad accounts"],
      connecting: ["Saving\u2026"],
      confirming: ["Confirming\u2026"],
      connected: ["Ad accounts connected."],
      stuck: ["Ad accounts \u2014 stuck?"],
    },
  },
};

registerWizard(practicalAdAccountsWizard);

// ── 3. Content Archive ────────────────────────────────────────────────

export type ContentArchivePayload = {
  links: Array<{
    platform: string;
    url: string;
    description?: string;
  }>;
  confirmedAt: number;
};

export const practicalContentArchiveWizard: WizardDefinition<ContentArchivePayload> = {
  key: "practical-content-archive",
  audience: "client",
  renderMode: "slideover",
  steps: [
    {
      key: "add-links",
      type: "form",
      label: "Your content",
      resumable: true,
      config: {
        instruction:
          "Where do you keep your existing photos, videos, brand assets? Drop the links \u2014 Google Drive, Dropbox, whatever you use.",
      },
    },
    {
      key: "review",
      type: "review-and-confirm",
      label: "Review",
      resumable: true,
      config: { ctaLabel: "That's everything" },
    },
  ],
  completionContract: {
    required: ["confirmedAt"],
    verify: async () => {
      // Links are optional — the client may not have a content archive.
      // The confirm step is the gate.
      return { ok: true };
    },
    artefacts: {
      activityLog: "onboarding_practical_setup_step_completed",
    },
  },
  voiceTreatment: {
    introCopy: "Where does your content live?",
    outroCopy: "Content archive linked. We'll find our way around.",
    tabTitlePool: {
      setup: ["SuperBad \u2014 content archive"],
      connecting: ["Saving\u2026"],
      confirming: ["Confirming\u2026"],
      connected: ["Archive linked."],
      stuck: ["Content archive \u2014 stuck?"],
    },
  },
};

registerWizard(practicalContentArchiveWizard);
