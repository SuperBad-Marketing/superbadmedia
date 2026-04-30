"use client";

import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import { completeLinkedinArticlesAction } from "../actions-linkedin-articles";
import {
  type LinkedinArticlesPayload,
  maskLinkedinToken,
  maskLinkedinUrn,
  linkedinArticlesSchema,
} from "@/lib/wizards/defs/linkedin-articles";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { useAdminShell, type StepStates } from "./use-admin-shell";

type PasteCredentialsState = {
  values: { accessToken: string; authorUrn: string };
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type LinkedinArticlesClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
};

function initialLinkedinStates(outroCopy: string): StepStates {
  return {
    "paste-credentials": {
      values: { accessToken: "", authorUrn: "" },
    } satisfies PasteCredentialsState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
}

function buildReviewSummary(states: StepStates) {
  const pasted = states["paste-credentials"] as PasteCredentialsState;
  const token = (pasted.values.accessToken ?? "").trim();
  const urn = (pasted.values.authorUrn ?? "").trim();
  return [
    { label: "Access token", value: token ? maskLinkedinToken(token) : "(not set)" },
    { label: "Author URN", value: urn ? maskLinkedinUrn(urn) : "(not set)" },
  ];
}

export function LinkedinArticlesClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
}: LinkedinArticlesClientProps) {
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
    initialStates: initialLinkedinStates(outroCopy),
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
    const accessToken = pasted.values.accessToken.trim();
    const authorUrn = pasted.values.authorUrn.trim();
    const payload: LinkedinArticlesPayload = {
      accessToken,
      authorUrn,
      verifiedAt: 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeLinkedinArticlesAction(payload);
  }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    if (step.type === "form") {
      return { ...step, config: { ...step.config, schema: linkedinArticlesSchema } };
    }
    return step;
  }, [step, onComplete, onDone]);

  return (
    <WizardShell
      wizardKey="linkedin_articles"
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
