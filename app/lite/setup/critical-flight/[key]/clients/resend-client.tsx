"use client";

/**
 * resend per-wizard client. Three-step arc:
 *   api-key-paste → review-and-confirm → celebration. No webhook-probe —
 * Resend has no provisioning-time handshake.
 *
 * Owner: SW-7 (split out of the prior monolithic critical-flight-client).
 * History: resend branch originally landed in SW-6.
 */
import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import {
  testResendKeyAction,
  completeResendAction,
} from "../actions-resend";
import type { ResendAdminPayload } from "@/lib/wizards/defs/resend";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import {
  useCriticalFlightShell,
  type StepStates,
} from "./use-critical-flight-shell";

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

export type ResendClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
};

function initialResendStates(outroCopy: string): StepStates {
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

function buildReviewSummary(states: StepStates) {
  const pasted = states["paste-key"] as PastedKeyState;
  return [
    { label: "Resend key", value: pasted.maskedSuffix ?? "(not tested)" },
  ];
}

export function ResendClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
}: ResendClientProps) {
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
  } = useCriticalFlightShell({
    steps,
    initialStates: initialResendStates(outroCopy),
  });

  React.useEffect(() => {
    if (step.type !== "review-and-confirm") return;
    setStates((prev) => {
      const next = buildReviewSummary(prev);
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
  }, [step.type, setStates]);

  const onComplete = React.useCallback(async (): Promise<CelebrationCompleteResult> => {
    const pasted = states["paste-key"] as PastedKeyState;
    const reviewed = states.review as ReviewState;
    const payload: ResendAdminPayload = {
      apiKey: pasted.key,
      verifiedAt: pasted.verified ? Date.now() : 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeResendAction(payload);
  }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "api-key-paste") {
      return {
        ...step,
        config: {
          ...(step.config ?? {}),
          label:
            (step.config as { label?: string } | undefined)?.label ?? "API key",
          testCall: async (key: string) => testResendKeyAction(key),
        },
      };
    }
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    return step;
  }, [step, onComplete, onDone]);

  return (
    <WizardShell
      wizardKey="resend"
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
