import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";

import { getPortalSession } from "@/lib/portal/guard";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { generateSectionInsight } from "@/lib/brand-dna";
import { SECTION_TITLES } from "@/lib/brand-dna/question-bank";

import { InsightRevealClient } from "@/app/lite/brand-dna/section/[n]/insight/insight-reveal-client";

/**
 * Portal Brand DNA — between-section insight page.
 *
 * Reuses the admin InsightRevealClient with portal routing.
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
  const sectionTitle = SECTION_TITLES[section as 1 | 2 | 3 | 4] ?? `Section ${section}`;

  return (
    <main
      className="bda-insight-main"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        gap: 48,
      }}
    >
      <Suspense fallback={<InsightShimmer sectionTitle={sectionTitle} />}>
        <InsightContent profileId={profileId} section={section} />
      </Suspense>

      <Link
        href={`/lite/portal/brand-dna/section/${nextSection}?profileId=${profileId}`}
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 11,
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--brand-cream)",
          background: "var(--brand-red, #c23b22)",
          border: "none",
          borderRadius: 999,
          padding: "14px 32px",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        Section {nextSection} of 5
      </Link>

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
}: {
  profileId: string;
  section: number;
}) {
  const insight = await generateSectionInsight(profileId, section);
  return <InsightRevealClient insight={insight} />;
}

function InsightShimmer({ sectionTitle }: { sectionTitle: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        opacity: 0.6,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "var(--brand-pink)",
        }}
      >
        {sectionTitle} — processing
      </span>
      <div
        style={{
          width: 200,
          height: 2,
          background:
            "linear-gradient(90deg, transparent, var(--brand-pink), transparent)",
          animation: "shimmer 1.5s ease-in-out infinite",
        }}
      />
    </div>
  );
}
