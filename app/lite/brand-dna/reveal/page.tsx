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
    <Suspense fallback={<RevealShimmer />}>
      <RevealContent profileId={profileId} />
    </Suspense>
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
      role="status"
      aria-live="polite"
      aria-label="Assembling your Brand DNA"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        textAlign: "center",
        padding: 40,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 11,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "var(--brand-pink)",
          margin: 0,
        }}
      >
        Assembling your Brand DNA
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: "100%",
          maxWidth: 320,
        }}
      >
        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: "rgba(244, 160, 176, 0.18)",
            width: "80%",
            margin: "0 auto",
            animation: "bdaPulse 1800ms ease-in-out infinite",
          }}
        />
        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: "rgba(244, 160, 176, 0.12)",
            width: "55%",
            margin: "0 auto",
            animation: "bdaPulse 1800ms ease-in-out infinite 200ms",
          }}
        />
      </div>
      <style>{`
        @keyframes bdaPulse { 0%,100% { opacity: 0.55 } 50% { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] > div > div { animation: none !important; opacity: 0.7 !important; }
        }
      `}</style>
    </div>
  );
}
