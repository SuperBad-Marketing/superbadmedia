import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { getPortalSession } from "@/lib/portal/guard";
import { generateSectionInsight } from "@/lib/brand-dna";
import { SECTION_TITLES, SECTION_SUBTITLES } from "@/lib/brand-dna/question-bank";

import { InsightRevealClient } from "@/app/lite/brand-dna/section/[n]/insight/insight-reveal-client";

/**
 * Portal Brand DNA — between-section insight page.
 *
 * Matches the admin insight page styling (BDA-POLISH-1 register).
 *
 * Owner: BDA-5.
 */
export default async function PortalBrandDnaInsightPage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ profileId?: string }>;
}) {
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }

  const { n } = await params;
  const section = parseInt(n, 10);
  if (isNaN(section) || section < 1 || section > 4) {
    notFound();
  }

  const { profileId } = await searchParams;
  if (!profileId) {
    redirect("/lite/portal/brand-dna");
  }

  const nextSection = section + 1;
  const hasNextSection = nextSection <= 5;

  return (
    <main
      className="bda-insight-main"
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
          href={`/lite/portal/brand-dna/section/${nextSection}?profileId=${profileId}`}
          style={pillStyle}
          aria-label={`Continue to section ${nextSection}: ${SECTION_TITLES[nextSection as 1 | 2 | 3 | 4 | 5]} — ${SECTION_SUBTITLES[nextSection as 1 | 2 | 3 | 4 | 5]}`}
        >
          Keep going →
        </Link>
      )}

      {!hasNextSection && (
        <Link
          href={`/lite/portal/brand-dna/reveal?profileId=${profileId}`}
          style={pillStyle}
        >
          See your brand DNA →
        </Link>
      )}

      <style>{`
        @media (max-width: 640px) {
          .bda-insight-main {
            padding: 24px 20px !important;
            gap: 28px !important;
          }
        }
      `}</style>
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
      <div style={shimmerLine(0.85, "rgba(244, 160, 176, 0.18)")} />
      <div style={shimmerLine(0.7, "rgba(244, 160, 176, 0.12)")} />
      <div style={shimmerLine(0.55, "rgba(244, 160, 176, 0.1)")} />
      <style>{`
        @keyframes bdaPulse { 0%,100% { opacity: 0.55 } 50% { opacity: 1 } }
        .bda-shimmer > div { animation: bdaPulse 1800ms ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .bda-shimmer > div { animation: none; opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

function shimmerLine(width: number, bg: string): React.CSSProperties {
  return {
    height: 14,
    borderRadius: 999,
    background: bg,
    width: `${Math.round(width * 100)}%`,
    margin: "0 auto",
  };
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
  boxShadow: "inset 0 1px 0 rgba(253, 245, 230, 0.06)",
  transition:
    "background 300ms cubic-bezier(0.16, 1, 0.3, 1), border-color 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1)",
};
