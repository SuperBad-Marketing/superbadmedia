"use client";

/**
 * Critical-flight capstone screen — SW-4.
 *
 * Rendered by `/lite/first-run` once every critical-flight wizard has a
 * completion row for the signed-in admin. Plays the wizard-complete
 * choreography + placeholder copy per spec §8.3 ("SuperBad is open for
 * business."). When the `admin-first-run` WizardDefinition lands (SW-5+)
 * and registers a `critical_flight_capstone` Tier-1 motion slot, this
 * screen upgrades to the ceremonial variant — for now it inherits the
 * celebration step's Tier-2 entry so the moment is still choreographed.
 *
 * Owner: SW-4.
 */
import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { tier2 } from "@/lib/motion/choreographies";

type Props = {
  line: string;
  continueHref: string;
  continueLabel: string;
};

export function Capstone({ line, continueHref, continueLabel }: Props) {
  const entry = tier2["wizard-complete"];
  return (
    <motion.div
      data-capstone="critical-flight"
      data-choreography="wizard-complete"
      className="mx-auto flex max-w-xl flex-col items-center gap-8 px-6 py-24 text-center"
      initial="initial"
      animate="animate"
      variants={entry.variants}
      transition={entry.transition}
    >
      <p className="text-3xl font-medium tracking-tight">{line}</p>
      <Link href={continueHref} className={buttonVariants()}>
        {continueLabel}
      </Link>
    </motion.div>
  );
}
