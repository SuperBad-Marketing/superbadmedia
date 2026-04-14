/**
 * StepTypeDefinition<TState> — the uniform contract every step-type in the
 * wizard library conforms to. Consumed by `STEP_TYPE_REGISTRY` (barrel) and
 * by `<WizardShell>`'s registry lookup.
 *
 * Owner: SW-2. Spec: docs/specs/setup-wizards.md §4.
 *
 * `Component` — React client component; props are standardised below so the
 * shell can drive every step uniformly (state, state-patch callback, advance
 * callback, audience tone, per-step `config`).
 *
 * `resume(raw)` — reconstructs a step's in-memory state from the JSON blob
 * persisted in `wizard_progress.state_blob`. Must be deterministic and pure.
 *
 * `validate(state)` — checks the state is complete and step-advance-ready.
 * Returns user-safe branded copy on failure (no raw stack traces — spec §3.3).
 */

import type * as React from "react";
import type { WizardAudience, WizardStepType } from "@/lib/wizards/types";

export type StepValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type StepComponentProps<TState> = {
  /** Stable key identifying this step within its wizard. */
  stepKey: string;
  /** Current in-memory state for this step. */
  state: TState;
  /** Replace step state wholesale. Shell debounces persistence. */
  onChange: (next: TState) => void;
  /** Request advancement to the next step. Shell runs `validate()` first. */
  onNext: () => void;
  /** Admin vs client tone. Drives spacing / copy register. */
  audience: WizardAudience;
  /** Step-type-specific config (opaque here; each step-type narrows it). */
  config?: unknown;
};

export type StepTypeDefinition<TState> = {
  type: WizardStepType;
  /** Whether this step-type's state survives a resume by default. */
  resumableByDefault: boolean;
  Component: React.ComponentType<StepComponentProps<TState>>;
  resume: (raw: unknown) => TState;
  validate: (state: TState) => StepValidationResult;
};

/** Helper: user-safe error builder for `validate()` failures. */
export function invalid(reason: string): StepValidationResult {
  return { ok: false, reason };
}
