"use client";

/**
 * Shared state-driver hook for critical-flight per-wizard clients.
 *
 * Each wizard key has its own client file (SW-7 split — see handoff) because
 * step composition diverges (api-key-paste vs oauth-consent) and branch
 * conditionals in a single file were reading as a dumping ground. The shell
 * skeleton stayed identical though — index tracking, state bag, cancel /
 * done navigation — so it lives here.
 *
 * The hook is deliberately dumb: per-wizard clients own step configuration
 * + onComplete. The hook owns index, state bag, and router navigation.
 *
 * Owner: SW-7.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import type { WizardStepDefinition } from "@/lib/wizards/types";

export type StepStates = Record<string, unknown>;

export type UseCriticalFlightShellOpts = {
  steps: WizardStepDefinition[];
  initialStates: StepStates;
};

export function useCriticalFlightShell({
  steps,
  initialStates,
}: UseCriticalFlightShellOpts) {
  const router = useRouter();
  const [index, setIndex] = React.useState(0);
  const [states, setStates] = React.useState<StepStates>(() => initialStates);

  const step = steps[index];
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

  const handleCancel = React.useCallback(() => {
    router.push("/lite/first-run");
  }, [router]);

  const onDone = React.useCallback(() => {
    router.refresh();
    router.push("/lite/first-run");
  }, [router]);

  return {
    index,
    step,
    states,
    setStates,
    stepState,
    onStepStateChange,
    advance,
    handleCancel,
    onDone,
  };
}
