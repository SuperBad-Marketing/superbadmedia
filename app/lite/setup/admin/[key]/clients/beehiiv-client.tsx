"use client";

import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import { completeBeehiivAction } from "../actions-beehiiv";
import {
  type BeehiivPayload,
  maskBeehiivKey,
  maskBeehiivPubId,
  beehiivCredentialsSchema,
} from "@/lib/wizards/defs/beehiiv";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { useAdminShell, type StepStates } from "./use-admin-shell";

type PasteCredentialsState = {
  values: { apiKey: string; publicationId: string };
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type BeehiivClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
};

function initialBeehiivStates(outroCopy: string): StepStates {
  return {
    "paste-credentials": {
      values: { apiKey: "", publicationId: "" },
    } satisfies PasteCredentialsState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
}

function buildReviewSummary(states: StepStates) {
  const pasted = states["paste-credentials"] as PasteCredentialsState;
  const key = (pasted.values.apiKey ?? "").trim();
  const pubId = (pasted.values.publicationId ?? "").trim();
  return [
    { label: "API key", value: key ? maskBeehiivKey(key) : "(not set)" },
    { label: "Publication ID", value: pubId ? maskBeehiivPubId(pubId) : "(not set)" },
  ];
}

export function BeehiivClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
}: BeehiivClientProps) {
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
    initialStates: initialBeehiivStates(outroCopy),
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
    const apiKey = pasted.values.apiKey.trim();
    const publicationId = pasted.values.publicationId.trim();
    const payload: BeehiivPayload = {
      apiKey,
      publicationId,
      verifiedAt: 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeBeehiivAction(payload);
  }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    if (step.type === "form") {
      return { ...step, config: { ...step.config, schema: beehiivCredentialsSchema } };
    }
    return step;
  }, [step, onComplete, onDone]);

  return (
    <WizardShell
      wizardKey="beehiiv"
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
