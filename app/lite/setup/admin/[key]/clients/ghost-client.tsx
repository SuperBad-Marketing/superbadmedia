"use client";

import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import { completeGhostAction } from "../actions-ghost";
import {
  type GhostPayload,
  maskGhostKey,
  maskGhostUrl,
  ghostCredentialsSchema,
} from "@/lib/wizards/defs/ghost";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { useAdminShell, type StepStates } from "./use-admin-shell";

type PasteCredentialsState = {
  values: { adminApiKey: string; adminUrl: string };
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type GhostClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
};

function initialGhostStates(outroCopy: string): StepStates {
  return {
    "paste-credentials": {
      values: { adminApiKey: "", adminUrl: "" },
    } satisfies PasteCredentialsState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
}

function buildReviewSummary(states: StepStates) {
  const pasted = states["paste-credentials"] as PasteCredentialsState;
  const key = (pasted.values.adminApiKey ?? "").trim();
  const url = (pasted.values.adminUrl ?? "").trim();
  return [
    { label: "Admin API key", value: key ? maskGhostKey(key) : "(not set)" },
    { label: "Blog URL", value: url ? maskGhostUrl(url) : "(not set)" },
  ];
}

export function GhostClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
}: GhostClientProps) {
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
    initialStates: initialGhostStates(outroCopy),
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
    const pasted = states["paste-credentials"] as PasteCredentialsState;
    const reviewed = states.review as ReviewState;
    const adminApiKey = pasted.values.adminApiKey.trim();
    const adminUrl = pasted.values.adminUrl.trim();
    const payload: GhostPayload = {
      adminApiKey,
      adminUrl,
      verifiedAt: 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeGhostAction(payload);
  }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    if (step.type === "form") {
      return { ...step, config: { ...step.config, schema: ghostCredentialsSchema } };
    }
    return step;
  }, [step, onComplete, onDone]);

  return (
    <WizardShell
      wizardKey="ghost"
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
