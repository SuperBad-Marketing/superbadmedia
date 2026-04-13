import * as React from "react"

import { cn } from "@/lib/utils"
import type { BhsLocation } from "@/lib/design-tokens"

/**
 * BrandHero — the only wrapper allowed to use Black Han Sans.
 *
 * The `location` prop is typed as `BhsLocation`, which is the closed list
 * defined in `lib/design-tokens.ts` (§Black Han Sans closed list). Attempting
 * to pass a string outside the list is a typecheck error. This is the
 * spec's build-time enforcement of "One BHS per closed-list location only"
 * (design-system-baseline rule 2).
 *
 * Consumed tokens: `--font-black-han-sans`, `--color-brand-cream`,
 * `--text-display`, `--text-h1`, `--color-foreground`.
 */
export function BrandHero({
  location,
  size = "display",
  className,
  children,
  ...props
}: {
  location: BhsLocation
  size?: "display" | "h1"
  className?: string
  children: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLHeadingElement>, "children">) {
  const Tag = size === "display" ? "h1" : "h2"
  return (
    <Tag
      data-slot="brand-hero"
      data-location={location}
      className={cn(
        "font-[family-name:var(--font-black-han-sans)] tracking-tight uppercase leading-[1]",
        size === "display" ? "text-6xl md:text-7xl" : "text-4xl md:text-5xl",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}
