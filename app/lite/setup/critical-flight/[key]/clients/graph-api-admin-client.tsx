"use client";

/**
 * graph-api-admin per-wizard client. Three-step arc:
 *   oauth-consent → review-and-confirm → celebration.
 *
 * Structurally different from stripe-admin/resend: no api-key-paste step.
 * The oauth-consent step redirects to Microsoft's consent screen; the
 * callback route at /api/oauth/graph-api/callback hands the access token
 * back by storing it in a short-lived signed cookie which a Server Action
 * then claims on return. SW-7-b hardens that flow; this session ships the
 * skeleton + tests.
 *
 * Test-only injection path: when `allowTestTokenInjection` is true (derived
 * from NODE_ENV !== "production" on the server component), a `?testToken=…`
 * query param prefills `state.token` so the Playwright E2E can exercise the
 * full arc without registering an Azure app. Gated by construction on the
 * server side — prod pages never set the flag.
 *
 * Owner: SW-7.
 */
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import { completeGraphAdminAction } from "../actions-graph";
import type { GraphAdminPayload } from "@/lib/wizards/defs/graph-api-admin";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import {
  useCriticalFlightShell,
  type StepStates,
} from "./use-critical-flight-shell";

type OAuthConsentState = {
  token: string | null;
  vendorLabel: string;
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type GraphAdminClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
  authorizeUrl: string;
  allowTestTokenInjection: boolean;
};

function initialGraphStates(outroCopy: string): StepStates {
  return {
    consent: {
      token: null,
      vendorLabel: "Microsoft",
    } satisfies OAuthConsentState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
}

function tokenSuffix(token: string | null): string {
  if (!token) return "(not yet)";
  const tail = token.slice(-6);
  return `…${tail}`;
}

function buildReviewSummary(states: StepStates) {
  const consent = states.consent as OAuthConsentState;
  return [
    { label: "Microsoft account", value: consent.token ? "Authorised ✓" : "Not yet" },
    { label: "Access token", value: tokenSuffix(consent.token) },
  ];
}

export function GraphAdminClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
  authorizeUrl,
  allowTestTokenInjection,
}: GraphAdminClientProps) {
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
    initialStates: initialGraphStates(outroCopy),
  });

  const searchParams = useSearchParams();

  // Test-only direct-token injection. Only honoured when the server page
  // flagged the environment as safe (dev/test). Production pages never set
  // the flag, so a ?testToken=... hitting production is a no-op.
  React.useEffect(() => {
    if (!allowTestTokenInjection) return;
    const injected = searchParams.get("testToken");
    if (!injected) return;
    setStates((prev) => {
      const current = prev.consent as OAuthConsentState;
      if (current.token === injected) return prev;
      return {
        ...prev,
        consent: { ...current, token: injected },
      };
    });
  }, [allowTestTokenInjection, searchParams, setStates]);

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
    const consent = states.consent as OAuthConsentState;
    const reviewed = states.review as ReviewState;
    if (!consent.token) {
      return { ok: false, reason: "Microsoft consent never returned a token." };
    }
    const payload: GraphAdminPayload = {
      accessToken: consent.token,
      verifiedAt: consent.token ? Date.now() : 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeGraphAdminAction(payload);
  }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "oauth-consent") {
      return {
        ...step,
        config: {
          ...(step.config ?? {}),
          vendorLabel: "Microsoft",
          authorizeUrl,
        },
      };
    }
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    return step;
  }, [step, authorizeUrl, onComplete, onDone]);

  return (
    <WizardShell
      wizardKey="graph-api-admin"
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
