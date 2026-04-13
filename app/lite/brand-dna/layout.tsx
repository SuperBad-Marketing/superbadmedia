/**
 * Brand DNA Assessment layout shell.
 *
 * Immersive full-screen layout — no admin chrome, no sidebar.
 * Kill-switch gated: redirects to /lite/onboarding when
 * `brand_dna_assessment_enabled` is false and `BRAND_DNA_GATE_BYPASS` is unset.
 *
 * Visual environment: dark base (--color-neutral-900 background) with
 * section-specific accent overlays applied via data attributes in child pages.
 *
 * Owner: BDA-2.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { killSwitches } from "@/lib/kill-switches";

export const metadata: Metadata = {
  title: "Brand DNA — SuperBad",
  robots: { index: false, follow: false },
};

export default function BrandDnaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Kill-switch gate. BRAND_DNA_GATE_BYPASS=true enables the assessment
  // during development (consistent with the proxy.ts gate bypass).
  const enabled =
    killSwitches.brand_dna_assessment_enabled ||
    process.env.BRAND_DNA_GATE_BYPASS === "true";

  if (!enabled) {
    redirect("/lite/onboarding");
  }

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{
        background: "var(--color-neutral-950, #0a0a0a)",
        color: "var(--color-neutral-50, #fafafa)",
      }}
    >
      {children}
    </div>
  );
}
