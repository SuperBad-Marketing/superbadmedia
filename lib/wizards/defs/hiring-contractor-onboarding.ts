import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type ContractorOnboardingPayload = {
  candidateId: string;
  abn: string;
  legalName: string;
  agreementSignedAt: number;
  bankBsb: string;
  bankAccountNumber: string;
  bankAccountName: string;
  hourlyRateAud: number;
  weeklyCapacityHours: number;
  onboardingCompletedAt: number;
};

export const hiringContractorOnboardingWizard: WizardDefinition<ContractorOnboardingPayload> = {
  key: "hiring-contractor-onboarding",
  audience: "client",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "abn-legal-name",
      type: "form",
      label: "ABN & legal name",
      resumable: true,
      config: {
        fields: [
          { name: "abn", label: "ABN", type: "text", required: true },
          { name: "legalName", label: "Legal name", type: "text", required: true },
        ],
      },
    },
    {
      key: "agreement",
      type: "custom",
      label: "Agreement",
      resumable: false,
    },
    {
      key: "bank-details",
      type: "form",
      label: "Bank details",
      resumable: true,
      config: {
        fields: [
          { name: "bankBsb", label: "BSB", type: "text", required: true },
          { name: "bankAccountNumber", label: "Account number", type: "text", required: true },
          { name: "bankAccountName", label: "Account name", type: "text", required: true },
        ],
      },
    },
    {
      key: "rate-capacity",
      type: "review-and-confirm",
      label: "Confirm",
      resumable: true,
      config: { ctaLabel: "Complete onboarding" },
    },
  ],
  completionContract: {
    required: [
      "candidateId",
      "abn",
      "legalName",
      "agreementSignedAt",
      "bankBsb",
      "bankAccountNumber",
      "bankAccountName",
      "hourlyRateAud",
      "weeklyCapacityHours",
      "onboardingCompletedAt",
    ],
    verify: async () => ({ ok: true }),
    artefacts: { activityLog: "contractor_onboarding_completed" },
  },
  voiceTreatment: {
    introCopy:
      "Quick setup — ABN, agreement, bank details, and we're done.",
    outroCopy:
      "You're all set. Assignments will show up here when they're ready.",
    tabTitlePool: {
      setup: ["SuperBad — Getting you set up"],
      connecting: ["SuperBad — Almost there"],
      confirming: ["SuperBad — Confirming"],
      connected: ["SuperBad — You're in"],
      stuck: ["SuperBad — Need a hand?"],
    },
    capstone: undefined,
  },
};

registerWizard(hiringContractorOnboardingWizard);
