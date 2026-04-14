"use client";

/**
 * WizardShell — chrome wrapper that every wizard renders inside.
 *
 * Responsibilities (spec §3.1):
 * - Render the progress indicator (segmented bar, step labels on hover).
 * - Render cancel affordance (emits `onCancel` — parent opens the abandon /
 *   save-for-later modal; shell stays dumb about persistence).
 * - Render an optional help affordance slot (`help` prop) — appears after the
 *   consumer declares help should show (help-escalation logic lives in SW-2+).
 * - Pass step body through as `children`.
 *
 * What the shell does NOT do (out of scope for SW-1):
 * - Step-type rendering (SW-2).
 * - Persisting wizard_progress rows (SW-2).
 * - Completion contract enforcement (SW-3).
 *
 * Motion: progress bar segment fills animate with the house spring
 * (Tier 1 only — no Tier 2 choreography here). `prefers-reduced-motion` is
 * honoured globally by MotionProvider; this component uses `houseSpring`
 * directly and lets the framework swap it.
 *
 * Expiry hint copy reads `expiryDays` from props, itself sourced from
 * `getWizardShellConfig()` in a server parent — no literal `30` in this file.
 *
 * Owner: SW-1. Spec: docs/specs/setup-wizards.md §3, §11.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { XIcon, LifeBuoyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { houseSpring } from "@/lib/design-tokens";
import { killSwitches } from "@/lib/kill-switches";
import { STEP_TYPE_REGISTRY } from "@/components/lite/wizard-steps";
import type {
  WizardAudience,
  WizardStepDefinition,
} from "@/lib/wizards/types";

export type WizardShellProps = {
  /** Stable wizard key (maps to WizardDefinition.key). Used as a test hook. */
  wizardKey: string;
  /** 0-indexed index of the active step. */
  currentStep: number;
  /** Ordered labels — one per step. */
  stepLabels: string[];
  /** Admin vs client tone. Currently drives the progress-bar colour ramp. */
  audience: WizardAudience;
  /** Days from last activity before an in-flight wizard expires (settings.wizards.expiry_days). */
  expiryDays: number;
  /** Fired when the user taps cancel. Parent owns the abandon-vs-save modal. */
  onCancel: () => void;
  /**
   * Optional help affordance. When provided, renders a subtle life-buoy
   * button that opens the passed node. SW-2+ surfaces this after N
   * consecutive step failures (`settings.wizards.help_escalation_failure_count`).
   */
  help?: React.ReactNode;
  /**
   * Step body. Pass `children` for custom rendering, OR pass `step` +
   * `stepState` + `onStepStateChange` + `onNext` to render via
   * `STEP_TYPE_REGISTRY`. The registry path is what SW-3+ real wizards use.
   */
  children?: React.ReactNode;
  step?: WizardStepDefinition;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stepState?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onStepStateChange?: (next: any) => void;
  onNext?: () => void;
};

export function WizardShell({
  wizardKey,
  currentStep,
  stepLabels,
  audience,
  expiryDays,
  onCancel,
  help,
  children,
  step,
  stepState,
  onStepStateChange,
  onNext,
}: WizardShellProps) {
  const [helpOpen, setHelpOpen] = React.useState(false);
  const stepCount = stepLabels.length;
  const safeCurrent = Math.min(Math.max(currentStep, 0), Math.max(stepCount - 1, 0));

  // Kill-switch short-circuit. Every wizard surface refuses to render when
  // `setup_wizards_enabled` is off — mid-flight wizards safely pause (spec §8).
  if (!killSwitches.setup_wizards_enabled) {
    return (
      <div
        data-wizard-shell-disabled
        data-wizard-key={wizardKey}
        className="flex min-h-full items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground"
      >
        Setup is paused for maintenance. Come back shortly — we&apos;ll hold
        your progress.
      </div>
    );
  }

  // Resolve the step body. If a `step` definition is provided, render it
  // via STEP_TYPE_REGISTRY; otherwise fall back to `children` (SW-1 chrome
  // pattern).
  const stepBody: React.ReactNode = step
    ? (() => {
        const def = STEP_TYPE_REGISTRY[step.type];
        if (!def) return children ?? null;
        const Comp = def.Component;
        return (
          <Comp
            stepKey={step.key}
            state={stepState}
            onChange={onStepStateChange ?? (() => {})}
            onNext={onNext ?? (() => {})}
            audience={audience}
            config={step.config}
          />
        );
      })()
    : children;

  return (
    <div
      data-wizard-shell
      data-wizard-key={wizardKey}
      data-audience={audience}
      className="flex min-h-full flex-col"
    >
      {/* Top chrome: progress bar + cancel + help */}
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <ProgressBar
          currentStep={safeCurrent}
          stepCount={stepCount}
          stepLabels={stepLabels}
          audience={audience}
        />

        {help ? (
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Get help"
              aria-expanded={helpOpen}
              data-wizard-help-trigger
              onClick={() => setHelpOpen((v) => !v)}
            >
              <LifeBuoyIcon className="h-4 w-4" />
            </Button>
            {helpOpen ? (
              <div
                data-wizard-help-panel
                className="absolute right-0 top-full z-10 mt-2 w-80 rounded-md border bg-popover p-4 shadow-md"
              >
                {help}
              </div>
            ) : null}
          </div>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cancel wizard"
          data-wizard-cancel-trigger
          onClick={onCancel}
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </header>

      {/* Step body */}
      <div className="flex-1 px-6 py-6">{stepBody}</div>

      {/* Bottom chrome: expiry hint (dry, terse) */}
      <footer className="border-t px-6 py-2 text-xs text-muted-foreground">
        <span data-wizard-expiry-hint>
          Save for later — we&apos;ll hold this for {expiryDays} days of quiet.
        </span>
      </footer>
    </div>
  );
}

type ProgressBarProps = {
  currentStep: number;
  stepCount: number;
  stepLabels: string[];
  audience: WizardAudience;
};

function ProgressBar({ currentStep, stepCount, stepLabels, audience }: ProgressBarProps) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={stepCount}
      aria-valuenow={currentStep + 1}
      aria-label={`Step ${currentStep + 1} of ${stepCount}`}
      data-wizard-progress
      data-audience={audience}
      className="flex flex-1 items-center gap-1"
    >
      {stepLabels.map((label, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        return (
          <motion.div
            key={i}
            title={label}
            data-wizard-progress-segment
            data-state={isDone ? "done" : isActive ? "active" : "pending"}
            className={
              "h-1 flex-1 rounded-full " +
              (isDone || isActive
                ? "bg-foreground"
                : "bg-muted")
            }
            initial={false}
            animate={{ opacity: isDone || isActive ? 1 : 0.5 }}
            transition={houseSpring}
          />
        );
      })}
    </div>
  );
}
