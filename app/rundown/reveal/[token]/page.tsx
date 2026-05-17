import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { SECTION_TITLES } from "@/lib/brand-dna/question-bank";
import { generateFirstImpression } from "@/lib/brand-dna/generate-first-impression";
import { generateProsePortrait } from "@/lib/brand-dna/generate-prose-portrait";
import { generateSignalScoresIntro } from "@/lib/brand-dna/generate-signal-scores-intro";
import { generateSignalDescriptions } from "@/lib/brand-dna/generate-signal-descriptions";
import { buildSignalScoresData } from "@/lib/brand-dna/build-signal-scores-data";
import { generateLongTailSummary } from "@/lib/brand-dna/generate-long-tail-summary";
import { generateBrandDnaRevealV2 } from "@/lib/brand-dna/reveal-v2";

import { BrandDnaRevealV2Client } from "@/components/lite/brand-dna/reveal-v2";

export const metadata: Metadata = {
  title: "Your Brand DNA | SuperBad",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function RundownRevealReadOnlyPage({ params }: Props) {
  const { token } = await params;

  const [session] = await db
    .select({
      profile_id: rundownSessions.profile_id,
      session_token: rundownSessions.session_token,
      reveal_access_expires_at_ms: rundownSessions.reveal_access_expires_at_ms,
    })
    .from(rundownSessions)
    .where(eq(rundownSessions.reveal_access_token, token))
    .limit(1);

  if (!session?.profile_id) notFound();

  if (isRevealAccessExpired(session.reveal_access_expires_at_ms)) {
    return (
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
          textAlign: "center",
          gap: 16,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            fontSize: "clamp(1.125rem, 2.5vw, 1.375rem)",
            color: "var(--brand-cream)",
          }}
        >
          This link has expired.
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 15,
            color: "var(--neutral-500)",
          }}
        >
          Your Brand Pack PDF is still available if you have it saved.
          Get in touch if you need a new link.
        </p>
      </main>
    );
  }

  return (
    <Suspense fallback={<RevealShimmer />}>
      <ReadOnlyRevealContent
        profileId={session.profile_id}
        sessionToken={session.session_token}
      />
    </Suspense>
  );
}

async function ReadOnlyRevealContent({
  profileId,
  sessionToken,
}: {
  profileId: string;
  sessionToken: string;
}) {
  const profiles = await db
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) notFound();

  const [, , signalScoresResult] = await Promise.all([
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

  const longTailSummary = await generateLongTailSummary(
    profileId,
    longTail,
    scores.map((s) => s.tag),
  ).catch(() => "");

  const reveal = await generateBrandDnaRevealV2(profileId, sessionToken);

  async function noOp() {
    "use server";
  }

  return (
    <BrandDnaRevealV2Client
      profileId={profileId}
      reveal={reveal}
      sectionInsights={sectionInsights}
      sectionTitles={sectionTitles}
      signalScoresIntro={signalScoresIntro}
      signalScores={scores}
      signalScoresLongTail={longTailSummary}
      alreadyComplete={true}
      markComplete={noOp}
    />
  );
}

function isRevealAccessExpired(expiresAtMs: number | null): boolean {
  return Boolean(expiresAtMs && Date.now() > expiresAtMs);
}

function RevealShimmer() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 48,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-narrative)",
          fontStyle: "italic",
          fontSize: "clamp(1.125rem, 2.5vw, 1.375rem)",
          color: "var(--brand-cream)",
          opacity: 0.5,
          textAlign: "center",
        }}
      >
        Loading your brand identity...
      </p>
      <div
        style={{
          width: 48,
          height: 48,
          border: "2px solid rgba(244, 160, 176, 0.2)",
          borderTopColor: "var(--brand-pink)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
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
