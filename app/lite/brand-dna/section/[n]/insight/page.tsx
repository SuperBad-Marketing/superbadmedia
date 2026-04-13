/**
 * Brand DNA Assessment — between-section insight page.
 *
 * Route: /lite/brand-dna/section/[n]/insight  (n = 1–4; section 5 goes to reflection)
 *
 * Shows a loading shimmer while generating the section insight (Opus call,
 * ~2–4 seconds). Once loaded, reveals the insight text with houseSpring
 * animation followed by the next section's title card.
 *
 * Pattern: async Server Component → Suspense boundary → shimmer fallback.
 * The Opus call blocks the InsightContent render; the shimmer shows
 * immediately via streaming.
 *
 * Owner: BDA-2.
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
    <main className="flex flex-col items-center justify-center min-h-dvh px-6 py-16 gap-10 max-w-xl mx-auto">
      {/* Section completion label */}
      <p
        className="text-xs tracking-widest uppercase"
        style={{ color: "var(--color-neutral-500, #6b7280)" }}
      >
        Section {section} complete
      </p>

      {/* Insight content — suspends while generating */}
      <Suspense fallback={<InsightShimmer />}>
        <InsightContent profileId={profileId} section={section} />
      </Suspense>

      {/* Next section transition — always rendered (below the fold initially) */}
      {hasNextSection && (
        <NextSectionCard
          nextSection={nextSection as 1 | 2 | 3 | 4 | 5}
          profileId={profileId}
        />
      )}

      {/* Section 5 insight leads to complete (BDA-3 reveal stub) */}
      {!hasNextSection && (
        <div className="text-center">
          <p
            className="text-sm mb-4"
            style={{ color: "var(--color-neutral-400, #9ca3af)" }}
          >
            Your Brand DNA is being assembled.
          </p>
          <span
            className="text-xs"
            style={{ color: "var(--color-neutral-600, #525252)" }}
          >
            The reveal is coming in a future update.
          </span>
        </div>
      )}
    </main>
  );
}

// ── InsightContent — async, suspends on Opus call ─────────────────────────────

async function InsightContent({
  profileId,
  section,
}: {
  profileId: string;
  section: number;
}) {
  const insight = await generateSectionInsight(profileId, section);

  return <InsightRevealClient insight={insight} />;
}

// ── InsightShimmer ─────────────────────────────────────────────────────────────

function InsightShimmer() {
  return (
    <div
      className="flex flex-col gap-3 w-full max-w-md animate-pulse"
      aria-label="Loading insight"
      role="status"
    >
      <div
        className="h-4 rounded-full"
        style={{ background: "rgba(255,255,255,0.08)", width: "85%" }}
      />
      <div
        className="h-4 rounded-full"
        style={{ background: "rgba(255,255,255,0.06)", width: "72%" }}
      />
      <div
        className="h-4 rounded-full"
        style={{ background: "rgba(255,255,255,0.06)", width: "60%" }}
      />
    </div>
  );
}

// ── NextSectionCard ────────────────────────────────────────────────────────────

function NextSectionCard({
  nextSection,
  profileId,
}: {
  nextSection: 1 | 2 | 3 | 4 | 5;
  profileId: string;
}) {
  return (
    <div
      className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div>
        <p
          className="text-xs tracking-widest uppercase mb-1"
          style={{ color: "var(--color-neutral-500, #6b7280)" }}
        >
          Up next — Section {nextSection}
        </p>
        <p
          className="text-lg font-semibold"
          style={{ color: "var(--color-neutral-100, #f5f5f5)" }}
        >
          {SECTION_TITLES[nextSection]}
        </p>
        <p
          className="text-sm mt-0.5"
          style={{ color: "var(--color-neutral-400, #9ca3af)" }}
        >
          {SECTION_SUBTITLES[nextSection]}
        </p>
      </div>

      <Link
        href={`/lite/brand-dna/section/${nextSection}?profileId=${profileId}`}
        style={{
          display: "inline-block",
          background: "var(--color-brand-primary, #e8ff47)",
          color: "var(--color-neutral-950, #0a0a0a)",
          borderRadius: "var(--radius-button, 8px)",
          padding: "0.75rem 1.5rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          textDecoration: "none",
          textAlign: "center",
        }}
      >
        Continue →
      </Link>
    </div>
  );
}
