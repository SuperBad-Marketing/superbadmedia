import { redirect } from "next/navigation";

import { getPortalSession } from "@/lib/portal/guard";
import { killSwitches } from "@/lib/kill-switches";

/**
 * Portal Brand DNA layout — dark immersive shell matching the admin Brand DNA
 * layout. Kill-switch gated. Portal session required.
 *
 * Owner: BDA-5.
 */
export default async function PortalBrandDnaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabled =
    killSwitches.brand_dna_assessment_enabled ||
    process.env.BRAND_DNA_GATE_BYPASS === "true";

  if (!enabled) {
    redirect("/lite/portal");
  }

  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-neutral-950, #0a0a08)",
        color: "var(--brand-cream, #fdf5e6)",
      }}
    >
      {children}
    </div>
  );
}
