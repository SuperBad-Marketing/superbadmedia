import * as React from "react"

import { cn } from "@/lib/utils"
import { BrandHero } from "./brand-hero"

/**
 * EmptyState — the house empty-state pattern.
 *
 * Pairs a Black Han Sans hero (fixed location: `empty_state_hero`) with a
 * narrative-italic message and an optional CTA slot. Copy is supplied by
 * the consumer — per the spec, sprinkle/empty-state copy banks live at
 * `lib/copy/empty-states.ts` (not yet built; consumer strings are fine for
 * A3, strings move into the bank as features land).
 *
 * Consumed tokens: `--font-black-han-sans`, `--font-playfair-display` (via
 * the `italic` + serif class), `--color-neutral-300`, `--space-5`.
 */
export function EmptyState({
  hero,
  message,
  children,
  className,
}: {
  hero: string
  message: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="empty-state"
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-6 py-16 text-center",
        className
      )}
    >
      <BrandHero location="empty_state_hero" size="h1">
        {hero}
      </BrandHero>
      <p className="max-w-md font-serif text-lg italic text-[color:var(--color-neutral-300,oklch(0.84_0.02_70))]">
        {message}
      </p>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}
