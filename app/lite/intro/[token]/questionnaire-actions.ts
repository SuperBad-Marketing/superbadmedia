"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { deals } from "@/lib/db/schema/deals";
import { logActivity } from "@/lib/activity-log";

const answerSchema = z.object({
  submissionId: z.string().min(1),
  questionId: z.string().min(1),
  answer: z.string().max(1000),
});

export async function saveAnswerAction(
  input: z.infer<typeof answerSchema>,
): Promise<{ ok: boolean }> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { submissionId, questionId, answer } = parsed.data;

  const rows = await db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.id, submissionId))
    .limit(1);
  if (rows.length === 0) return { ok: false };

  const submission = rows[0];
  const now = Date.now();

  const existing = (submission.questionnaire_answers_json as Record<string, string>) ?? {};
  existing[questionId] = answer;

  const newState =
    submission.funnel_state === "contact_submitted"
      ? "questionnaire_in_progress"
      : submission.funnel_state;

  await db
    .update(intro_funnel_submissions)
    .set({
      questionnaire_answers_json: existing,
      funnel_state: newState as typeof submission.funnel_state,
      last_activity_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(intro_funnel_submissions.id, submissionId));

  if (newState !== submission.funnel_state) {
    await db
      .update(deals)
      .set({ funnel_state: newState, updated_at_ms: now })
      .where(eq(deals.id, submission.deal_id));
  }

  return { ok: true };
}

const completeSectionSchema = z.object({
  submissionId: z.string().min(1),
  sectionNumber: z.number().int().min(2).max(4),
});

export async function completeSectionAction(
  input: z.infer<typeof completeSectionSchema>,
): Promise<{ ok: boolean; allComplete: boolean }> {
  const parsed = completeSectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, allComplete: false };
  const { submissionId, sectionNumber } = parsed.data;

  const rows = await db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.id, submissionId))
    .limit(1);
  if (rows.length === 0) return { ok: false, allComplete: false };

  const submission = rows[0];
  const now = Date.now();
  const newCount = Math.max(
    submission.questionnaire_sections_completed,
    sectionNumber - 1,
  );
  const allComplete = newCount >= 3;

  const newState = allComplete ? "questionnaire_complete" : submission.funnel_state;

  await db
    .update(intro_funnel_submissions)
    .set({
      questionnaire_sections_completed: newCount,
      funnel_state: newState as typeof submission.funnel_state,
      abandon_sequence_state: allComplete ? "not_applicable" : submission.abandon_sequence_state,
      last_activity_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(intro_funnel_submissions.id, submissionId));

  await db
    .update(deals)
    .set({ funnel_state: newState, updated_at_ms: now })
    .where(eq(deals.id, submission.deal_id));

  await logActivity({
    dealId: submission.deal_id,
    contactId: submission.contact_id,
    kind: "intro_funnel_section_completed",
    body: `Section ${sectionNumber} completed`,
    meta: { section: sectionNumber, sections_total: newCount },
  });

  return { ok: true, allComplete };
}
