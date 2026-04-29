import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { generateSectionInsight } from "@/lib/brand-dna/generate-insight";
import { SECTION_TITLES, SECTION_SUBTITLES } from "@/lib/brand-dna/question-bank";
import { InsightRevealClient } from "@/app/lite/brand-dna/section/[n]/insight/insight-reveal-client";

export const metadata: Metadata = { title: "Brand DNA — SuperBad" };

interface Props {
  params: Promise<{ sessionToken: string; n: string }>;
}

export default async function RundownInsightPage({ params }: Props) {
  const { sessionToken, n } = await params;
  const section = parseInt(n, 10);
  if (isNaN(section) || section < 1 || section > 5) notFound();

  const session = await db.query.rundownSessions.findFirst({
    where: eq(rundownSessions.session_token, sessionToken),
  });
  if (!session?.profile_id) notFound();
  const profileId = session.profile_id;

  const base = `/rundown/s/${sessionToken}`;
  const nextSection = section + 1;
  const hasNextSection = nextSection <= 5;

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        gap: 40,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "var(--brand-pink)",
          margin: 0,
        }}
      >
        Between sections · a small observation
      </p>

      <Suspense fallback={<InsightShimmer />}>
        <InsightContent
          profileId={profileId}
          section={section}
          attribution={
            hasNextSection
              ? `halfway-ish. ${5 - section} ${5 - section === 1 ? "section" : "sections"} to go.`
              : "that's the last one."
          }
        />
      </Suspense>

      {hasNextSection && (
        <Link
          href={`${base}/section/${nextSection}`}
          style={pillStyle}
          aria-label={`Continue to section ${nextSection}: ${SECTION_TITLES[nextSection as 1 | 2 | 3 | 4 | 5]} — ${SECTION_SUBTITLES[nextSection as 1 | 2 | 3 | 4 | 5]}`}
        >
          Keep going →
        </Link>
      )}

      {!hasNextSection && (
        <Link href={`${base}/reveal`} style={pillStyle}>
          See your brand DNA →
        </Link>
      )}
    </main>
  );
}

async function InsightContent({
  profileId,
  section,
  attribution,
}: {
  profileId: string;
  section: number;
  attribution: string;
}) {
  const insight = await generateSectionInsight(profileId, section);
  return <InsightRevealClient insight={insight} attribution={attribution} />;
}

function InsightShimmer() {
  return (
    <div
      role="status"
      aria-label="Loading insight"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: "100%",
        maxWidth: 480,
      }}
      className="bda-shimmer"
    >
      {[0.85, 0.7, 0.55].map((w, i) => (
        <div
          key={i}
          style={{
            height: 14,
            borderRadius: 999,
            background: `rgba(244, 160, 176, ${0.18 - i * 0.04})`,
            width: `${Math.round(w * 100)}%`,
            margin: "0 auto",
          }}
        />
      ))}
      <style>{`
        @keyframes bdaPulse { 0%,100% { opacity: 0.55 } 50% { opacity: 1 } }
        .bda-shimmer > div { animation: bdaPulse 1800ms ease-in-out infinite; }
      `}</style>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  fontFamily: "var(--font-label)",
  fontSize: 11,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "var(--brand-cream)",
  padding: "16px 36px",
  background: "rgba(253, 245, 230, 0.04)",
  border: "1px solid rgba(253, 245, 230, 0.15)",
  borderRadius: 999,
  textDecoration: "none",
  display: "inline-block",
  backdropFilter: "blur(8px)",
  transition: "background 300ms, border-color 300ms",
};
