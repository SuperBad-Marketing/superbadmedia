"use client";

import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import { completeCloudinaryAction } from "../actions-cloudinary";
import type { CloudinaryPayload } from "@/lib/wizards/defs/cloudinary";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { useAdminShell, type StepStates } from "./use-admin-shell";

type CredentialsState = {
  values: { cloudName: string; apiKey: string; apiSecret: string };
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type CloudinaryAdminClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
};

function initialCloudinaryStates(outroCopy: string): StepStates {
  return {
    credentials: {
      values: { cloudName: "", apiKey: "", apiSecret: "" },
    } satisfies CredentialsState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
}

function maskSecret(s: string): string {
  if (s.length <= 6) return "••••••";
  return s.slice(0, 3) + "•".repeat(s.length - 6) + s.slice(-3);
}

function buildReviewSummary(states: StepStates) {
  const creds = states.credentials as CredentialsState;
  return [
    { label: "Cloud name", value: creds.values.cloudName || "(not set)" },
    { label: "API key", value: creds.values.apiKey || "(not set)" },
    {
      label: "API secret",
      value: creds.values.apiSecret
        ? maskSecret(creds.values.apiSecret)
        : "(not set)",
    },
  ];
}

export function CloudinaryAdminClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
}: CloudinaryAdminClientProps) {
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
    initialStates: initialCloudinaryStates(outroCopy),
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

  const onComplete =
    React.useCallback(async (): Promise<CelebrationCompleteResult> => {
      const creds = states.credentials as CredentialsState;
      const reviewed = states.review as ReviewState;
      const payload: CloudinaryPayload = {
        cloudName: creds.values.cloudName.trim(),
        apiKey: creds.values.apiKey.trim(),
        apiSecret: creds.values.apiSecret.trim(),
        verifiedAt: Date.now(),
        confirmedAt: reviewed.confirmed ? Date.now() : 0,
      };
      return completeCloudinaryAction(payload);
    }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    return step;
  }, [step, onComplete, onDone]);

  return (
    <WizardShell
      wizardKey="cloudinary"
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
