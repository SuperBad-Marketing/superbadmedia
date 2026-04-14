"use client";

/**
 * `celebration` step-type — always the final step. Plays Tier 2
 * `wizard-complete` choreography (registered in A4) and renders outro copy
 * + post-completion Observatory summary slot + done CTA.
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

export type CelebrationConfig = {
  onDone: () => void;
};

function CelebrationComponent({
  state,
  config,
}: StepComponentProps<CelebrationState>) {
  const cfg = config as CelebrationConfig | undefined;
  const entry = tier2["wizard-complete"];

  return (
    <motion.div
      data-wizard-step="celebration"
      data-choreography="wizard-complete"
      className="space-y-6 text-center"
      initial="initial"
      animate="animate"
      variants={entry.variants}
      transition={entry.transition}
    >
      <p className="text-lg">{state.outroCopy}</p>
      {state.observatorySummary ? (
        <p
          className="text-xs text-muted-foreground"
          data-wizard-observatory-summary
        >
          {state.observatorySummary}
        </p>
      ) : null}
      <Button type="button" onClick={() => cfg?.onDone?.()}>
        Done
      </Button>
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
