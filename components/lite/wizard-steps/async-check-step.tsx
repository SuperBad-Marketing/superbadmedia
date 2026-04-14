"use client";

/**
 * `async-check` step-type — polls a long-running backend job (keyed by
 * `scheduled_tasks.key`) until it reports done or times out at
 * `wizards.async_check_timeout_ms`. Shows a status ticker.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  type StepComponentProps,
  type StepTypeDefinition,
  invalid,
} from "@/lib/wizards/step-types";

export type AsyncCheckState = {
  jobKey: string;
  status: "pending" | "running" | "done" | "failed";
  latestMessage: string | null;
};

export type AsyncCheckConfig = {
  /** Injected from `settings.get('wizards.async_check_timeout_ms')`. */
  timeoutMs: number;
  pollIntervalMs: number;
  /** Resolves the job's current status + message. Shell injects. */
  pollStatus: (jobKey: string) => Promise<{
    status: AsyncCheckState["status"];
    message: string | null;
  }>;
};

function AsyncCheckComponent({
  state,
  onChange,
  onNext,
  config,
}: StepComponentProps<AsyncCheckState>) {
  const cfg = config as AsyncCheckConfig | undefined;
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (state.status === "done" || state.status === "failed") return;
    if (!cfg?.pollStatus || !cfg.pollIntervalMs) return;
    let cancelled = false;
    const started = Date.now();
    const tick = async () => {
      if (cancelled) return;
      const next = await cfg.pollStatus(state.jobKey);
      if (cancelled) return;
      onChange({ ...state, status: next.status, latestMessage: next.message });
      if (next.status === "done" || next.status === "failed") return;
      if (Date.now() - started > cfg.timeoutMs) {
        setTimedOut(true);
        return;
      }
      setTimeout(tick, cfg.pollIntervalMs);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [state, cfg, onChange]);

  return (
    <div data-wizard-step="async-check" className="space-y-4">
      <p
        className="text-sm text-muted-foreground"
        data-wizard-async-status={state.status}
      >
        {state.latestMessage ?? "Working on it…"}
      </p>
      {state.status === "done" ? (
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      ) : null}
      {timedOut || state.status === "failed" ? (
        <p className="text-xs text-destructive" data-wizard-async-error>
          Job didn&apos;t finish. Give it another go.
        </p>
      ) : null}
    </div>
  );
}

export const asyncCheckStep: StepTypeDefinition<AsyncCheckState> = {
  type: "async-check",
  resumableByDefault: true,
  Component: AsyncCheckComponent,
  resume: (raw) => {
    const r = (raw ?? {}) as Partial<AsyncCheckState>;
    const status =
      r.status === "pending" ||
      r.status === "running" ||
      r.status === "done" ||
      r.status === "failed"
        ? r.status
        : "pending";
    return {
      jobKey: typeof r.jobKey === "string" ? r.jobKey : "",
      status,
      latestMessage:
        typeof r.latestMessage === "string" ? r.latestMessage : null,
    };
  },
  validate: (state) =>
    state.status === "done" ? { ok: true } : invalid("Job hasn&apos;t finished."),
};
