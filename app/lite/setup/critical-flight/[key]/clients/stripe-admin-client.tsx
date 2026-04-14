"use client";

/**
 * stripe-admin per-wizard client. Drives the four-step arc:
 *   api-key-paste → webhook-probe → review-and-confirm → celebration.
 *
 * Owns stripe-specific state shapes + onComplete payload shape. Shares the
 * index / state bag / navigation skeleton via `useCriticalFlightShell`.
 *
 * Owner: SW-7 (split out of the prior monolithic critical-flight-client).
 * History: stripe-admin branch originally landed in SW-5.
 */
import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import {
  testStripeKeyAction,
  checkStripeWebhookReceivedAction,
  completeStripeAdminAction,
} from "../actions";
import type { StripeAdminPayload } from "@/lib/wizards/defs/stripe-admin";
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

type WebhookProbeState = {
  endpoint: string;
  received: boolean;
  receivedAtMs: number | null;
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type StripeAdminClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
  webhookProbeTimeoutMs: number;
};

function initialStripeStates(outroCopy: string): StepStates {
  return {
    "paste-key": {
      key: "",
      verified: false,
      maskedSuffix: null,
      error: null,
    } satisfies PastedKeyState,
    "webhook-probe": {
      endpoint: "https://api.stripe.com → /api/stripe/webhook",
      received: false,
      receivedAtMs: null,
    } satisfies WebhookProbeState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
}

function buildReviewSummary(states: StepStates) {
  const pasted = states["paste-key"] as PastedKeyState;
  const webhook = states["webhook-probe"] as WebhookProbeState;
  return [
    { label: "Stripe key", value: pasted.maskedSuffix ?? "(not tested)" },
    { label: "Webhook", value: webhook.received ? "Received ✓" : "Not yet" },
  ];
}

export function StripeAdminClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
  webhookProbeTimeoutMs,
}: StripeAdminClientProps) {
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
    initialStates: initialStripeStates(outroCopy),
  });

  const [webhookSince] = React.useState(() => Date.now());

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
    const webhook = states["webhook-probe"] as WebhookProbeState;
    const reviewed = states.review as ReviewState;
    const payload: StripeAdminPayload = {
      apiKey: pasted.key,
      verifiedAt: pasted.verified ? Date.now() : 0,
      webhookReceivedAt: webhook.receivedAtMs ?? 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeStripeAdminAction(payload);
  }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "api-key-paste") {
      return {
        ...step,
        config: {
          ...(step.config ?? {}),
          label:
            (step.config as { label?: string } | undefined)?.label ?? "API key",
          testCall: async (key: string) => testStripeKeyAction(key),
        },
      };
    }
    if (step.type === "webhook-probe") {
      return {
        ...step,
        config: {
          ...(step.config ?? {}),
          endpoint:
            (step.config as { endpoint?: string } | undefined)?.endpoint ??
            "/api/stripe/webhook",
          timeoutMs: webhookProbeTimeoutMs,
          checkReceived: async () =>
            checkStripeWebhookReceivedAction(webhookSince),
        },
      };
    }
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    return step;
  }, [step, webhookProbeTimeoutMs, webhookSince, onComplete, onDone]);

  return (
    <WizardShell
      wizardKey="stripe-admin"
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
