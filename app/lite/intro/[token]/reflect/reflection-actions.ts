"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_reflections } from "@/lib/db/schema/intro-funnel-reflections";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { logActivity } from "@/lib/activity-log";

interface SaveAnswerInput {
  submissionId: string;
  dealId: string;
  questionIndex: number;
  answer: string;
  reflectionId?: string;
}

export async function saveReflectionAnswer(
  input: SaveAnswerInput,
): Promise<{ reflectionId: string }> {
  const nowMs = Date.now();

  if (input.reflectionId) {
    const existing = await db
      .select()
      .from(intro_funnel_reflections)
      .where(eq(intro_funnel_reflections.id, input.reflectionId))
      .limit(1);

    if (existing[0]) {
      const answers = (existing[0].answers_json as Record<string, string>) ?? {};
      answers[`q${input.questionIndex}`] = input.answer;

      await db
        .update(intro_funnel_reflections)
        .set({ answers_json: answers })
        .where(eq(intro_funnel_reflections.id, input.reflectionId));

      return { reflectionId: input.reflectionId };
    }
  }

  const id = randomUUID();
  const answers: Record<string, string> = {
    [`q${input.questionIndex}`]: input.answer,
  };

  await db.insert(intro_funnel_reflections).values({
    id,
    submission_id: input.submissionId,
    deal_id: input.dealId,
    answers_json: answers,
    safety_valve_triggered: false,
    created_at_ms: nowMs,
  });

  return { reflectionId: id };
}

export async function triggerSafetyValve(
  reflectionId: string,
  submissionId: string,
  dealId: string,
  feedback: string,
): Promise<void> {
  const nowMs = Date.now();

  const existing = await db
    .select()
    .from(intro_funnel_reflections)
    .where(eq(intro_funnel_reflections.id, reflectionId))
    .limit(1);

  const answers = (existing[0]?.answers_json as Record<string, string>) ?? {};
  answers.safety_valve_feedback = feedback;

  await db
    .update(intro_funnel_reflections)
    .set({
      safety_valve_triggered: true,
      answers_json: answers,
      completed_at_ms: nowMs,
    })
    .where(eq(intro_funnel_reflections.id, reflectionId));

  await db
    .update(intro_funnel_submissions)
    .set({
      funnel_state: "reflection_complete",
      last_activity_at_ms: nowMs,
    })
    .where(eq(intro_funnel_submissions.id, submissionId));

  await logActivity({
    dealId,
    kind: "post_trial_negative_feedback",
    body: "Safety valve triggered during reflection — urgent follow-up needed",
    meta: { reflection_id: reflectionId, feedback_length: feedback.length },
  });
}

export async function completeReflection(
  reflectionId: string,
  submissionId: string,
  dealId: string,
): Promise<void> {
  const nowMs = Date.now();

  await db
    .update(intro_funnel_reflections)
    .set({ completed_at_ms: nowMs })
    .where(eq(intro_funnel_reflections.id, reflectionId));

  await db
    .update(intro_funnel_submissions)
    .set({
      funnel_state: "reflection_complete",
      last_activity_at_ms: nowMs,
    })
    .where(eq(intro_funnel_submissions.id, submissionId));

  await logActivity({
    dealId,
    kind: "reflection_complete",
    body: "Post-shoot reflection completed",
    meta: { reflection_id: reflectionId },
  });
}

export async function recordDecision(
  reflectionId: string,
  choice: "yes_talk" | "think_about_it",
): Promise<void> {
  await db
    .update(intro_funnel_reflections)
    .set({
      decision_cta_choice: choice,
      decision_made_at_ms: Date.now(),
    })
    .where(eq(intro_funnel_reflections.id, reflectionId));
}
