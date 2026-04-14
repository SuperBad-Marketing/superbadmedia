/**
 * Brand DNA Assessment — between-section insight page.
 *
 * Route: /lite/brand-dna/section/[n]/insight  (n = 1–4; section 5 → reflection)
 *
 * Suspense streams a shimmer while Opus generates the section insight
 * (~2–4s), then reveals the Playfair quote + brand-pink attribution + a
 * continue pill to the next section. Visual register matches the mockup
 * `scene-2` insight composition.
 *
 * Owners: BDA-2 (logic), BDA-POLISH-1 (visual port).
 */

import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { generateSectionInsight } from "@/lib/brand-dna/generate-insight";
import { SECTION_TITLES, SECTION_SUBTITLES } from "@/lib/brand-dna/question-bank";
import { InsightRevealClient } from "./insight-reveal-client";

export const metadata: Metadata = {
  title: "Brand DNA — SuperBad",
};

interface InsightPageProps {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ profileId?: string }>;
}

export default async function InsightPage({
  params,
  searchParams,
}: InsightPageProps) {
  const { n } = await params;
  const { profileId } = await searchParams;

  const section = parseInt(n, 10);
  if (isNaN(section) || section < 1 || section > 5) {
    notFound();
  }

  if (!profileId) {
    redirect("/lite/brand-dna");
  }

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
        <NextSectionPill
          nextSection={nextSection as 1 | 2 | 3 | 4 | 5}
          profileId={profileId}
        />
      )}

      {!hasNextSection && (
        <Link
          href={`/lite/brand-dna/reveal?profileId=${profileId}`}
          style={pillStyle}
        >
          See your brand DNA →
        </Link>
      )}
    </main>
  );
}

// ── InsightContent — async, suspends on Opus call ─────────────────────────────

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

// ── InsightShimmer ─────────────────────────────────────────────────────────────

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

// ── NextSectionPill — branded continue affordance ─────────────────────────────

function NextSectionPill({
  nextSection,
  profileId,
}: {
  nextSection: 1 | 2 | 3 | 4 | 5;
  profileId: string;
}) {
  return (
    <Link
      href={`/lite/brand-dna/section/${nextSection}?profileId=${profileId}`}
      style={pillStyle}
      aria-label={`Continue to section ${nextSection}: ${SECTION_TITLES[nextSection]} — ${SECTION_SUBTITLES[nextSection]}`}
    >
      Keep going →
    </Link>
  );
}

const pillStyle: React.CSSProperties = {
  fontFamily: "var(--font-label)",
  fontSize: 11,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "var(--brand-cream)",
  padding: "14px 32px",
  background: "transparent",
  border: "1px solid rgba(253, 245, 230, 0.25)",
  borderRadius: 999,
  textDecoration: "none",
  display: "inline-block",
  transition: "background 300ms cubic-bezier(0.16, 1, 0.3, 1), border-color 300ms cubic-bezier(0.16, 1, 0.3, 1)",
};
