import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";
import { getQuestionsForSection, SECTION_TITLES } from "@/lib/brand-dna/question-bank";

import { QuestionCardClient } from "@/app/lite/brand-dna/section/[n]/question-card-client";
import { submitRundownAnswer, rundownGoBack } from "../../actions";

export const metadata: Metadata = { title: "Brand DNA | SuperBad" };

interface Props {
  params: Promise<{ sessionToken: string; n: string }>;
}

export default async function RundownSectionPage({ params }: Props) {
  const { sessionToken, n } = await params;
  const section = parseInt(n, 10);
  if (isNaN(section) || section < 1 || section > 5) notFound();
  const sectionNum = section as 1 | 2 | 3 | 4 | 5;

  const session = await db.query.rundownSessions.findFirst({
    where: eq(rundownSessions.session_token, sessionToken),
  });
  if (!session?.profile_id) notFound();
  const profileId = session.profile_id;

  const questions = getQuestionsForSection(sectionNum);

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
  const nextQuestion = questions.find((q) => !answeredIds.has(q.id));

  if (!nextQuestion) {
    if (sectionNum === 5) {
      redirect(`/rundown/s/${sessionToken}/section/5/reflection`);
    } else {
      redirect(`/rundown/s/${sessionToken}/section/${sectionNum}/insight`);
    }
  }

  const profileRows = await db
    .select({ track: brand_dna_profiles.track })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const questionIndex = questions.findIndex((q) => q.id === nextQuestion.id);

  const boundSubmit = submitRundownAnswer.bind(null, sessionToken);
  const boundGoBack = rundownGoBack.bind(null, sessionToken);

  return (
    <QuestionCardClient
      question={nextQuestion}
      profileId={profileId}
      section={sectionNum}
      questionIndex={questionIndex}
      totalInSection={questions.length}
      sectionTitle={SECTION_TITLES[sectionNum]}
      track={profileRows[0]?.track ?? null}
      submitAction={boundSubmit}
      goBackAction={boundGoBack}
    />
  );
}
