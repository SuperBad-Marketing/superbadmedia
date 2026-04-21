import * as React from "react"

import { AdminShellWithNav } from "@/components/lite/admin-shell-with-nav"
import { AdminEventToasts } from "@/components/lite/admin-event-toasts"
import { AdminEggOrchestrator } from "@/components/lite/admin-egg-orchestrator"
import { CrtTurnOffOverlay } from "@/components/lite/crt-turn-off-overlay"
import { MilestoneSpotterCard } from "@/components/lite/milestone-spotter-card"
import { ThreeWonsToast } from "@/components/lite/three-wons-toast"
import { AdminEggToast } from "@/components/lite/admin-egg-toast"

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
      <CrtTurnOffOverlay />
      <MilestoneSpotterCard />
      <ThreeWonsToast />
      <AdminEggToast
        eggId="weekend_warrior"
        copy="It&rsquo;s the weekend. Log off. The leads will still be there Monday."
      />
      <AdminEggToast
        eggId="inbox_zero"
        copy="Nothing pending. Either you&rsquo;re efficient or something&rsquo;s broken."
      />
      <AdminEggToast
        eggId="first_client_won"
        copy="First one. Remember this feeling — it gets quieter from here."
      />
      {children}
    </AdminShellWithNav>
  )
}
