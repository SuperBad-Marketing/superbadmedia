"use client";

import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import {
  testMediumTokenAction,
  completeMediumAction,
} from "../actions-medium";
import type { MediumPayload } from "@/lib/wizards/defs/medium";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { useAdminShell, type StepStates } from "./use-admin-shell";

type PastedKeyState = {
  key: string;
  verified: boolean;
  maskedSuffix: string | null;
  error: string | null;
  userId: string;
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type MediumClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
};

function initialMediumStates(outroCopy: string): StepStates {
  return {
    "paste-key": {
      key: "",
      verified: false,
      maskedSuffix: null,
      error: null,
      userId: "",
    } satisfies PastedKeyState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
}

function buildReviewSummary(states: StepStates) {
  const pasted = states["paste-key"] as PastedKeyState;
  return [
    { label: "Service", value: "Medium" },
    { label: "Integration token", value: pasted.maskedSuffix ?? "(not tested)" },
    { label: "Syndication", value: "Blog posts with canonical backlink" },
  ];
}

export function MediumClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
}: MediumClientProps) {
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
    initialStates: initialMediumStates(outroCopy),
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
    const payload: MediumPayload = {
      integrationToken: pasted.key,
      userId: pasted.userId,
      verifiedAt: pasted.verified ? Date.now() : 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeMediumAction(payload);
  }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "api-key-paste") {
      return {
        ...step,
        config: {
          ...(step.config ?? {}),
          label: "Medium integration token",
          testCall: async (key: string) => {
            const result = await testMediumTokenAction(key);
            if (result.ok) {
              setStates((prev) => ({
                ...prev,
                "paste-key": {
                  ...(prev["paste-key"] as PastedKeyState),
                  userId: result.userId,
                },
              }));
            }
            return result;
          },
        },
      };
    }
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    return step;
  }, [step, onComplete, onDone, setStates]);

  return (
    <WizardShell
      wizardKey="medium"
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
