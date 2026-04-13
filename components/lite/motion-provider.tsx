"use client"

import * as React from "react"
import { MotionConfig, type Transition } from "framer-motion"

import { houseSpring, motion as motionTokens } from "@/lib/design-tokens"

import { useDisplayPreferences } from "./theme-provider"

/**
 * MotionProvider — applies a `data-motion` attribute and a Framer
 * `MotionConfig` to its subtree.
 *
 * Three preference states, per `docs/specs/design-system-baseline.md`
 * §Reduced motion behaviour:
 *
 * - **full** (default): house spring everywhere; Tier 2 choreographies run as
 *   specified.
 * - **reduced**: Tier 2 cinematic moments are replaced with their Tier 1
 *   equivalent (consumers read `tier2[key].reduced`). The default transition
 *   becomes a 180ms linear ease-out.
 * - **off**: all transitions become instant — except modal opens (CSS for
 *   `[role="dialog"]` keeps a 100ms fade, because instant modal swaps are
 *   disorienting per spec).
 *
 * OS `prefers-reduced-motion: reduce` maps to `reduced` via
 * `theme-provider` (A5 reads the real preference from the user table;
 * until then it falls back to the OS hint at hydration time).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const { motion } = useDisplayPreferences()

  const transition: Transition = React.useMemo(() => {
    if (motion === "off") {
      return { duration: 0 }
    }
    if (motion === "reduced") {
      return { duration: motionTokens.reducedDurationMs / 1000, ease: "linear" }
    }
    return { ...houseSpring }
  }, [motion])

  const reducedMotion: "user" | "always" | "never" = React.useMemo(() => {
    if (motion === "off") return "always"
    if (motion === "reduced") return "always"
    return "user"
  }, [motion])

  return (
    <div data-motion={motion} className="contents">
      <MotionConfig transition={transition} reducedMotion={reducedMotion}>
        {children}
      </MotionConfig>
    </div>
  )
}
