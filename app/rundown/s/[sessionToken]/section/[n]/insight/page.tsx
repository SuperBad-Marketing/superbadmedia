import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { generateSectionInsight } from "@/lib/brand-dna/generate-insight";
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
          attribution={insightAttribution(section, hasNextSection)}
          nextHref={
            hasNextSection
              ? `${base}/section/${nextSection}`
              : `${base}/reveal`
          }
          nextLabel={hasNextSection ? "Keep going →" : "See your brand DNA →"}
        />
      </Suspense>
    </main>
  );
}

function insightAttribution(section: number, hasNext: boolean): string {
  if (!hasNext) return "that's the last one.";
  const remaining = 5 - section;
  const count = `${remaining} ${remaining === 1 ? "section" : "sections"} to go.`;
  if (section === 1) return `just getting started. ${count}`;
  if (section === 2) return `getting there. ${count}`;
  if (section === 3) return `past the halfway mark. ${count}`;
  return `almost there. ${count}`;
}

async function InsightContent({
  profileId,
  section,
  attribution,
  nextHref,
  nextLabel,
}: {
  profileId: string;
  section: number;
  attribution: string;
  nextHref: string;
  nextLabel: string;
}) {
  const insight = await generateSectionInsight(profileId, section);
  return (
    <InsightRevealClient
      insight={insight}
      attribution={attribution}
      nextHref={nextHref}
      nextLabel={nextLabel}
    />
  );
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

