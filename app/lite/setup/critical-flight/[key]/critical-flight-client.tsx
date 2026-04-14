"use client";

/**
 * Client driver for /lite/setup/critical-flight/[key].
 *
 * Tracks current step index + accumulates per-step state into a single
 * wizard payload. At the celebration step, hands off to the server-action
 * orchestrator via `onComplete`. The wizard definition is consumed for its
 * serialisable step list + voice treatment; the non-serialisable contract
 * `verify` function stays on the server (invoked via actions).
 *
 * SW-5 ships only the stripe-admin branch: the step configs for api-key
 * testing + webhook probing are wired to stripe-specific Server Actions.
 * Future slices (Resend, graph-api-admin) branch by `wizardKey` as they
 * ship their own WizardDefinition + actions.
 *
 * Owner: SW-5.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import {
  testStripeKeyAction,
  checkStripeWebhookReceivedAction,
  completeStripeAdminAction,
} from "./actions";
import type { StripeAdminPayload } from "@/lib/wizards/defs/stripe-admin";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

export type CriticalFlightClientProps = {
  wizardKey: string;
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
  webhookProbeTimeoutMs: number;
};

type StepStates = Record<string, unknown>;

export function CriticalFlightClient({
  wizardKey,
  audience,
  steps,
  outroCopy,
  expiryDays,
  webhookProbeTimeoutMs,
}: CriticalFlightClientProps) {
  const router = useRouter();
  const [index, setIndex] = React.useState(0);
  const [states, setStates] = React.useState<StepStates>(() => ({
    "paste-key": {
      key: "",
      verified: false,
      maskedSuffix: null,
      error: null,
    },
    "webhook-probe": {
      endpoint: "https://api.stripe.com → /api/stripe/webhook",
      received: false,
      receivedAtMs: null,
    },
    review: { summary: [], confirmed: false },
    celebrate: { outroCopy, observatorySummary: null },
  }));
  const [webhookSince] = React.useState(() => Date.now());

  const step = steps[index];

  // Keep the review step's summary fresh as upstream steps populate state.
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
        review: {
          ...(prev.review as object),
          summary: next,
        },
      };
    });
  }, [step.type]);

  const stepState = states[step.key];
  const onStepStateChange = React.useCallback(
    (next: unknown) => {
      setStates((prev) => ({ ...prev, [step.key]: next }));
    },
    [step.key],
  );

  const advance = React.useCallback(() => {
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  const onComplete = React.useCallback(async (): Promise<CelebrationCompleteResult> => {
    const pasted = states["paste-key"] as {
      key: string;
      verified: boolean;
    };
    const webhook = states["webhook-probe"] as {
      received: boolean;
      receivedAtMs: number | null;
    };
    const reviewed = states.review as { confirmed: boolean };
    const payload: StripeAdminPayload = {
      apiKey: pasted.key,
      verifiedAt: pasted.verified ? Date.now() : 0,
      webhookReceivedAt: webhook.receivedAtMs ?? 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeStripeAdminAction(payload);
  }, [states]);

  const onDone = React.useCallback(() => {
    router.refresh();
    router.push("/lite/first-run");
  }, [router]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "api-key-paste") {
      return {
        ...step,
        config: {
          ...(step.config ?? {}),
          label: (step.config as { label?: string } | undefined)?.label ?? "API key",
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
    if (step.type === "review-and-confirm") {
      return step;
    }
    if (step.type === "celebration") {
      return {
        ...step,
        config: {
          onDone,
          onComplete,
        },
      };
    }
    return step;
  }, [step, webhookProbeTimeoutMs, webhookSince, onComplete, onDone]);

  const handleCancel = React.useCallback(() => {
    router.push("/lite/first-run");
  }, [router]);

  return (
    <WizardShell
      wizardKey={wizardKey}
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

function buildReviewSummary(
  states: StepStates,
): { label: string; value: string }[] {
  const pasted = states["paste-key"] as {
    maskedSuffix: string | null;
  };
  const webhook = states["webhook-probe"] as { received: boolean };
  return [
    {
      label: "Stripe key",
      value: pasted.maskedSuffix ?? "(not tested)",
    },
    {
      label: "Webhook",
      value: webhook.received ? "Received ✓" : "Not yet",
    },
  ];
}
