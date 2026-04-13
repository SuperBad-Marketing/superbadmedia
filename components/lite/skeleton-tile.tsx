import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * SkeletonTile — surface-tinted skeleton block.
 *
 * Uses the spec's `surface-2` token so placeholders feel like the same
 * material as the card they'll eventually become, not grey wash. Respects
 * `prefers-reduced-motion: reduce` — the animated shimmer gracefully
 * degrades to a static fill.
 *
 * Consumed tokens: `--color-surface-2`, `--radius-default`,
 * `motion.reducedDurationMs`.
 */
export function SkeletonTile({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton-tile"
      className={cn(
        "relative overflow-hidden rounded-md bg-[color:var(--color-surface-2,oklch(0.22_0_0))]",
        "motion-safe:after:absolute motion-safe:after:inset-0",
        "motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent motion-safe:after:via-white/5 motion-safe:after:to-transparent",
        "motion-safe:after:animate-[shimmer_1.6s_ease-in-out_infinite]",
        className
      )}
      aria-busy="true"
      aria-live="polite"
      {...props}
    />
  )
}
