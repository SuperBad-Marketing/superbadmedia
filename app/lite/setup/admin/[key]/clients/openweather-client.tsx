"use client";

import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import {
  testOpenWeatherKeyAction,
  completeOpenWeatherAction,
} from "../actions-openweather";
import type { OpenWeatherPayload } from "@/lib/wizards/defs/openweather";
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

export type OpenWeatherClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
};

function initialStates(outroCopy: string): StepStates {
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
    { label: "Service", value: "OpenWeather" },
    { label: "API key", value: pasted.maskedSuffix ?? "(not tested)" },
    { label: "Features", value: "Melbourne weather on cockpit ticker" },
  ];
}

export function OpenWeatherClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
}: OpenWeatherClientProps) {
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
    initialStates: initialStates(outroCopy),
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
    const payload: OpenWeatherPayload = {
      apiKey: pasted.key,
      verifiedAt: pasted.verified ? Date.now() : 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeOpenWeatherAction(payload);
  }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "api-key-paste") {
      return {
        ...step,
        config: {
          ...(step.config ?? {}),
          label: "OpenWeather API key",
          testCall: async (key: string) => testOpenWeatherKeyAction(key),
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
      wizardKey="openweather"
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
