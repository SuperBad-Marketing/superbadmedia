"use client";

/**
 * Dispatcher for /lite/setup/critical-flight/[key].
 *
 * Historically (SW-5 / SW-6) this file housed a single driver that branched
 * by `wizardKey` between stripe-admin and resend. SW-7 adds graph-api-admin
 * whose step composition is structurally different (oauth-consent, no
 * api-key-paste) — the branch pattern started reading as a dumping ground.
 *
 * This file is now a thin dispatcher: it picks the right per-wizard client
 * by `wizardKey` and hands over the serialisable slice the server component
 * resolved. Each per-wizard client lives in `./clients/<wizardKey>-client.tsx`
 * and shares the shell skeleton via `./clients/use-critical-flight-shell`.
 *
 * Owner: SW-7.
 */
import * as React from "react";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import { StripeAdminClient } from "./clients/stripe-admin-client";
import { ResendClient } from "./clients/resend-client";
import { GraphAdminClient } from "./clients/graph-api-admin-client";

export type CriticalFlightClientProps = {
  wizardKey: string;
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
  webhookProbeTimeoutMs: number;
  graphAuthorizeUrl: string;
  allowTestTokenInjection: boolean;
};

export function CriticalFlightClient({
  wizardKey,
  audience,
  steps,
  outroCopy,
  expiryDays,
  webhookProbeTimeoutMs,
  graphAuthorizeUrl,
  allowTestTokenInjection,
}: CriticalFlightClientProps) {
  if (wizardKey === "stripe-admin") {
    return (
      <StripeAdminClient
        audience={audience}
        steps={steps}
        outroCopy={outroCopy}
        expiryDays={expiryDays}
        webhookProbeTimeoutMs={webhookProbeTimeoutMs}
      />
    );
  }
  if (wizardKey === "resend") {
    return (
      <ResendClient
        audience={audience}
        steps={steps}
        outroCopy={outroCopy}
        expiryDays={expiryDays}
      />
    );
  }
  if (wizardKey === "graph-api-admin") {
    return (
      <GraphAdminClient
        audience={audience}
        steps={steps}
        outroCopy={outroCopy}
        expiryDays={expiryDays}
        authorizeUrl={graphAuthorizeUrl}
        allowTestTokenInjection={allowTestTokenInjection}
      />
    );
  }
  return (
    <div
      data-wizard-unknown
      className="flex min-h-full items-center justify-center px-6 py-12 text-sm text-muted-foreground"
    >
      Unknown wizard: {wizardKey}.
    </div>
  );
}
