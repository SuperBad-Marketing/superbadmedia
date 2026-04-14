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
 * SW-6 branches by `wizardKey` between `stripe-admin` (api-key-paste →
 * webhook-probe → review → celebration) and `resend` (api-key-paste →
 * review → celebration — no webhook). A third wizard (graph-api-admin,
 * SW-7) will revisit whether the wizardKey-branch pattern still reads
 * cleanly or should be split into per-wizard client files.
 *
 * Owner: SW-5 (stripe-admin branch), SW-6 (resend branch + branching).
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
import {
  testResendKeyAction,
  completeResendAction,
} from "./actions-resend";
import type { StripeAdminPayload } from "@/lib/wizards/defs/stripe-admin";
import type { ResendAdminPayload } from "@/lib/wizards/defs/resend";
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

function initialStates(wizardKey: string, outroCopy: string): StepStates {
  const base: StepStates = {
    "paste-key": {
      key: "",
      verified: false,
      maskedSuffix: null,
      error: null,
    } satisfies PastedKeyState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
  if (wizardKey === "stripe-admin") {
    base["webhook-probe"] = {
      endpoint: "https://api.stripe.com → /api/stripe/webhook",
      received: false,
      receivedAtMs: null,
    } satisfies WebhookProbeState;
  }
  return base;
}

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
  const [states, setStates] = React.useState<StepStates>(() =>
    initialStates(wizardKey, outroCopy),
  );
  const [webhookSince] = React.useState(() => Date.now());

  const step = steps[index];

  // Keep the review step's summary fresh as upstream steps populate state.
  React.useEffect(() => {
    if (step.type !== "review-and-confirm") return;
    setStates((prev) => {
      const next = buildReviewSummary(wizardKey, prev);
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
  }, [step.type, wizardKey]);

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
    const pasted = states["paste-key"] as PastedKeyState;
    const reviewed = states.review as ReviewState;
    if (wizardKey === "stripe-admin") {
      const webhook = states["webhook-probe"] as WebhookProbeState;
      const payload: StripeAdminPayload = {
        apiKey: pasted.key,
        verifiedAt: pasted.verified ? Date.now() : 0,
        webhookReceivedAt: webhook.receivedAtMs ?? 0,
        confirmedAt: reviewed.confirmed ? Date.now() : 0,
      };
      return completeStripeAdminAction(payload);
    }
    if (wizardKey === "resend") {
      const payload: ResendAdminPayload = {
        apiKey: pasted.key,
        verifiedAt: pasted.verified ? Date.now() : 0,
        confirmedAt: reviewed.confirmed ? Date.now() : 0,
      };
      return completeResendAction(payload);
    }
    return { ok: false, reason: `Unknown wizard: ${wizardKey}` };
  }, [wizardKey, states]);

  const onDone = React.useCallback(() => {
    router.refresh();
    router.push("/lite/first-run");
  }, [router]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "api-key-paste") {
      const testCall =
        wizardKey === "resend" ? testResendKeyAction : testStripeKeyAction;
      return {
        ...step,
        config: {
          ...(step.config ?? {}),
          label: (step.config as { label?: string } | undefined)?.label ?? "API key",
          testCall: async (key: string) => testCall(key),
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
  }, [step, wizardKey, webhookProbeTimeoutMs, webhookSince, onComplete, onDone]);

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
  wizardKey: string,
  states: StepStates,
): { label: string; value: string }[] {
  const pasted = states["paste-key"] as PastedKeyState;
  if (wizardKey === "stripe-admin") {
    const webhook = states["webhook-probe"] as WebhookProbeState;
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
  if (wizardKey === "resend") {
    return [
      {
        label: "Resend key",
        value: pasted.maskedSuffix ?? "(not tested)",
      },
    ];
  }
  return [];
}
