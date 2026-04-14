"use client";

/**
 * `oauth-consent` step-type — renders "Continue to <Vendor>" CTA that opens
 * the vendor OAuth flow. On callback return, the parent wizard runtime
 * writes the token payload into `state.token` + calls onNext.
 *
 * Non-resumable per spec §4: if the user returns mid-flow, the step rewinds
 * to the prior step (shell owns the rewind; this step just reports
 * `resumableByDefault: false`).
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  type StepComponentProps,
  type StepTypeDefinition,
  invalid,
} from "@/lib/wizards/step-types";

export type OAuthConsentState = {
  token: string | null;
  vendorLabel: string;
};

export type OAuthConsentConfig = {
  vendorLabel: string;
  authorizeUrl: string;
};

function OAuthConsentComponent({
  state,
  onNext,
  config,
}: StepComponentProps<OAuthConsentState>) {
  const cfg = config as OAuthConsentConfig | undefined;
  const label = state.vendorLabel || cfg?.vendorLabel || "vendor";
  const href = cfg?.authorizeUrl ?? "#";

  return (
    <div data-wizard-step="oauth-consent" className="space-y-4">
      <p className="text-sm text-muted-foreground">
        You&apos;ll be redirected to {label} to authorise. Come back when
        you&apos;re done.
      </p>
      {state.token ? (
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      ) : (
        <a
          href={href}
          data-wizard-oauth-link
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Continue to {label}
        </a>
      )}
    </div>
  );
}

export const oauthConsentStep: StepTypeDefinition<OAuthConsentState> = {
  type: "oauth-consent",
  resumableByDefault: false,
  Component: OAuthConsentComponent,
  resume: (raw) => ({
    token:
      raw && typeof raw === "object" && "token" in raw
        ? ((raw as { token: unknown }).token as string | null) ?? null
        : null,
    vendorLabel:
      raw && typeof raw === "object" && "vendorLabel" in raw
        ? String((raw as { vendorLabel: unknown }).vendorLabel ?? "")
        : "",
  }),
  validate: (state) =>
    state.token ? { ok: true } : invalid("Waiting on the vendor to come back."),
};
