"use client";

/**
 * `custom` step-type — escape hatch. Renders arbitrary JSX inside the shell
 * chrome. Consumer supplies `render(props)` via config; this primitive just
 * passes shell props through and exposes resume/validate no-ops that the
 * consumer can override by pre-wrapping.
 */

import * as React from "react";
import {
  type StepComponentProps,
  type StepTypeDefinition,
} from "@/lib/wizards/step-types";

export type CustomStepState = Record<string, unknown>;

export type CustomStepConfig = {
  render: (props: StepComponentProps<CustomStepState>) => React.ReactNode;
  /** Consumer-owned validator (spec §4: declared per-use). */
  validate?: (state: CustomStepState) =>
    | { ok: true }
    | { ok: false; reason: string };
  resumable?: boolean;
};

function CustomStepComponent(props: StepComponentProps<CustomStepState>) {
  const cfg = props.config as CustomStepConfig | undefined;
  return (
    <div data-wizard-step="custom">{cfg?.render ? cfg.render(props) : null}</div>
  );
}

export const customStep: StepTypeDefinition<CustomStepState> = {
  type: "custom",
  resumableByDefault: false,
  Component: CustomStepComponent,
  resume: (raw) =>
    raw && typeof raw === "object" ? (raw as CustomStepState) : {},
  // Consumer-owned validation is wired through config when the step-type
  // is rendered. The registry-level validate is a permissive no-op.
  validate: () => ({ ok: true }),
};
