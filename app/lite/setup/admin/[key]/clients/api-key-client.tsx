"use client";

/**
 * api-key per-wizard client (SW-13) — generic, vendor-selected via prop.
 * Three-step arc: api-key-paste → review-and-confirm → celebration.
 *
 * The vendor identity is a URL query param resolved server-side in
 * `page.tsx` and handed in as `vendor` + `vendorLabel` — this client
 * itself is vendor-agnostic; it just threads the vendor through to the
 * test-call + completion action.
 *
 * Owner: SW-13. Mirrors `resend-client.tsx` on the critical tree.
 */
import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import {
  testApiKeyAction,
  completeApiKeyAction,
} from "../actions-api-key";
import type {
  ApiKeyPayload,
  ApiKeyVendor,
} from "@/lib/wizards/defs/api-key";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { useAdminShell, type StepStates } from "./use-admin-shell";

type PastedKeyState = {
  key: string;
  verified: boolean;
  maskedSuffix: string | null;
  error: string | null;
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type ApiKeyClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
  vendor: ApiKeyVendor;
  vendorLabel: string;
};

function initialApiKeyStates(outroCopy: string): StepStates {
  return {
    "paste-key": {
      key: "",
      verified: false,
      maskedSuffix: null,
      error: null,
    } satisfies PastedKeyState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
}

function buildReviewSummary(
  states: StepStates,
  vendorLabel: string,
) {
  const pasted = states["paste-key"] as PastedKeyState;
  return [
    { label: "Vendor", value: vendorLabel },
    { label: `${vendorLabel} key`, value: pasted.maskedSuffix ?? "(not tested)" },
  ];
}

export function ApiKeyClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
  vendor,
  vendorLabel,
}: ApiKeyClientProps) {
  const {
    index,
    step,
    states,
    setStates,
    stepState,
    onStepStateChange,
    advance,
    handleCancel,
    onDone,
  } = useAdminShell({
    steps,
    initialStates: initialApiKeyStates(outroCopy),
  });

  React.useEffect(() => {
    if (step.type !== "review-and-confirm") return;
    setStates((prev) => {
      const next = buildReviewSummary(prev, vendorLabel);
      const current = (prev.review as { summary?: unknown[] } | undefined)
        ?.summary;
      if (
        Array.isArray(current) &&
        current.length === next.length &&
        current.every(
          (r, i) =>
            typeof r === "object" &&
            r !== null &&
            (r as { label?: string }).label === next[i].label &&
            (r as { value?: string }).value === next[i].value,
        )
      ) {
        return prev;
      }
      return {
        ...prev,
        review: { ...(prev.review as object), summary: next },
      };
    });
  }, [step.type, setStates, vendorLabel]);

  const onComplete = React.useCallback(async (): Promise<CelebrationCompleteResult> => {
    const pasted = states["paste-key"] as PastedKeyState;
    const reviewed = states.review as ReviewState;
    const payload: ApiKeyPayload = {
      vendor,
      apiKey: pasted.key,
      verifiedAt: pasted.verified ? Date.now() : 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeApiKeyAction(payload);
  }, [states, vendor]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "api-key-paste") {
      return {
        ...step,
        config: {
          ...(step.config ?? {}),
          label:
            (step.config as { label?: string } | undefined)?.label ??
            `${vendorLabel} API key`,
          testCall: async (key: string) => testApiKeyAction(vendor, key),
        },
      };
    }
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    return step;
  }, [step, onComplete, onDone, vendor, vendorLabel]);

  return (
    <WizardShell
      wizardKey="api-key"
      currentStep={index}
      stepLabels={steps.map((s) => s.label)}
      audience={audience}
      expiryDays={expiryDays}
      onCancel={handleCancel}
      step={configuredStep}
      stepState={stepState}
      onStepStateChange={onStepStateChange}
      onNext={advance}
    />
  );
}
