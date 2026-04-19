import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmTextWithMeta } from "@/lib/ai/invoke";
import { modelTierFor } from "@/lib/ai/models";
import settingsRegistry from "@/lib/settings";
import { assembleSixWeekContext } from "./assemble-context";
import {
  buildStrategyPrompt,
  type StrategyOutput,
} from "@/lib/ai/prompts/six-week-plan/strategy";
import {
  buildWeeksPrompt,
  type WeeksOutput,
} from "@/lib/ai/prompts/six-week-plan/weeks";
import { buildReviewPrompt, type ReviewOutput } from "@/lib/ai/prompts/six-week-plan/review";

const PROMPT_VERSION = "v1";

const USD_TO_AUD = 1.55;

const TIER_RATES_USD: Record<string, { input: number; output: number }> = {
  opus: { input: 15 / 1_000_000, output: 75 / 1_000_000 },
  sonnet: { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  haiku: { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
};

function estimateCostAud(
  tier: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = TIER_RATES_USD[tier] ?? TIER_RATES_USD.sonnet;
  const usd = inputTokens * rates.input + outputTokens * rates.output;
  return Math.round(usd * USD_TO_AUD * 10000) / 10000;
}

const StrategyOutputSchema = z.object({
  current_state_diagnosis: z.string(),
  primary_goal: z.string(),
  chosen_primitives: z.array(z.string()),
  theme_arc: z.array(
    z.object({
      week_number: z.number(),
      theme: z.string(),
    }),
  ),
  flagged_assumptions: z.array(
    z.object({
      statement: z.string(),
      confidence: z.enum(["low", "medium", "high"]),
      what_to_verify: z.string(),
    }),
  ),
});

const weekNumberSchema = z.number().refine(
  (n): n is 1 | 2 | 3 | 4 | 5 | 6 => n >= 1 && n <= 6,
);

const WeeksOutputSchema = z.object({
  plan_intro: z.string(),
  weeks: z.array(
    z.object({
      week_number: weekNumberSchema,
      theme: z.string(),
      why_this_week: z.string(),
      content_angles: z.array(
        z.object({
          description: z.string(),
          shoot_asset_ref: z.string(),
          caption_direction: z.string(),
        }),
      ),
      channel_mix: z.array(z.string()),
      tasks: z.array(
        z.object({
          title: z.string(),
          detail: z.string(),
          category: z.enum([
            "infrastructure",
            "content",
            "distribution",
            "conversion",
            "measurement",
          ]),
          effort_estimate: z.enum(["quick", "half_day", "full_day", "multi_day"]),
        }),
      ),
      success_signal: z.string(),
      fallback: z.string(),
    }),
  ),
});

const ReviewOutputSchema = z.object({
  passes: z.boolean(),
  issues: z.array(z.string()),
});

function parseJsonResponse<T>(text: string, schema: z.ZodType<T>): T | null {
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "");
    return schema.parse(JSON.parse(cleaned));
  } catch {
    return null;
  }
}

async function logExternalCall(
  job: string,
  dealId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  const tier = modelTierFor(job as Parameters<typeof modelTierFor>[0]);
  await db.insert(external_call_log).values({
    id: randomUUID(),
    job,
    actor_type: "internal",
    actor_id: dealId,
    units: JSON.stringify({ input_tokens: inputTokens, output_tokens: outputTokens }),
    estimated_cost_aud: estimateCostAud(tier, inputTokens, outputTokens),
    prompt_version_hash: PROMPT_VERSION,
    created_at_ms: Date.now(),
  });
}

export type GenerateResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function generateSixWeekPlan(
  planId: string,
  dealId: string,
  regenNote?: string | null,
): Promise<GenerateResult> {
  const now = Date.now();

  await db
    .update(six_week_plans)
    .set({ status: "generating", updated_at_ms: now })
    .where(eq(six_week_plans.id, planId));

  await logActivity({
    dealId,
    kind: "six_week_plan_generation_started",
    body: "Six-week plan generation started.",
    meta: { plan_id: planId },
  });

  const contextBundle = await assembleSixWeekContext(dealId);

  // ── Stage 1: Strategy Outline ────────────────────────────────────
  const strategyPrompt = buildStrategyPrompt({
    contextBundle,
    regenNote,
  });

  const strategyResult = await invokeLlmTextWithMeta({
    job: "six-week-plan-strategy",
    prompt: strategyPrompt,
    maxTokens: 4096,
  });

  await logExternalCall(
    "six-week-plan-strategy",
    dealId,
    strategyResult.inputTokens,
    strategyResult.outputTokens,
  );

  const strategyOutput = parseJsonResponse(strategyResult.text, StrategyOutputSchema);
  if (!strategyOutput) {
    await db
      .update(six_week_plans)
      .set({ status: "pending_strategy_review", updated_at_ms: Date.now() })
      .where(eq(six_week_plans.id, planId));
    return { ok: false, reason: "Stage 1 output failed to parse as valid JSON." };
  }

  await db
    .update(six_week_plans)
    .set({
      strategy_json: strategyOutput,
      strategy_generated_at_ms: Date.now(),
      status: "pending_strategy_review",
      updated_at_ms: Date.now(),
    })
    .where(eq(six_week_plans.id, planId));

  await logActivity({
    dealId,
    kind: "six_week_plan_strategy_ready_for_review",
    body: "Strategy outline ready for review.",
    meta: { plan_id: planId },
  });

  return { ok: true };
}

export async function generateWeeksFromStrategy(
  planId: string,
  dealId: string,
  regenNote?: string | null,
  regenWeekNumbers?: number[] | null,
  selfReviewIssues?: string[] | null,
): Promise<GenerateResult> {
  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return { ok: false, reason: "Plan not found." };

  const strategyOutput = plan.strategy_json as unknown as StrategyOutput | null;
  if (!strategyOutput) return { ok: false, reason: "No strategy output to build from." };

  const contextBundle = await assembleSixWeekContext(dealId);

  const weeksPrompt = buildWeeksPrompt({
    contextBundle,
    strategyOutline: strategyOutput,
    regenNote,
    regenWeekNumbers,
    selfReviewIssues,
  });

  const weeksResult = await invokeLlmTextWithMeta({
    job: "six-week-plan-weeks",
    prompt: weeksPrompt,
    maxTokens: 8192,
  });

  await logExternalCall(
    "six-week-plan-weeks",
    dealId,
    weeksResult.inputTokens,
    weeksResult.outputTokens,
  );

  const weeksOutput = parseJsonResponse(weeksResult.text, WeeksOutputSchema);
  if (!weeksOutput) {
    return { ok: false, reason: "Stage 2 output failed to parse as valid JSON." };
  }

  // ── Self-review pass ─────────────────────────────────────────────
  const signalEnergy = (contextBundle.shootDayNotes?.signals.energy) ?? 3;

  const reviewPrompt = buildReviewPrompt({
    planJson: weeksOutput,
    signalEnergy,
  });

  const reviewResult = await invokeLlmTextWithMeta({
    job: "six-week-plan-review",
    prompt: reviewPrompt,
    maxTokens: 2048,
  });

  await logExternalCall(
    "six-week-plan-review",
    dealId,
    reviewResult.inputTokens,
    reviewResult.outputTokens,
  );

  const reviewOutput = parseJsonResponse(reviewResult.text, ReviewOutputSchema);
  const maxRetries = await settingsRegistry.get("plan.self_review_retry_on_fail");

  if (reviewOutput && !reviewOutput.passes && !selfReviewIssues && maxRetries > 0) {
    // One retry — re-run stage 2 with issues injected
    return generateWeeksFromStrategy(
      planId,
      dealId,
      regenNote,
      regenWeekNumbers,
      reviewOutput.issues,
    );
  }

  const selfReviewPassed = reviewOutput?.passes ?? true;
  const selfReviewIssuesJson = reviewOutput && !reviewOutput.passes
    ? reviewOutput.issues
    : null;

  await db
    .update(six_week_plans)
    .set({
      weeks_json: weeksOutput,
      weeks_generated_at_ms: Date.now(),
      self_review_passed: selfReviewPassed,
      self_review_issues_json: selfReviewIssuesJson,
      status: "pending_detail_review",
      updated_at_ms: Date.now(),
    })
    .where(eq(six_week_plans.id, planId));

  await logActivity({
    dealId,
    kind: "six_week_plan_detail_ready_for_review",
    body: selfReviewPassed
      ? "Weekly plan detail ready for review."
      : "Weekly plan detail ready for review (self-review flagged issues).",
    meta: {
      plan_id: planId,
      self_review_passed: selfReviewPassed,
      self_review_issues: selfReviewIssuesJson,
    },
  });

  return { ok: true };
}

export async function runFullPipeline(
  planId: string,
  dealId: string,
  regenNote?: string | null,
): Promise<GenerateResult> {
  const strategyResult = await generateSixWeekPlan(planId, dealId, regenNote);
  if (!strategyResult.ok) return strategyResult;

  return generateWeeksFromStrategy(planId, dealId);
}
