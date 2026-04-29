import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";

import { getPortalSession } from "@/lib/portal/guard";
import { generateSectionInsight } from "@/lib/brand-dna";

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
          attribution={insightAttribution(section, hasNextSection)}
          nextHref={
            hasNextSection
              ? `/lite/portal/brand-dna/section/${nextSection}?profileId=${profileId}`
              : `/lite/portal/brand-dna/reveal?profileId=${profileId}`
          }
          nextLabel={hasNextSection ? "Keep going →" : "See your brand DNA →"}
        />
      </Suspense>

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
      section={section as 1 | 2 | 3 | 4 | 5}
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

