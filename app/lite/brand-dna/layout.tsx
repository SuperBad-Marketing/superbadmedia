/**
 * Brand DNA Assessment layout shell.
 *
 * Immersive full-screen layout — no admin chrome, no sidebar.
 * Kill-switch gated: redirects to /lite/onboarding when
 * `brand_dna_assessment_enabled` is false and `BRAND_DNA_GATE_BYPASS` is unset.
 *
 * Visual environment is owned by `<SceneShell>` (client) — ambient blob world
 * + Pacifico wordmark + segmented progress chrome, derived from pathname so
 * the scene cross-fades across navigations rather than re-mounting.
 *
 * Owners: BDA-2 (kill-switch + structure), BDA-POLISH-1 (visual port).
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { killSwitches } from "@/lib/kill-switches";
import { SceneShell } from "@/components/lite/brand-dna/scene-shell";

export const metadata: Metadata = {
  title: "Brand DNA — SuperBad",
  robots: { index: false, follow: false },
};

export default function BrandDnaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabled =
    killSwitches.brand_dna_assessment_enabled ||
    process.env.BRAND_DNA_GATE_BYPASS === "true";

  if (!enabled) {
    redirect("/lite/onboarding");
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--neutral-900)",
        color: "var(--neutral-300)",
        fontFamily: "var(--font-body)",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <SceneShell>{children}</SceneShell>
    </div>
  );
}
