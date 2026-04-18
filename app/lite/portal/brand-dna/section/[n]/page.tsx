import { redirect, notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";

import { getPortalSession } from "@/lib/portal/guard";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";
import {
  getQuestionsForSection,
  SECTION_TITLES,
} from "@/lib/brand-dna/question-bank";

import { QuestionCardClient } from "@/app/lite/brand-dna/section/[n]/question-card-client";
import { submitPortalAnswer } from "../../actions";

/**
 * Portal Brand DNA — card-per-question page.
 *
 * Reuses the admin QuestionCardClient component with portal-side actions.
 *
 * Owner: BDA-5.
 */
export default async function PortalBrandDnaSectionPage({
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
  const section = parseInt(n, 10) as 1 | 2 | 3 | 4 | 5;
  if (isNaN(section) || section < 1 || section > 5) {
    notFound();
  }

  const { profileId: profileIdParam } = await searchParams;

  let profileId = profileIdParam;
  if (!profileId) {
    const rows = await db
      .select({ id: brand_dna_profiles.id })
      .from(brand_dna_profiles)
      .where(
        and(
          eq(brand_dna_profiles.contact_id, session.contactId),
          eq(brand_dna_profiles.subject_type, "client"),
          eq(brand_dna_profiles.is_current, true),
        ),
      )
      .limit(1);

    profileId = rows[0]?.id;
    if (!profileId) {
      redirect("/lite/portal/brand-dna");
    }
  }

  const profileRows = await db
    .select({ track: brand_dna_profiles.track })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const track = profileRows[0]?.track ?? null;

  const questions = getQuestionsForSection(section);
  const answered = await db
    .select({ question_id: brand_dna_answers.question_id })
    .from(brand_dna_answers)
    .where(
      and(
        eq(brand_dna_answers.profile_id, profileId),
        eq(brand_dna_answers.section, section),
      ),
    );

  const answeredIds = new Set(answered.map((a) => a.question_id));
  const nextQuestion = questions.find((q) => !answeredIds.has(q.id));

  if (!nextQuestion) {
    if (section === 5) {
      redirect(
        `/lite/portal/brand-dna/section/5/reflection?profileId=${profileId}`,
      );
    } else {
      redirect(
        `/lite/portal/brand-dna/section/${section}/insight?profileId=${profileId}`,
      );
    }
  }

  const questionIndex = questions.findIndex((q) => q.id === nextQuestion.id);
  const sectionTitle = SECTION_TITLES[section as 1 | 2 | 3 | 4 | 5] ?? `Section ${section}`;

  return (
    <QuestionCardClient
      question={nextQuestion}
      profileId={profileId}
      section={section}
      questionIndex={questionIndex}
      totalInSection={questions.length}
      sectionTitle={sectionTitle}
      track={track}
      submitAction={submitPortalAnswer}
    />
  );
}
