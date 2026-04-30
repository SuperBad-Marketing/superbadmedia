"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import {
  prepareSpotifyOAuthAction,
  completeSpotifyAction,
  decryptSpotifyTokenAction,
} from "../actions-spotify";
import {
  type SpotifyPayload,
  maskSpotifyClientId,
  maskSpotifySecret,
  spotifyCredentialsSchema,
} from "@/lib/wizards/defs/spotify";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { useAdminShell, type StepStates } from "./use-admin-shell";

type PasteCredentialsState = {
  values: { clientId: string; clientSecret: string };
};

type OAuthConsentState = {
  token: string | null;
  refreshToken: string | null;
  vendorLabel: string;
  authorizeUrl: string;
};

type ReviewState = {
  summary: { label: string; value: string }[];
  confirmed: boolean;
};

export type SpotifyClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
  allowTestTokenInjection: boolean;
};

function initialSpotifyStates(outroCopy: string): StepStates {
  return {
    "paste-credentials": {
      values: { clientId: "", clientSecret: "" },
    } satisfies PasteCredentialsState,
    consent: {
      token: null,
      refreshToken: null,
      vendorLabel: "Spotify",
      authorizeUrl: "#",
    } satisfies OAuthConsentState,
    review: { summary: [], confirmed: false } satisfies ReviewState,
    celebrate: { outroCopy, observatorySummary: null },
  };
}

function tokenSuffix(token: string | null): string {
  if (!token) return "(not yet)";
  return `…${token.slice(-6)}`;
}

function buildReviewSummary(states: StepStates) {
  const pasted = states["paste-credentials"] as PasteCredentialsState;
  const consent = states.consent as OAuthConsentState;
  const clientId = (pasted.values.clientId ?? "").trim();
  const clientSecret = (pasted.values.clientSecret ?? "").trim();
  return [
    { label: "Client ID", value: clientId ? maskSpotifyClientId(clientId) : "(not set)" },
    { label: "Client secret", value: clientSecret ? maskSpotifySecret(clientSecret) : "(not set)" },
    { label: "Spotify account", value: consent.token ? "Authorised" : "Not yet" },
    { label: "Access token", value: tokenSuffix(consent.token) },
  ];
}

export function SpotifyClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
  allowTestTokenInjection,
}: SpotifyClientProps) {
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
    initialStates: initialSpotifyStates(outroCopy),
  });

  const searchParams = useSearchParams();
  const [oauthError, setOauthError] = React.useState<string | null>(null);
  const advanceRef = React.useRef(advance);
  advanceRef.current = advance;

  // Build the OAuth authorize URL when advancing to the consent step
  const originalAdvance = advance;
  const wrappedAdvance = React.useCallback(async () => {
    if (step.type === "form") {
      const pasted = states["paste-credentials"] as PasteCredentialsState;
      const clientId = pasted.values.clientId.trim();
      const clientSecret = pasted.values.clientSecret.trim();
      const result = await prepareSpotifyOAuthAction(clientId, clientSecret);
      if (!result.ok) {
        setOauthError(result.reason);
        return;
      }
      setStates((prev) => ({
        ...prev,
        consent: {
          ...(prev.consent as OAuthConsentState),
          authorizeUrl: result.authorizeUrl,
        },
      }));
    }
    originalAdvance();
  }, [step.type, states, setStates, originalAdvance]);

  // Handle OAuth callback params
  React.useEffect(() => {
    const oauthParam = searchParams.get("oauth");
    if (oauthParam === "error") {
      setOauthError(
        searchParams.get("reason") ??
          "OAuth failed — Spotify returned an error.",
      );
      return;
    }
    if (oauthParam !== "success") return;
    const ct = searchParams.get("ct");
    if (!ct) {
      setOauthError(
        "OAuth completed but no token was received. Try again.",
      );
      return;
    }
    decryptSpotifyTokenAction(ct).then((result) => {
      if (!result.ok) {
        setOauthError(result.reason);
        return;
      }
      setStates((prev) => {
        const current = prev.consent as OAuthConsentState;
        if (current.token) return prev;
        return {
          ...prev,
          consent: {
            ...current,
            token: result.accessToken,
            refreshToken: result.refreshToken,
          },
        };
      });
      setTimeout(() => advanceRef.current(), 100);
    });
  }, [searchParams, setStates]);

  // Test token injection (dev only)
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

  // Build review summary
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

  const onComplete =
    React.useCallback(async (): Promise<CelebrationCompleteResult> => {
      const pasted = states["paste-credentials"] as PasteCredentialsState;
      const consent = states.consent as OAuthConsentState;
      const reviewed = states.review as ReviewState;
      if (!consent.token || !consent.refreshToken) {
        return {
          ok: false,
          reason: "Spotify consent never returned a token.",
        };
      }
      const payload: SpotifyPayload = {
        clientId: pasted.values.clientId.trim(),
        clientSecret: pasted.values.clientSecret.trim(),
        accessToken: consent.token,
        refreshToken: consent.refreshToken,
        verifiedAt: consent.token ? Date.now() : 0,
        confirmedAt: reviewed.confirmed ? Date.now() : 0,
      };
      return completeSpotifyAction(payload);
    }, [states]);

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "form") {
      return { ...step, config: { ...step.config, schema: spotifyCredentialsSchema } };
    }
    if (step.type === "oauth-consent") {
      const consent = states.consent as OAuthConsentState;
      return {
        ...step,
        config: {
          ...(step.config ?? {}),
          vendorLabel: "Spotify",
          authorizeUrl: consent.authorizeUrl,
        },
      };
    }
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    return step;
  }, [step, states, onComplete, onDone]);

  return (
    <WizardShell
      wizardKey="spotify"
      currentStep={index}
      stepLabels={steps.map((s) => s.label)}
      audience={audience}
      expiryDays={expiryDays}
      onCancel={handleCancel}
      step={configuredStep}
      stepState={stepState}
      onStepStateChange={onStepStateChange}
      onNext={wrappedAdvance}
    />
  );
}
