/**
 * `STEP_TYPE_REGISTRY` — string-keyed map from `WizardStepType` to its
 * `StepTypeDefinition`. `<WizardShell>` (SW-2 edit) resolves a step's
 * Component + resume + validate through this map.
 *
 * Owner: SW-2. Spec: docs/specs/setup-wizards.md §4.
 */

import type { StepTypeDefinition } from "@/lib/wizards/step-types";
import type { WizardStepType } from "@/lib/wizards/types";

import { formStep } from "./form-step";
import { oauthConsentStep } from "./oauth-consent-step";
import { apiKeyPasteStep } from "./api-key-paste-step";
import { webhookProbeStep } from "./webhook-probe-step";
import { dnsVerifyStep } from "./dns-verify-step";
import { csvImportStep } from "./csv-import-step";
import { asyncCheckStep } from "./async-check-step";
import { contentPickerStep } from "./content-picker-step";
import { reviewConfirmStep } from "./review-confirm-step";
import { celebrationStep } from "./celebration-step";
import { customStep } from "./custom-step";

export {
  formStep,
  oauthConsentStep,
  apiKeyPasteStep,
  webhookProbeStep,
  dnsVerifyStep,
  csvImportStep,
  asyncCheckStep,
  contentPickerStep,
  reviewConfirmStep,
  celebrationStep,
  customStep,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const STEP_TYPE_REGISTRY: Record<WizardStepType, StepTypeDefinition<any>> = {
  form: formStep,
  "oauth-consent": oauthConsentStep,
  "api-key-paste": apiKeyPasteStep,
  "webhook-probe": webhookProbeStep,
  "dns-verify": dnsVerifyStep,
  "csv-import": csvImportStep,
  "async-check": asyncCheckStep,
  "content-picker": contentPickerStep,
  "review-and-confirm": reviewConfirmStep,
  celebration: celebrationStep,
  custom: customStep,
};

export type { StepTypeDefinition, StepComponentProps } from "@/lib/wizards/step-types";
