"use client";

/**
 * `webhook-probe` step-type — waits for a webhook event to arrive from the
 * vendor within `wizards.webhook_probe_timeout_ms`. Shows a pulse animation
 * while waiting. Timeout surfaces a branded retry affordance.
 *
 * Timeout pulled via props from a server parent (settings.get pattern —
 * never a literal in this file). Non-resumable per spec §4.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { houseSpring } from "@/lib/design-tokens";
import {
  type StepComponentProps,
  type StepTypeDefinition,
  invalid,
} from "@/lib/wizards/step-types";

export type WebhookProbeState = {
  endpoint: string;
  received: boolean;
  receivedAtMs: number | null;
};

export type WebhookProbeConfig = {
  endpoint: string;
  /** Injected from `settings.get('wizards.webhook_probe_timeout_ms')`. */
  timeoutMs: number;
  /** Polls the backend for a matching inbound POST; shell injects. */
  checkReceived: () => Promise<boolean>;
};

function WebhookProbeComponent({
  state,
  onChange,
  onNext,
  config,
}: StepComponentProps<WebhookProbeState>) {
  const cfg = config as WebhookProbeConfig | undefined;
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (state.received || !cfg?.checkReceived || !cfg.timeoutMs) return;
    let cancelled = false;
    const started = Date.now();
    const tick = async () => {
      if (cancelled) return;
      const got = await cfg.checkReceived();
      if (cancelled) return;
      if (got) {
        onChange({ ...state, received: true, receivedAtMs: Date.now() });
        return;
      }
      if (Date.now() - started > cfg.timeoutMs) {
        setTimedOut(true);
        return;
      }
      setTimeout(tick, 2000);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [state, cfg, onChange]);

  return (
    <div data-wizard-step="webhook-probe" className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Waiting for a ping at <code>{state.endpoint || cfg?.endpoint}</code>.
      </p>
      {!state.received && !timedOut ? (
        <motion.div
          data-wizard-webhook-pulse
          className="h-3 w-3 rounded-full bg-foreground"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ ...houseSpring, repeat: Infinity, duration: 1.2 }}
        />
      ) : null}
      {state.received ? (
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      ) : null}
      {timedOut ? (
        <p className="text-xs text-destructive" data-wizard-webhook-timeout>
          That took longer than expected. Let&apos;s try again.
        </p>
      ) : null}
    </div>
  );
}

export const webhookProbeStep: StepTypeDefinition<WebhookProbeState> = {
  type: "webhook-probe",
  resumableByDefault: false,
  Component: WebhookProbeComponent,
  resume: (raw) => {
    const r = (raw ?? {}) as Partial<WebhookProbeState>;
    return {
      endpoint: typeof r.endpoint === "string" ? r.endpoint : "",
      received: Boolean(r.received),
      receivedAtMs:
        typeof r.receivedAtMs === "number" ? r.receivedAtMs : null,
    };
  },
  validate: (state) =>
    state.received ? { ok: true } : invalid("Still waiting on the vendor."),
};
