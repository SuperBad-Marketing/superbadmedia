"use client";

/**
 * pixieset-admin per-wizard client. Three-step arc:
 *   form (paste gallery URL) → review-and-confirm → celebration. No
 *   verify-ping — per P0 spike outcome B, Pixieset has no public API and
 *   the form step's Zod schema is the only validation.
 *
 * Owner: SW-9.
 */
import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import { completePixiesetAction } from "../actions-pixieset";
import {
  type PixiesetAdminPayload,
  extractPixiesetSlug,
} from "@/lib/wizards/defs/pixieset-admin";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { useAdminShell, type StepStates } from "./use-admin-shell";

type PasteUrlState = {
  values: { url: string };
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type PixiesetAdminClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
};

function initialPixiesetStates(outroCopy: string): StepStates {
  return {
    "paste-url": { values: { url: "" } } satisfies PasteUrlState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
}

function buildReviewSummary(states: StepStates) {
  const pasted = states["paste-url"] as PasteUrlState;
  const url = pasted.values.url ?? "";
  const slug = extractPixiesetSlug(url);
  return [
    { label: "Gallery URL", value: url || "(not set)" },
    { label: "Slug", value: slug || "(unknown)" },
  ];
}

export function PixiesetAdminClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
}: PixiesetAdminClientProps) {
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
    initialStates: initialPixiesetStates(outroCopy),
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
    const pasted = states["paste-url"] as PasteUrlState;
    const reviewed = states.review as ReviewState;
    const url = pasted.values.url.trim();
    const payload: PixiesetAdminPayload = {
      galleryUrl: url,
      slug: extractPixiesetSlug(url),
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completePixiesetAction(payload);
  }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    return step;
  }, [step, onComplete, onDone]);

  return (
    <WizardShell
      wizardKey="pixieset-admin"
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
