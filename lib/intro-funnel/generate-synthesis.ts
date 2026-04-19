/**
 * Reflection synthesis generator — Opus-tier.
 *
 * Reads reflection answers + Brand DNA + signal tags + questionnaire answers,
 * generates a 2–4 paragraph prose synthesis in SuperBad voice, drift-checks
 * before display. Fallback text on drift failure.
 *
 * Owner: IF-3. Consumer: reflection-actions.ts (completeReflection).
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_reflections } from "@/lib/db/schema/intro-funnel-reflections";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import { logActivity } from "@/lib/activity-log";

const PROMPT_VERSION = "v1";

const FALLBACK_SYNTHESIS =
  "You showed up. That's the part most people talk about but don't do.\n\n" +
  "Everything from the shoot — the photos, the video, the plan — it's in your portal " +
  "whenever you're ready to look at it properly. Take your time with it.\n\n" +
  "If something clicks, you know where to find us.";

export type SynthesisResult =
  | { ok: true; text: string; driftPassed: boolean }
  | { ok: false; reason: "kill_switch" | "safety_valve" | "generation_failed"; fallbackText: string };

export async function generateReflectionSynthesis(
  reflectionId: string,
): Promise<SynthesisResult> {
  if (!killSwitches.llm_calls_enabled) {
    return { ok: false, reason: "kill_switch", fallbackText: FALLBACK_SYNTHESIS };
  }

  const reflection = await db
    .select()
    .from(intro_funnel_reflections)
    .where(eq(intro_funnel_reflections.id, reflectionId))
    .get();

  if (!reflection) {
    return { ok: false, reason: "generation_failed", fallbackText: FALLBACK_SYNTHESIS };
  }

  if (reflection.safety_valve_triggered) {
    return { ok: false, reason: "safety_valve", fallbackText: FALLBACK_SYNTHESIS };
  }

  const submission = await db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.id, reflection.submission_id))
    .get();

  if (!submission) {
    return { ok: false, reason: "generation_failed", fallbackText: FALLBACK_SYNTHESIS };
  }

  const brandDna = await db
    .select()
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.is_superbad_self, true),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .get();

  const brandContext = brandDna?.prose_portrait
    ? `SUPERBAD BRAND DNA PROFILE:\n${brandDna.prose_portrait}`
    : "SUPERBAD BRAND DNA: Dry, observational, self-deprecating, slow burn. Melbourne wit. Honest first. Never explains the joke.";

  const answers = reflection.answers_json as Record<string, string> | null;
  const questionnaireAnswers = submission.questionnaire_answers_json as Record<string, unknown> | null;
  const signalTags = submission.signal_tags_json as string[] | null;

  const prompt = buildSynthesisPrompt({
    answers: answers ?? {},
    shape: submission.shape,
    signalTags: signalTags ?? [],
    questionnaireAnswers: questionnaireAnswers ?? {},
    prospectName: submission.submitted_name,
    businessName: submission.submitted_business_name,
  });

  try {
    const text = await invokeLlmText({
      job: "intro-funnel-reflection-synthesis",
      system: brandContext,
      prompt,
      maxTokens: 1024,
    });

    if (!text) {
      return { ok: false, reason: "generation_failed", fallbackText: FALLBACK_SYNTHESIS };
    }

    const brandProfile = await getSuperbadBrandProfile();
    const driftResult = await checkBrandVoiceDrift(text, brandProfile);

    const nowMs = Date.now();
    await db
      .update(intro_funnel_reflections)
      .set({
        synthesis_text: driftResult.pass ? text : FALLBACK_SYNTHESIS,
        synthesis_model: "claude-opus-4-6",
        synthesis_prompt_version: PROMPT_VERSION,
        synthesis_drift_check_passed: driftResult.pass,
        synthesis_generated_at_ms: nowMs,
      })
      .where(eq(intro_funnel_reflections.id, reflectionId));

    await logActivity({
      dealId: reflection.deal_id,
      kind: "reflection_complete",
      body: driftResult.pass
        ? "Reflection synthesis generated"
        : "Reflection synthesis drift-failed — fallback used",
      meta: {
        reflection_id: reflectionId,
        drift_score: driftResult.score,
        drift_passed: driftResult.pass,
      },
    });

    return {
      ok: true,
      text: driftResult.pass ? text : FALLBACK_SYNTHESIS,
      driftPassed: driftResult.pass,
    };
  } catch (e) {
    await db
      .update(intro_funnel_reflections)
      .set({
        synthesis_text: FALLBACK_SYNTHESIS,
        synthesis_model: "claude-opus-4-6",
        synthesis_prompt_version: PROMPT_VERSION,
        synthesis_drift_check_passed: false,
        synthesis_generated_at_ms: Date.now(),
      })
      .where(eq(intro_funnel_reflections.id, reflectionId));

    return { ok: false, reason: "generation_failed", fallbackText: FALLBACK_SYNTHESIS };
  }
}

interface SynthesisPromptInputs {
  answers: Record<string, string>;
  shape: string;
  signalTags: string[];
  questionnaireAnswers: Record<string, unknown>;
  prospectName: string;
  businessName: string;
}

function buildSynthesisPrompt(inputs: SynthesisPromptInputs): string {
  const parts: string[] = [];

  parts.push(
    "You are writing a short personal synthesis for someone who just completed a trial shoot with SuperBad Marketing.",
  );
  parts.push(
    `The prospect's name is ${inputs.prospectName} and their business is ${inputs.businessName}.`,
  );
  parts.push(`Business type: ${inputs.shape.replace(/_/g, " ")}.`);

  if (inputs.signalTags.length > 0) {
    parts.push(`Signal tags from their questionnaire: ${inputs.signalTags.join(", ")}.`);
  }

  if (Object.keys(inputs.questionnaireAnswers).length > 0) {
    parts.push(`Onboarding questionnaire answers:\n${JSON.stringify(inputs.questionnaireAnswers, null, 2)}`);
  }

  parts.push(`Post-shoot reflection answers:\n${JSON.stringify(inputs.answers, null, 2)}`);

  parts.push(`
Write 2–4 paragraphs that:
1. Mirror back what they said — use their own language where possible
2. Connect their business situation to what they experienced in the shoot
3. Name what's actually at stake for them (not in a dramatic way — in a matter-of-fact way)
4. End on a note that makes continuation feel like the obvious next step, without asking for it

Voice rules:
- Dry, observational, warm. Never urgent. Never salesy.
- Short sentences. Leave room.
- You can be direct about what you see — this person just spent an hour with Andy and $297. They can handle honesty.
- Never use: "synergy", "leverage", "solutions", "unlock", "journey", "transform"
- Never explain SuperBad's services. The prospect knows what happened.

Output: plain text only. No markdown, no headers, no formatting. Just paragraphs separated by blank lines.`);

  return parts.join("\n\n");
}

export { FALLBACK_SYNTHESIS };
