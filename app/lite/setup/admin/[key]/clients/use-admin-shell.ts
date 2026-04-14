"use client";

/**
 * Shared state-driver hook for non-critical admin-wizard per-wizard clients.
 *
 * Mirrors `use-critical-flight-shell` (SW-7) with two differences:
 *  - cancel + done route to `/lite` (cockpit) rather than `/lite/first-run`.
 *    Non-critical admin wizards surface lazily from feature-triggered
 *    interception or the integrations hub; the user's natural return
 *    surface is the cockpit, not the first-run arc.
 *  - no `expiryDays` wiring implied — that stays a prop on the shell
 *    itself, same as the critical path.
 *
 * Per-wizard clients own step configuration + onComplete; this hook owns
 * index, state bag, and router navigation.
 *
 * Owner: SW-9.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import type { WizardStepDefinition } from "@/lib/wizards/types";

export type StepStates = Record<string, unknown>;

export type UseAdminShellOpts = {
  steps: WizardStepDefinition[];
  initialStates: StepStates;
};

export function useAdminShell({ steps, initialStates }: UseAdminShellOpts) {
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
    router.push("/lite");
  }, [router]);

  const onDone = React.useCallback(() => {
    router.refresh();
    router.push("/lite");
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
