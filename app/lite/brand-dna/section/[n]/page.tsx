/**
 * Brand DNA Assessment — card-per-question page.
 *
 * Route: /lite/brand-dna/section/[n]  (n = 1–5)
 *
 * Shows one question at a time. Determines the next unanswered question by
 * comparing existing brand_dna_answers against the question bank. Redirects
 * to the insight page (sections 1–4) or reflection page (section 5) once all
 * section questions are answered.
 *
 * profileId is resolved from the URL search param first; if absent, falls
 * back to the authenticated user's superbad_self profile.
 *
 * Owner: BDA-2.
 */

import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";
import { getQuestionsForSection, SECTION_TITLES } from "@/lib/brand-dna/question-bank";

import { submitAnswer } from "../../actions";
import { QuestionCardClient } from "./question-card-client";

export const metadata: Metadata = {
  title: "Brand DNA — SuperBad",
};

interface SectionPageProps {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ profileId?: string }>;
}

export default async function SectionPage({
  params,
  searchParams,
}: SectionPageProps) {
  const { n } = await params;
  const { profileId: profileIdParam } = await searchParams;

  // ── Validate section number ───────────────────────────────────────────────
  const section = parseInt(n, 10);
  if (isNaN(section) || section < 1 || section > 5) {
    notFound();
  }
  const sectionNum = section as 1 | 2 | 3 | 4 | 5;

  // ── Resolve profile ID ────────────────────────────────────────────────────
  let profileId = profileIdParam ?? null;

  if (!profileId) {
    const session = await auth();
    if (!session?.user?.id) {
      redirect("/lite/login");
    }
    const rows = await db
      .select({ id: brand_dna_profiles.id })
      .from(brand_dna_profiles)
      .where(
        and(
          eq(brand_dna_profiles.subject_type, "superbad_self"),
          eq(brand_dna_profiles.is_current, true),
        ),
      )
      .limit(1);

    profileId = rows[0]?.id ?? null;
  }

  if (!profileId) {
    // No profile found — start from the beginning
    redirect("/lite/brand-dna");
  }

  // ── Get questions for this section ────────────────────────────────────────
  const questions = getQuestionsForSection(sectionNum);

  // ── Get existing answers for this profile + section ───────────────────────
  const answeredRows = await db
    .select({ question_id: brand_dna_answers.question_id })
    .from(brand_dna_answers)
    .where(
      and(
        eq(brand_dna_answers.profile_id, profileId),
        eq(brand_dna_answers.section, section),
      ),
    );

  const answeredIds = new Set(answeredRows.map((r) => r.question_id));

  // ── Find the next unanswered question ─────────────────────────────────────
  const nextQuestion = questions.find((q) => !answeredIds.has(q.id));

  // ── All answered → redirect to insight or reflection ─────────────────────
  if (!nextQuestion) {
    if (sectionNum === 5) {
      redirect(`/lite/brand-dna/section/5/reflection?profileId=${profileId}`);
    } else {
      redirect(
        `/lite/brand-dna/section/${sectionNum}/insight?profileId=${profileId}`,
      );
    }
  }

  // ── Load profile for track context ────────────────────────────────────────
  const profileRows = await db
    .select({ track: brand_dna_profiles.track })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);
  const profile = profileRows[0];

  const questionIndex = questions.findIndex((q) => q.id === nextQuestion.id);
  const totalInSection = questions.length;

  return (
    <QuestionCardClient
      question={nextQuestion}
      profileId={profileId}
      section={sectionNum}
      questionIndex={questionIndex}
      totalInSection={totalInSection}
      sectionTitle={SECTION_TITLES[sectionNum]}
      track={profile?.track ?? null}
      submitAction={submitAnswer}
    />
  );
}
