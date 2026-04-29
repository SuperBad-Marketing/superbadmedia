import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { SECTION_TITLES } from "@/lib/brand-dna/question-bank";
import { generateFirstImpression } from "@/lib/brand-dna/generate-first-impression";
import { generateProsePortrait } from "@/lib/brand-dna/generate-prose-portrait";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

import { RevealClient } from "@/app/lite/brand-dna/reveal/reveal-client";
import { RundownPostReveal } from "./rundown-post-reveal";
import { markRundownProfileComplete } from "../actions";
import { AssemblingShimmer } from "@/components/lite/brand-dna/assembling-shimmer";

export const metadata: Metadata = {
  title: "Brand DNA | SuperBad",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ sessionToken: string }>;
}

export default async function RundownRevealPage({ params }: Props) {
  const { sessionToken } = await params;

  const session = await db.query.rundownSessions.findFirst({
    where: eq(rundownSessions.session_token, sessionToken),
  });
  if (!session?.profile_id || !session.candidate_id) notFound();

  return (
    <>
      <Suspense fallback={<AssemblingShimmer />}>
        <RevealContent
          sessionToken={sessionToken}
          profileId={session.profile_id}
          candidateId={session.candidate_id}
          businessName={session.business_name}
        />
      </Suspense>
    </>
  );
}

async function RevealContent({
  sessionToken,
  profileId,
  candidateId,
  businessName,
}: {
  sessionToken: string;
  profileId: string;
  candidateId: string;
  businessName: string;
}) {
  const [profileRows, candidateRows] = await Promise.all([
    db
      .select()
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, profileId))
      .limit(1),
    db
      .select({ viability_profile_json: leadCandidates.viability_profile_json })
      .from(leadCandidates)
      .where(eq(leadCandidates.id, candidateId))
      .limit(1),
  ]);

  const profile = profileRows[0];
  if (!profile) notFound();

  const firstImpression = await generateFirstImpression(profileId);
  const prosePortrait = await generateProsePortrait(profileId);

  const sectionInsights: string[] = parseSectionInsights(profile.section_insights);
  const sectionTitles: string[] = ([1, 2, 3, 4, 5] as const).map(
    (n) => SECTION_TITLES[n],
  );
  const signalTags = parseSignalTags(profile.signal_tags);

  const enrichmentData = candidateRows[0]?.viability_profile_json as ViabilityProfile | null;

  const boundComplete = markRundownProfileComplete.bind(null, sessionToken);

  return (
    <>
      <RevealClient
        profileId={profileId}
        firstImpression={firstImpression}
        prosePortrait={prosePortrait}
        sectionInsights={sectionInsights}
        sectionTitles={sectionTitles}
        signalTags={signalTags}
        alreadyComplete={profile.status === "complete"}
        markComplete={boundComplete}
      />
      <RundownPostReveal
        sessionToken={sessionToken}
        profileId={profileId}
        businessName={businessName}
        enrichmentData={enrichmentData}
      />
    </>
  );
}


function parseSectionInsights(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s) => typeof s === "string" && s.length > 0);
    }
    if (typeof parsed === "object" && parsed !== null) {
      return Object.values(parsed).filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
    }
  } catch {}
  return [];
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
