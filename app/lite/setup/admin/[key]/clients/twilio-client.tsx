"use client";

/**
 * twilio per-wizard client. Three-step arc:
 *   form (paste SID + Auth Token) → review-and-confirm → celebration.
 * Form step renders two fields generically from the Zod schema; the live
 * Twilio `GET /Accounts/<SID>.json` Basic-auth ping runs inside
 * `completionContract.verify` during the celebration orchestrator, so
 * there's no separate verify step in the UI.
 *
 * Owner: SW-12. Copied from `pixieset-admin-client.tsx` with two-field
 * form state + credential masking for the review summary.
 */
import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import { completeTwilioAction } from "../actions-twilio";
import {
  type TwilioPayload,
  maskTwilioSid,
  maskTwilioToken,
} from "@/lib/wizards/defs/twilio";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { useAdminShell, type StepStates } from "./use-admin-shell";

type PasteCredentialsState = {
  values: { accountSid: string; authToken: string };
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type TwilioClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
};

function initialTwilioStates(outroCopy: string): StepStates {
  return {
    "paste-credentials": {
      values: { accountSid: "", authToken: "" },
    } satisfies PasteCredentialsState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
}

function buildReviewSummary(states: StepStates) {
  const pasted = states["paste-credentials"] as PasteCredentialsState;
  const sid = (pasted.values.accountSid ?? "").trim();
  const token = (pasted.values.authToken ?? "").trim();
  return [
    { label: "Account SID", value: sid ? maskTwilioSid(sid) : "(not set)" },
    { label: "Auth Token", value: token ? maskTwilioToken(token) : "(not set)" },
  ];
}

export function TwilioClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
}: TwilioClientProps) {
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
    initialStates: initialTwilioStates(outroCopy),
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
    const accountSid = pasted.values.accountSid.trim();
    const authToken = pasted.values.authToken.trim();
    const payload: TwilioPayload = {
      accountSid,
      authToken,
      verifiedAt: 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeTwilioAction(payload);
  }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    return step;
  }, [step, onComplete, onDone]);

  return (
    <WizardShell
      wizardKey="twilio"
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
