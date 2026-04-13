"use client"

import * as React from "react"

import { useDisplayPreferences } from "./theme-provider"

/**
 * MotionProvider — applies a `data-motion` attribute to its subtree.
 *
 * The CSS in `app/globals.css` respects `prefers-reduced-motion: reduce`
 * at the OS level. This provider layers the user's explicit preference on
 * top by writing `data-motion="full|reduced|off"` onto a wrapper element
 * — CSS / component branches can target it with a simple attribute
 * selector (e.g. `[data-motion="off"] .tier-2-reveal { opacity: 1 }`).
 *
 * A4 extends this with Framer Motion's `MotionConfig` and the locked 7-item
 * choreography registry. Until then, CSS + data-attribute is enough for
 * every primitive shipped in A3.
 *
 * Consumed tokens: `motion.tier1DurationMs`, `motion.reducedDurationMs`
 * via CSS custom properties; `motion_preference` user axis from
 * `lib/design-tokens.ts`.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const { motion } = useDisplayPreferences()
  return (
    <div data-motion={motion} className="contents">
      {children}
    </div>
  )
}
