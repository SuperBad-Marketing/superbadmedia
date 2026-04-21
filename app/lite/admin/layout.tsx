import * as React from "react"

import { AdminShellWithNav } from "@/components/lite/admin-shell-with-nav"
import { AdminEventToasts } from "@/components/lite/admin-event-toasts"
import { AdminEggOrchestrator } from "@/components/lite/admin-egg-orchestrator"

/**
 * /lite/admin layout — wraps every admin surface in `AdminShellWithNav`.
 *
 * Chrome only. Each admin page keeps its own `auth()` check +
 * `role !== "admin"` redirect; this layout never bounces.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminShellWithNav>
      <AdminEventToasts />
      <AdminEggOrchestrator />
      {children}
    </AdminShellWithNav>
  )
}
