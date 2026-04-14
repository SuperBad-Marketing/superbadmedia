/**
 * Brand DNA Assessment — cinematic reveal page.
 *
 * Route: /lite/brand-dna/reveal?profileId=…
 *
 * Server Component orchestrates portrait generation in a Suspense boundary so
 * the ambient loading copy can show while Opus is working:
 *   1. Validate profileId + resolve profile
 *   2. Loading shimmer renders immediately (spec §10.5 step 1 — 5–8s pause)
 *   3. Async child generates first_impression + prose_portrait (Opus) — both
 *      cached on the profile after the first call, so refreshes never re-bill
 *   4. On resolve, streams the RevealClient into view; the client fires
 *      `sound:brand_dna_reveal` and runs the Tier 2 cinematic
 *
 * `markProfileComplete` runs from the client at the end of the reveal (see
 * `reveal-client.tsx`). The status flip is what lets the Brand DNA Gate clear
 * on the user's next admin route visit (BDA-4 wires the session jwt).
 *
 * Owner: BDA-3.
 */

import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { SECTION_TITLES } from "@/lib/brand-dna/question-bank";
import { generateFirstImpression } from "@/lib/brand-dna/generate-first-impression";
import { generateProsePortrait } from "@/lib/brand-dna/generate-prose-portrait";

import { RevealClient } from "./reveal-client";

export const metadata: Metadata = {
  title: "Brand DNA — SuperBad",
  robots: { index: false, follow: false },
};

interface RevealPageProps {
  searchParams: Promise<{ profileId?: string }>;
}

export default async function RevealPage({ searchParams }: RevealPageProps) {
  const { profileId } = await searchParams;
  if (!profileId) {
    redirect("/lite/brand-dna");
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-16">
      <Suspense fallback={<RevealShimmer />}>
        <RevealContent profileId={profileId} />
      </Suspense>
    </main>
  );
}

// ── RevealContent — async, suspends on Opus calls ─────────────────────────────

async function RevealContent({ profileId }: { profileId: string }) {
  const profiles = await db
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) {
    redirect("/lite/brand-dna");
  }

  const firstImpression = await generateFirstImpression(profileId);
  const prosePortrait = await generateProsePortrait(profileId);

  const sectionInsights: string[] = profile.section_insights
    ? (JSON.parse(profile.section_insights) as string[]).filter(
        (s) => typeof s === "string" && s.length > 0,
      )
    : [];

  const sectionTitles: string[] = ([1, 2, 3, 4, 5] as const).map(
    (n) => SECTION_TITLES[n],
  );

  return (
    <RevealClient
      profileId={profileId}
      firstImpression={firstImpression}
      prosePortrait={prosePortrait}
      sectionInsights={sectionInsights}
      sectionTitles={sectionTitles}
      alreadyComplete={profile.status === "complete"}
    />
  );
}

// ── RevealShimmer — ambient loading state while Opus is working ───────────────

function RevealShimmer() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-6 text-center max-w-md"
      role="status"
      aria-live="polite"
      aria-label="Assembling your Brand DNA"
    >
      <p
        className="text-xs tracking-widest uppercase"
        style={{ color: "var(--color-neutral-500, #6b7280)" }}
      >
        Assembling your Brand DNA
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs animate-pulse">
        <div
          className="h-3 rounded-full"
          style={{ background: "rgba(255,255,255,0.06)", width: "80%", margin: "0 auto" }}
        />
        <div
          className="h-3 rounded-full"
          style={{ background: "rgba(255,255,255,0.05)", width: "55%", margin: "0 auto" }}
        />
      </div>
    </div>
  );
}
