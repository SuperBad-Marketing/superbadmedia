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
        "min-h-svh bg-background",
        "md:grid md:grid-cols-[240px_1fr]",
        "[[data-density='compact']_&]:md:grid-cols-[200px_1fr]",
        className
      )}
    >
      <aside
        data-slot="admin-shell-sidebar"
        className="hidden md:block sticky top-0 h-svh overflow-y-auto bg-[color:var(--color-surface-1,var(--card))] p-6"
        style={{
          boxShadow:
            "var(--surface-highlight), 1px 0 0 rgba(253, 245, 230, 0.06), 4px 0 16px rgba(0, 0, 0, 0.15)",
        }}
      >
        {sidebar}
      </aside>
      <main
        data-slot="admin-shell-main"
        className="relative overflow-x-hidden p-4 pb-20 md:p-8 md:pb-8"
      >
        {children}
      </main>
    </div>
  )
}
