import { Suspense } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { getPortalSession } from "@/lib/portal/guard";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { generateFirstImpression, generateProsePortrait } from "@/lib/brand-dna";
import { generateRetakeComparison } from "@/lib/brand-dna/generate-retake-comparison";
import { SECTION_TITLES } from "@/lib/brand-dna/question-bank";

import { PortalRevealClient } from "./portal-reveal-client";

/**
 * Portal Brand DNA — cinematic reveal page.
 *
 * Generates first impression + prose portrait (both cached). For retakes
 * (version > 1), also generates a comparison narrative.
 *
 * Owner: BDA-5.
 */
export default async function PortalBrandDnaRevealPage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string }>;
}) {
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }

  const { profileId } = await searchParams;
  if (!profileId) {
    redirect("/lite/portal/brand-dna");
  }

  return (
    <Suspense fallback={<RevealShimmer />}>
      <RevealContent profileId={profileId} />
    </Suspense>
  );
}

async function RevealContent({ profileId }: { profileId: string }) {
  const profileRows = await db
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profileRows[0];
  if (!profile) {
    redirect("/lite/portal/brand-dna");
  }

  const [firstImpression, prosePortrait] = await Promise.all([
    generateFirstImpression(profileId),
    generateProsePortrait(profileId),
  ]);

  const sectionInsights: string[] = profile.section_insights
    ? (JSON.parse(profile.section_insights) as string[]).filter(
        (s) => typeof s === "string" && s.length > 0,
      )
    : [];

  const sectionTitles: string[] = ([1, 2, 3, 4, 5] as const).map(
    (n) => SECTION_TITLES[n],
  );

  const signalTags = parseSignalTags(profile.signal_tags);

  let comparisonNarrative: string | null = null;
  if (profile.version > 1) {
    const comparison = await generateRetakeComparison(profileId);
    comparisonNarrative = comparison?.comparisonNarrative ?? null;
  }

  return (
    <PortalRevealClient
      profileId={profileId}
      firstImpression={firstImpression}
      prosePortrait={prosePortrait}
      sectionInsights={sectionInsights}
      sectionTitles={sectionTitles}
      signalTags={signalTags}
      alreadyComplete={profile.status === "complete"}
      comparisonNarrative={comparisonNarrative}
    />
  );
}

function parseSignalTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s): s is string => typeof s === "string")
        .slice(0, 8)
        .map((t) => t.replace(/_/g, " "));
    }
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed as Record<string, number>)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 8)
        .map(([tag]) => tag.replace(/_/g, " "));
    }
  } catch {}
  return [];
}

function RevealShimmer() {
  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: "40px 24px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "var(--brand-pink)",
          opacity: 0.7,
        }}
      >
        Assembling your portrait
      </span>
      <div
        style={{
          width: 240,
          height: 2,
          background:
            "linear-gradient(90deg, transparent, var(--brand-pink), transparent)",
          animation: "shimmer 1.5s ease-in-out infinite",
        }}
      />
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontStyle: "italic",
          fontSize: 14,
          color: "var(--neutral-500)",
          maxWidth: 320,
          textAlign: "center",
        }}
      >
        this part takes a moment. worth it.
      </p>
    </main>
  );
}
