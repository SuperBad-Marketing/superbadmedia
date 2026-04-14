"use client";

/**
 * `celebration` step-type — always the final step. Plays Tier 2
 * `wizard-complete` choreography (registered in A4) and renders outro copy
 * + post-completion Observatory summary slot + done CTA.
 *
 * SW-3 extension: optional `config.onComplete` orchestrator. When supplied
 * (integration wizards), it fires once on mount — the consuming wizard
 * runs `verifyCompletion() → registerIntegration() → wizard_completions
 * insert` inside it and returns either the observatory summary or a
 * branded failure reason. The Done CTA is disabled until the orchestrator
 * resolves; on failure the CTA flips to "Try again" and re-invokes it.
 *
 * Reduced-motion parity comes from MotionProvider's global `MotionConfig`
 * swap (A4). This file reads `tier2["wizard-complete"]` directly so the
 * choreography source remains the single source of truth.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { tier2 } from "@/lib/motion/choreographies";
import {
  type StepComponentProps,
  type StepTypeDefinition,
} from "@/lib/wizards/step-types";

export type CelebrationState = {
  outroCopy: string;
  observatorySummary: string | null;
};

export type CelebrationCompleteResult =
  | { ok: true; observatorySummary: string }
  | { ok: false; reason: string };

export type CelebrationConfig = {
  onDone: () => void;
  /**
   * Optional: integration-wizard completion orchestrator. Runs once on
   * mount (and again on Retry). Consuming wizard runs verifyCompletion
   * → registerIntegration → wizard_completions insert and returns the
   * summary or a branded failure reason.
   */
  onComplete?: () => Promise<CelebrationCompleteResult>;
};

type Phase =
  | { kind: "passive" }
  | { kind: "pending" }
  | { kind: "ok"; observatorySummary: string }
  | { kind: "error"; reason: string };

function CelebrationComponent({
  state,
  config,
}: StepComponentProps<CelebrationState>) {
  const cfg = config as CelebrationConfig | undefined;
  const entry = tier2["wizard-complete"];
  const hasOrchestrator = typeof cfg?.onComplete === "function";
  const [phase, setPhase] = React.useState<Phase>(
    hasOrchestrator ? { kind: "pending" } : { kind: "passive" },
  );

  const run = React.useCallback(async () => {
    if (!cfg?.onComplete) return;
    setPhase({ kind: "pending" });
    try {
      const result = await cfg.onComplete();
      if (result.ok) {
        setPhase({ kind: "ok", observatorySummary: result.observatorySummary });
      } else {
        setPhase({ kind: "error", reason: result.reason });
      }
    } catch (err) {
      setPhase({
        kind: "error",
        reason: err instanceof Error ? err.message : "Completion failed.",
      });
    }
  }, [cfg]);

  React.useEffect(() => {
    if (hasOrchestrator) {
      void run();
    }
  }, [hasOrchestrator, run]);

  const summaryText =
    phase.kind === "ok"
      ? phase.observatorySummary
      : phase.kind === "passive"
        ? state.observatorySummary
        : null;

  return (
    <motion.div
      data-wizard-step="celebration"
      data-choreography="wizard-complete"
      data-phase={phase.kind}
      className="space-y-6 text-center"
      initial="initial"
      animate="animate"
      variants={entry.variants}
      transition={entry.transition}
    >
      <p className="text-lg">{state.outroCopy}</p>
      {summaryText ? (
        <p
          className="text-xs text-muted-foreground"
          data-wizard-observatory-summary
        >
          {summaryText}
        </p>
      ) : null}
      {phase.kind === "error" ? (
        <p className="text-xs text-destructive" data-wizard-completion-error>
          {phase.reason}
        </p>
      ) : null}
      {phase.kind === "error" ? (
        <Button type="button" onClick={() => void run()}>
          Try again
        </Button>
      ) : (
        <Button
          type="button"
          disabled={phase.kind === "pending"}
          onClick={() => cfg?.onDone?.()}
        >
          {phase.kind === "pending" ? "Finishing up…" : "Done"}
        </Button>
      )}
    </motion.div>
  );
}

export const celebrationStep: StepTypeDefinition<CelebrationState> = {
  type: "celebration",
  // Celebration never "resumes" — reaching it means the wizard completed.
  resumableByDefault: false,
  Component: CelebrationComponent,
  resume: (raw) => {
    const r = (raw ?? {}) as Partial<CelebrationState>;
    return {
      outroCopy: typeof r.outroCopy === "string" ? r.outroCopy : "",
      observatorySummary:
        typeof r.observatorySummary === "string"
          ? r.observatorySummary
          : null,
    };
  },
  // Celebration has no advance gate — the wizard is already done when
  // this step is rendered. Validation always passes.
  validate: () => ({ ok: true }),
};
