/**
 * Brand DNA Assessment — alignment gate entry screen.
 *
 * Route: /lite/brand-dna
 *
 * One question: "Does your business represent your personality?"
 * Three options → sets brand_dna_profiles.track:
 *   - A: "Completely" → "founder"
 *   - B: "Not really" → "business"
 *   - C: "Somewhere in between" → "founder_supplement"
 *
 * Resume logic: if an existing superbad_self profile has a track already set
 * and current_section >= 1, skip the gate and redirect to the resume point.
 *
 * Owner: BDA-2.
 */

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

import { submitAlignmentGate } from "./actions";
import { AlignmentGateClient } from "./alignment-gate-client";

export const metadata: Metadata = {
  title: "Brand DNA — SuperBad",
};

export default async function BrandDnaEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();

  // ── Resume check ─────────────────────────────────────────────────────────
  if (session?.user?.id) {
    const existing = await db
      .select({
        id: brand_dna_profiles.id,
        track: brand_dna_profiles.track,
        current_section: brand_dna_profiles.current_section,
        status: brand_dna_profiles.status,
      })
      .from(brand_dna_profiles)
      .where(
        and(
          eq(brand_dna_profiles.subject_type, "superbad_self"),
          eq(brand_dna_profiles.is_current, true),
        ),
      )
      .limit(1);

    const profile = existing[0];

    if (profile?.track && profile.status !== "complete") {
      // Resume: go to the current section (first unanswered question)
      const resumeSection = Math.max(1, profile.current_section ?? 1);
      redirect(`/lite/brand-dna/section/${resumeSection}`);
    }

    if (profile?.status === "complete") {
      // Already done — BDA-3 reveal page (stub: stay on page for now)
      // BDA-3 will add a redirect to the reveal here
    }
  }

  return (
    <AlignmentGateClient
      submitAction={submitAlignmentGate}
      errorParam={params.error}
    />
  );
}
