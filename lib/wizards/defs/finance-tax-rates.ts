import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";
import settings from "@/lib/settings";

export type FinanceTaxRatesPayload = {
  gst_rate: number;
  income_tax_rate: number;
  confirmedAt: number;
};

export const financeTaxRatesWizard: WizardDefinition<FinanceTaxRatesPayload> = {
  key: "finance-tax-rates",
  audience: "admin",
  renderMode: "slideover",
  steps: [
    {
      key: "gst-rate",
      type: "form",
      label: "GST rate",
      resumable: true,
      config: {
        instruction: "What GST rate applies to your business?",
        fields: [
          {
            key: "gst_rate",
            type: "numeric_preset",
            presets: [
              { label: "Standard 10% (most AU businesses)", value: 0.1 },
              { label: "I'm not GST-registered", value: 0 },
            ],
          },
        ],
      },
    },
    {
      key: "income-tax-rate",
      type: "form",
      label: "Income tax rate",
      resumable: true,
      config: {
        instruction: "What income tax rate should we use to provision? Check with your accountant if you're unsure.",
        fields: [
          {
            key: "income_tax_rate",
            type: "numeric_preset",
            presets: [
              { label: "Sole trader — check with your accountant", value: 0.25 },
              { label: "Company — 25% small business rate", value: 0.25 },
              { label: "Company — 30% standard rate", value: 0.3 },
            ],
          },
        ],
      },
    },
    {
      key: "review",
      type: "review-and-confirm",
      label: "Confirm",
      resumable: true,
      config: { ctaLabel: "Looks right" },
    },
  ],
  completionContract: {
    required: ["gst_rate", "income_tax_rate", "confirmedAt"],
    verify: async (payload) => {
      if (typeof payload.gst_rate !== "number" || payload.gst_rate < 0) {
        return { ok: false, reason: "GST rate must be a non-negative number." };
      }
      if (typeof payload.income_tax_rate !== "number" || payload.income_tax_rate <= 0) {
        return { ok: false, reason: "Income tax rate must be a positive number." };
      }

      await settings.set("finance.gst_rate", String(payload.gst_rate));
      await settings.set("finance.income_tax_rate", String(payload.income_tax_rate));

      return { ok: true };
    },
    artefacts: {
      activityLog: "wizard_completed",
    },
  },
  voiceTreatment: {
    introCopy: "Tax rates — so the finance dashboard knows how much is actually yours.",
    outroCopy: "Rates locked. The dashboard will use these for GST and income tax provisioning.",
    tabTitlePool: {
      setup: ["SuperBad — tax rates"],
      connecting: ["Saving…"],
      confirming: ["Confirming…"],
      connected: ["Tax rates saved."],
      stuck: ["Tax rates — stuck?"],
    },
  },
};

registerWizard(financeTaxRatesWizard);
