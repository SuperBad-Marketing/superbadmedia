"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_reflections } from "@/lib/db/schema/intro-funnel-reflections";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { logActivity } from "@/lib/activity-log";
import { generateReflectionSynthesis } from "@/lib/intro-funnel/generate-synthesis";
import { generateRetainerFitRecommendation } from "@/lib/intro-funnel/generate-retainer-fit";

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

  // Retainer-fit fires even on safety-valve path (per §13.4 F2.d)
  generateRetainerFitRecommendation(reflectionId).catch(() => {});

  await logActivity({
    dealId,
    kind: "post_trial_negative_feedback",
    body: "Safety valve triggered during reflection, urgent follow-up needed",
    meta: { reflection_id: reflectionId, feedback_length: feedback.length },
  });
}

export async function completeReflection(
  reflectionId: string,
  submissionId: string,
  dealId: string,
): Promise<{ synthesisText: string | null }> {
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

  const synthesisResult = await generateReflectionSynthesis(reflectionId);
  const synthesisText = synthesisResult.ok
    ? synthesisResult.text
    : synthesisResult.fallbackText;

  // Retainer-fit fires in background, including on safety-valve path (per §13.4)
  generateRetainerFitRecommendation(reflectionId).catch(() => {});

  await logActivity({
    dealId,
    kind: "reflection_complete",
    body: "Post-shoot reflection completed",
    meta: { reflection_id: reflectionId },
  });

  return { synthesisText };
}

export async function recordDecision(
  reflectionId: string,
  submissionId: string,
  dealId: string,
  choice: "yes_talk" | "think_about_it",
): Promise<void> {
  const nowMs = Date.now();

  await db
    .update(intro_funnel_reflections)
    .set({
      decision_cta_choice: choice,
      decision_made_at_ms: nowMs,
    })
    .where(eq(intro_funnel_reflections.id, reflectionId));

  if (choice === "yes_talk") {
    await logActivity({
      dealId,
      kind: "intro_funnel_state_transition",
      body: "Prospect chose 'let's talk about what's next', urgent follow-up",
      meta: { reflection_id: reflectionId, decision: "yes_talk" },
    });
  } else {
    await db
      .update(intro_funnel_submissions)
      .set({
        funnel_state: "portal_dormant",
        last_activity_at_ms: nowMs,
      })
      .where(eq(intro_funnel_submissions.id, submissionId));

    await logActivity({
      dealId,
      kind: "intro_funnel_state_transition",
      body: "Prospect chose 'let me think about it', portal transitions to dormant",
      meta: { reflection_id: reflectionId, decision: "think_about_it" },
    });
  }
}
