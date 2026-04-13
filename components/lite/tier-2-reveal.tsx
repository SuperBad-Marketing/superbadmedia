"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Tier2Reveal — choreographed entrance wrapper.
 *
 * The seven locked Tier 2 moments (morning brief arrival, quote accept,
 * first client bell, milestone crossed, brand DNA complete, retainer
 * kickoff, lights out) ride this wrapper. A3 ships a CSS-based fade +
 * lift; A4 replaces with the Framer Motion choreography registry.
 *
 * Honours `prefers-reduced-motion: reduce` at the CSS layer: animation is
 * suppressed, content appears at final opacity/position immediately.
 * Honours explicit `data-motion="off"` on any ancestor (via MotionProvider).
 *
 * Consumed tokens: `motion.tier2SlowMs`, `motion.tier2Ease` (via CSS custom
 * properties `--motion-tier2-slow-ms`, `--motion-tier2-ease`).
 */
export function Tier2Reveal({
  className,
  children,
  delayMs = 0,
}: {
  className?: string
  children: React.ReactNode
  delayMs?: number
}) {
  return (
    <div
      data-slot="tier-2-reveal"
      style={{
        animationDelay: delayMs ? `${delayMs}ms` : undefined,
      }}
      className={cn(
        "motion-safe:opacity-0 motion-safe:translate-y-3",
        "motion-safe:animate-[tier2-reveal_800ms_cubic-bezier(0.16,1,0.3,1)_forwards]",
        "[[data-motion='off']_&]:animate-none [[data-motion='off']_&]:opacity-100 [[data-motion='off']_&]:translate-y-0",
        className
      )}
    >
      {children}
    </div>
  )
}
