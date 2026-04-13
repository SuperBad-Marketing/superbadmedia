"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { tier2, type Tier2Key } from "@/lib/motion/choreographies"

import { useDisplayPreferences } from "./theme-provider"

/**
 * Tier2Reveal — renders one of the 7 locked choreographed entrances.
 *
 * The `choreography` prop is required and must match a key in
 * `lib/motion/choreographies.ts`. Adding a new Tier 2 moment means adding
 * it to the registry *and* getting Andy's sign-off — the TypeScript union
 * is the guardrail.
 *
 * Reduced-motion handling is local: when `motion_preference` is `reduced`
 * or `off`, consumers still get a bounded fade (100ms) so the entrance
 * doesn't pop jarringly. The MotionConfig layered by MotionProvider also
 * enforces reduced-motion at the Framer level.
 */
export function Tier2Reveal({
  choreography,
  className,
  children,
  as: Element = motion.div,
}: {
  choreography: Tier2Key
  className?: string
  children: React.ReactNode
  /** Override the rendered element — defaults to `motion.div`. */
  as?: React.ElementType
}) {
  const entry = tier2[choreography]
  const { motion: motionPreference } = useDisplayPreferences()
  const isReduced = motionPreference !== "full"
  const variants = isReduced ? entry.reduced.variants : entry.variants
  const transition = isReduced ? entry.reduced.transition : entry.transition

  return (
    <Element
      data-slot="tier-2-reveal"
      data-choreography={choreography}
      className={cn(className)}
      initial="initial"
      animate="animate"
      variants={variants}
      transition={transition}
    >
      {children}
    </Element>
  )
}
