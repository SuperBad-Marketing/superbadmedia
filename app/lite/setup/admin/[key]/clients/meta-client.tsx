"use client";

/**
 * meta per-wizard client. Three-step arc:
 *   oauth-consent → review-and-confirm → celebration.
 *
 * Renamed from meta-ads-client. Same OAuth flow but scopes now include
 * Instagram permissions. On completion, the server action auto-discovers
 * and connects the Instagram Business Account.
 *
 * Owner: SW-10. Extended by Instagram channel session.
 */
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import { completeMetaAction, decryptMetaTokenAction } from "../actions-meta";
import type { MetaPayload } from "@/lib/wizards/defs/meta";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { useAdminShell, type StepStates } from "./use-admin-shell";

type OAuthConsentState = {
  token: string | null;
  vendorLabel: string;
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type MetaClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
  authorizeUrl: string;
  allowTestTokenInjection: boolean;
};

function initialMetaStates(outroCopy: string): StepStates {
  return {
    consent: {
      token: null,
      vendorLabel: "Meta",
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
    { label: "Meta account", value: consent.token ? "Authorised" : "Not yet" },
    { label: "Access token", value: tokenSuffix(consent.token) },
    { label: "Instagram", value: consent.token ? "Will auto-discover on confirm" : "Pending" },
  ];
}

export function MetaClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
  authorizeUrl,
  allowTestTokenInjection,
}: MetaClientProps) {
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
    initialStates: initialMetaStates(outroCopy),
  });

  const searchParams = useSearchParams();
  const [oauthError, setOauthError] = React.useState<string | null>(null);

  const advanceRef = React.useRef(advance);
  advanceRef.current = advance;

  React.useEffect(() => {
    const oauthParam = searchParams.get("oauth");
    if (oauthParam === "error") {
      setOauthError(searchParams.get("reason") ?? "OAuth failed — Meta returned an error.");
      return;
    }
    if (oauthParam !== "success") return;
    const ct = searchParams.get("ct");
    if (!ct) {
      setOauthError("OAuth completed but no token was received. Try again.");
      return;
    }
    decryptMetaTokenAction(ct).then((result) => {
      if (!result.ok) {
        setOauthError(result.reason);
        return;
      }
      setStates((prev) => {
        const current = prev.consent as OAuthConsentState;
        if (current.token) return prev;
        return {
          ...prev,
          consent: { ...current, token: result.accessToken },
        };
      });
      setTimeout(() => advanceRef.current(), 100);
    });
  }, [searchParams, setStates]);

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
      return { ok: false, reason: "Meta consent never returned a token." };
    }
    const payload: MetaPayload = {
      accessToken: consent.token,
      verifiedAt: consent.token ? Date.now() : 0,
      confirmedAt: reviewed.confirmed ? Date.now() : 0,
    };
    return completeMetaAction(payload);
  }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "oauth-consent") {
      return {
        ...step,
        config: {
          ...(step.config ?? {}),
          vendorLabel: "Meta",
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
      wizardKey="meta"
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
