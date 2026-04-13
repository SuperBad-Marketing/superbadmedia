import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * AdminShell — sidebar + main layout for every admin surface.
 *
 * Q9 of the baseline: left sidebar (fixed), main column (scrollable), no
 * top nav. Sidebar is 240px at comfort density, 200px at compact. Main
 * uses the app background; sidebar uses `surface-1` so the seam reads.
 *
 * Density is inherited from the page's own `density-*` class (set per
 * feature spec per the baseline); this shell does not impose one.
 *
 * Consumed tokens: `--color-surface-1`, `--color-background`,
 * `--color-border`, `--space-5` / `--space-6`.
 */
export function AdminShell({
  sidebar,
  children,
  className,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="admin-shell"
      className={cn(
        "grid min-h-svh grid-cols-[240px_1fr] bg-background",
        "[[data-density='compact']_&]:grid-cols-[200px_1fr]",
        className
      )}
    >
      <aside
        data-slot="admin-shell-sidebar"
        className="sticky top-0 h-svh overflow-y-auto border-r border-border bg-[color:var(--color-surface-1,var(--card))] p-6"
      >
        {sidebar}
      </aside>
      <main data-slot="admin-shell-main" className="overflow-x-hidden p-8">
        {children}
      </main>
    </div>
  )
}
