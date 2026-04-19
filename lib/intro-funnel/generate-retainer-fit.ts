/**
 * Retainer-fit recommendation generator — Opus-tier.
 *
 * Fires after reflection completes (including safety-valve path). Reads
 * the full context bundle: onboarding questionnaire + enrichment + reflection
 * + synthesis + Brand DNA + standing brief. Outputs structured JSON.
 *
 * INTERNAL-ONLY — must never reach the prospect via any channel.
 *
 * Owner: IF-3. Consumer: reflection-actions.ts (completeReflection).
 */
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_reflections } from "@/lib/db/schema/intro-funnel-reflections";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { intro_funnel_retainer_fit } from "@/lib/db/schema/intro-funnel-retainer-fit";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { deals } from "@/lib/db/schema/deals";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import { logActivity } from "@/lib/activity-log";
import settingsRegistry from "@/lib/settings";
import type {
  RecommendationType,
  RecommendationConfidence,
} from "@/lib/db/schema/intro-funnel-retainer-fit";
import { z } from "zod";

const PROMPT_VERSION = "v1";

const RetainerFitOutputSchema = z.object({
  recommendation_type: z.enum(["retainer", "saas", "neither", "either_strong"]),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning_text: z.string(),
  flags: z.array(
    z.object({
      type: z.string(),
      detail: z.string(),
    }),
  ),
});

export type RetainerFitResult =
  | { ok: true; recommendationType: RecommendationType; confidence: RecommendationConfidence }
  | { ok: false; reason: "kill_switch" | "generation_failed" | "no_reflection" };

// internal-only
export async function generateRetainerFitRecommendation(
  reflectionId: string,
): Promise<RetainerFitResult> {
  if (!killSwitches.llm_calls_enabled) {
    return { ok: false, reason: "kill_switch" };
  }

  const reflection = await db
    .select()
    .from(intro_funnel_reflections)
    .where(eq(intro_funnel_reflections.id, reflectionId))
    .get();

  if (!reflection) {
    return { ok: false, reason: "no_reflection" };
  }

  const submission = await db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.id, reflection.submission_id))
    .get();

  if (!submission) {
    return { ok: false, reason: "generation_failed" };
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
    : "SUPERBAD BRAND DNA: Dry, observational, self-deprecating, slow burn. Melbourne wit. Honest first.";

  const standingBrief = await settingsRegistry.get(
    "trial_shoot.standing_brief" as never,
  ).catch(() => "");

  const prompt = buildRetainerFitPrompt({
    reflectionAnswers: (reflection.answers_json as Record<string, string>) ?? {},
    safetyValveTriggered: reflection.safety_valve_triggered ?? false,
    synthesisText: reflection.synthesis_text ?? null,
    questionnaireAnswers:
      (submission.questionnaire_answers_json as Record<string, unknown>) ?? {},
    signalTags: (submission.signal_tags_json as string[]) ?? [],
    shape: submission.shape,
    prospectName: submission.submitted_name,
    businessName: submission.submitted_business_name,
    standingBrief: typeof standingBrief === "string" ? standingBrief : "",
  });

  const generate = async (amended: boolean): Promise<string> => {
    const amendedNote = amended
      ? "\n\nIMPORTANT: A prior generation failed the brand-voice drift check. Write in Andy's voice: dry, observational, warm, Melbourne wit. Avoid corporate language."
      : "";

    return invokeLlmText({
      job: "intro-funnel-retainer-fit-recommendation",
      system: brandContext,
      prompt: prompt + amendedNote,
      maxTokens: 2048,
    });
  };

  try {
    let text = await generate(false);
    let parsed = parseRetainerFitOutput(text);

    if (!parsed) {
      return { ok: false, reason: "generation_failed" };
    }

    const brandProfile = await getSuperbadBrandProfile();
    let driftResult = await checkBrandVoiceDrift(
      parsed.reasoning_text,
      brandProfile,
    );

    if (!driftResult.pass) {
      text = await generate(true);
      const retryParsed = parseRetainerFitOutput(text);
      if (retryParsed) {
        parsed = retryParsed;
        driftResult = await checkBrandVoiceDrift(
          parsed.reasoning_text,
          brandProfile,
        );
      }
    }

    const nowMs = Date.now();
    await db.insert(intro_funnel_retainer_fit).values({
      id: randomUUID(),
      submission_id: reflection.submission_id,
      deal_id: reflection.deal_id,
      recommendation_type: parsed.recommendation_type,
      confidence: parsed.confidence,
      reasoning_text: parsed.reasoning_text,
      flags_json: parsed.flags,
      model: "claude-opus-4-6",
      prompt_version: PROMPT_VERSION,
      drift_check_passed: driftResult.pass,
      generated_at_ms: nowMs,
    });

    await db
      .update(deals)
      .set({ post_trial_signal: parsed.recommendation_type })
      .where(eq(deals.id, reflection.deal_id));

    await logActivity({
      dealId: reflection.deal_id,
      kind: "retainer_fit_recommendation_ready",
      body: `Retainer-fit recommendation: ${parsed.recommendation_type} (${parsed.confidence} confidence)`,
      meta: {
        reflection_id: reflectionId,
        recommendation_type: parsed.recommendation_type,
        confidence: parsed.confidence,
        drift_passed: driftResult.pass,
        flags_count: parsed.flags.length,
      },
    });

    return {
      ok: true,
      recommendationType: parsed.recommendation_type,
      confidence: parsed.confidence,
    };
  } catch {
    return { ok: false, reason: "generation_failed" };
  }
}

function parseRetainerFitOutput(
  text: string,
): z.infer<typeof RetainerFitOutputSchema> | null {
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "");
    return RetainerFitOutputSchema.parse(JSON.parse(cleaned));
  } catch {
    return null;
  }
}

interface RetainerFitPromptInputs {
  reflectionAnswers: Record<string, string>;
  safetyValveTriggered: boolean;
  synthesisText: string | null;
  questionnaireAnswers: Record<string, unknown>;
  signalTags: string[];
  shape: string;
  prospectName: string;
  businessName: string;
  standingBrief: string;
}

function buildRetainerFitPrompt(inputs: RetainerFitPromptInputs): string {
  const parts: string[] = [];

  parts.push(
    "You are generating an internal retainer-fit recommendation for Andy Robinson at SuperBad Marketing. " +
      "This recommendation is NEVER shown to the prospect — it informs Andy's follow-up strategy.",
  );

  parts.push(
    `Prospect: ${inputs.prospectName}, business: ${inputs.businessName}, type: ${inputs.shape.replace(/_/g, " ")}.`,
  );

  if (inputs.signalTags.length > 0) {
    parts.push(`Signal tags: ${inputs.signalTags.join(", ")}.`);
  }

  parts.push(
    `Onboarding questionnaire answers:\n${JSON.stringify(inputs.questionnaireAnswers, null, 2)}`,
  );
  parts.push(
    `Post-shoot reflection answers:\n${JSON.stringify(inputs.reflectionAnswers, null, 2)}`,
  );

  if (inputs.safetyValveTriggered) {
    parts.push(
      "IMPORTANT: The prospect triggered the safety valve — they indicated something about the shoot wasn't right. " +
        "The safety valve feedback is in the reflection answers under 'safety_valve_feedback'. " +
        "Honour this negative signal. Recommendation should typically be 'neither' unless " +
        "the underlying business signal is exceptionally strong. Include a flag with type 'safety_valve_triggered' " +
        "summarising the feedback. Do not pitch around the negative experience.",
    );
  }

  if (inputs.synthesisText) {
    parts.push(`Synthesis shown to prospect:\n${inputs.synthesisText}`);
  }

  if (inputs.standingBrief) {
    parts.push(`Andy's standing brief:\n${inputs.standingBrief}`);
  }

  parts.push(`
Respond with a JSON object only — no prose, no markdown fences:
{
  "recommendation_type": "retainer" | "saas" | "neither" | "either_strong",
  "confidence": "high" | "medium" | "low",
  "reasoning_text": "<2-3 paragraphs in Andy's voice explaining the recommendation — this is for Andy to read>",
  "flags": [{ "type": "<flag_type>", "detail": "<explanation>" }]
}

recommendation_type:
- "retainer" — this prospect is a strong retainer candidate
- "saas" — better suited for self-serve SaaS products
- "neither" — not a fit right now (timing, budget, negative experience)
- "either_strong" — strong signal for both paths, Andy should gauge preference

Common flag types: budget_concern, timing_issue, safety_valve_triggered, high_engagement, low_engagement, enterprise_signal, sole_trader_signal

Voice for reasoning_text: dry, direct, practical. Write as if Andy is reading a quick brief on who this person is and what they want.`);

  return parts.join("\n\n");
}
