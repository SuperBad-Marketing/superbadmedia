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
import { generateSignalScoresIntro } from "@/lib/brand-dna/generate-signal-scores-intro";
import { generateSignalDescriptions } from "@/lib/brand-dna/generate-signal-descriptions";
import { buildSignalScoresData, parseSignalTagNames } from "@/lib/brand-dna/build-signal-scores-data";
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

  const [firstImpression, prosePortrait, signalScoresResult] =
    await Promise.all([
      generateFirstImpression(profileId),
      generateProsePortrait(profileId),
      Promise.all([
        generateSignalScoresIntro(profileId),
        generateSignalDescriptions(profileId),
      ]).catch(() => null),
    ]);

  const signalScoresIntro = signalScoresResult?.[0] ?? "";
  const signalDescriptions = signalScoresResult?.[1] ?? {};

  const sectionInsights: string[] = parseSectionInsights(profile.section_insights);
  const sectionTitles: string[] = ([1, 2, 3, 4, 5] as const).map(
    (n) => SECTION_TITLES[n],
  );

  const { scores, longTail } = buildSignalScoresData(
    profile.signal_tags,
    signalDescriptions,
  );

  const signalTagNames = parseSignalTagNames(profile.signal_tags);
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
        signalScoresIntro={signalScoresIntro}
        signalScores={scores}
        signalScoresLongTail={longTail}
        alreadyComplete={profile.status === "complete"}
        markComplete={boundComplete}
      />
      <RundownPostReveal
        sessionToken={sessionToken}
        profileId={profileId}
        businessName={businessName}
        enrichmentData={enrichmentData}
        signalTags={signalTagNames}
        firstImpression={firstImpression}
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

