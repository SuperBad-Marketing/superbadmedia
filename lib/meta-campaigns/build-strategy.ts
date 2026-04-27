/**
 * AI strategy builder — translates high-level campaign inputs into
 * a fully-configured campaign structure (campaigns, ad sets, audiences,
 * budget allocation, creative assignments).
 *
 * This is the brain of step 5 in the wizard: "AI auto-builds the full
 * campaign structure."
 */

import { invokeLlmText } from "@/lib/ai/invoke";
import { db } from "@/lib/db";
import { metaPerformanceBenchmarks } from "@/lib/db/schema/meta-campaigns";
import type {
  CampaignObjective,
  FunnelStage,
  ScalingMode,
} from "@/lib/db/schema/meta-campaigns";

/* ------------------------------------------------------------------ */
/* Input / output types                                                */
/* ------------------------------------------------------------------ */

export interface StrategyInput {
  objective: CampaignObjective;
  monthlyBudgetCents: number;
  durationDays: number;
  contentPoolTag: string;
  creativeCount: number;
  destinationUrl?: string;
  strategyNotes?: string;
  clientVertical?: string;
  location?: string;
}

export interface PlannedAdSet {
  name: string;
  funnelStage: FunnelStage;
  audienceType: string;
  audienceDescription: string;
  budgetAllocationPct: number;
  dailyBudgetCents: number;
  bidStrategy: "lowest_cost" | "cost_cap" | "bid_cap";
  optimizationGoal: string;
  primaryMetric: string;
  ageMin?: number;
  ageMax?: number;
  locations?: string[];
  interests?: string[];
  placements: string[];
}

export interface PlannedCampaign {
  name: string;
  funnelStage: FunnelStage;
  objective: CampaignObjective;
  dailyBudgetCents: number;
  adSets: PlannedAdSet[];
}

export interface CampaignStrategy {
  overview: string;
  funnelStructure: string;
  campaigns: PlannedCampaign[];
  creativeStrategy: string;
  scalingRecommendation: {
    mode: ScalingMode;
    velocityPct: number;
    roasFloor: number | null;
    dailyCapCents: number | null;
    humanCheckpoint: boolean;
    checkpointSpendCents: number | null;
  };
  expectedOutcomes: string;
  risks: string;
}

/* ------------------------------------------------------------------ */
/* Strategy builder                                                    */
/* ------------------------------------------------------------------ */

function loadBenchmarks(): string {
  const rows = db.select().from(metaPerformanceBenchmarks).all();
  if (rows.length === 0) return "No benchmarks loaded — use conservative defaults.";

  return rows
    .map(
      (r) =>
        `${r.funnel_stage}/${r.objective}: ${r.primary_metric} — good: ${r.good_threshold}, scale: ${r.scale_threshold}, kill: ${r.kill_threshold} (${r.metric_unit}, ${r.metric_direction}). Min ${r.min_data_days} days, ${r.min_impressions} impressions. ${r.notes}`,
    )
    .join("\n");
}

const FUNNEL_TEMPLATES: Record<
  CampaignObjective,
  { stages: FunnelStage[]; budgetSplit: Record<FunnelStage, number> }
> = {
  awareness: {
    stages: ["top"],
    budgetSplit: { top: 100, middle: 0, bottom: 0 },
  },
  traffic: {
    stages: ["top", "middle"],
    budgetSplit: { top: 60, middle: 40, bottom: 0 },
  },
  engagement: {
    stages: ["top", "middle"],
    budgetSplit: { top: 50, middle: 50, bottom: 0 },
  },
  leads: {
    stages: ["top", "middle", "bottom"],
    budgetSplit: { top: 40, middle: 30, bottom: 30 },
  },
  conversions: {
    stages: ["top", "middle", "bottom"],
    budgetSplit: { top: 35, middle: 25, bottom: 40 },
  },
};

export async function buildCampaignStrategy(
  input: StrategyInput,
): Promise<CampaignStrategy> {
  const benchmarks = loadBenchmarks();
  const template = FUNNEL_TEMPLATES[input.objective];
  const dailyBudgetCents = Math.round(
    (input.monthlyBudgetCents / 30) * (30 / input.durationDays > 1 ? 1 : 1),
  );
  const actualDailyBudget = Math.round(input.monthlyBudgetCents / 30);

  const prompt = `You are a Meta Ads strategist building a campaign structure.

INPUTS:
- Objective: ${input.objective}
- Monthly budget: $${(input.monthlyBudgetCents / 100).toFixed(2)} AUD
- Duration: ${input.durationDays} days
- Number of creative assets: ${input.creativeCount}
- Content pool: "${input.contentPoolTag}"
- Destination URL: ${input.destinationUrl ?? "none"}
- Location: ${input.location ?? "Australia"}
- Vertical: ${input.clientVertical ?? "general"}
${input.strategyNotes ? `- Strategy notes from user: "${input.strategyNotes}"` : ""}

FUNNEL TEMPLATE for ${input.objective}:
- Stages: ${template.stages.join(" → ")}
- Default budget split: ${JSON.stringify(template.budgetSplit)}
- Daily budget: ~$${(actualDailyBudget / 100).toFixed(2)} AUD

PERFORMANCE BENCHMARKS:
${benchmarks}

RULES:
1. Create one campaign per funnel stage that's active.
2. Each campaign gets 1-3 ad sets with different audience strategies.
3. Top of funnel: broad + interest-based audiences. Entertainment content as creative.
4. Middle of funnel: retarget video viewers (50%+) and post engagers. Warmer creative.
5. Bottom of funnel: retarget website visitors + lookalike from converters. Direct CTA creative.
6. Split budget according to the funnel template, adjusted for the specific objective.
7. Use lowest_cost bid strategy unless budget is high enough for cost_cap.
8. Each ad set should test 2-4 creative variations.
9. Placements: automatic by default, but prefer Feed + Reels for video content.
10. Content pool tag "${input.contentPoolTag}" scopes all audiences — only engagement with this tagged content feeds retarget pools.

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "overview": "2-3 sentence strategy overview",
  "funnelStructure": "description of the funnel layers and how they connect",
  "campaigns": [
    {
      "name": "campaign name",
      "funnelStage": "top|middle|bottom",
      "objective": "${input.objective}",
      "dailyBudgetCents": number,
      "adSets": [
        {
          "name": "ad set name",
          "funnelStage": "top|middle|bottom",
          "audienceType": "broad|interest|custom_engagement|custom_website|lookalike",
          "audienceDescription": "plain English description of this audience",
          "budgetAllocationPct": number,
          "dailyBudgetCents": number,
          "bidStrategy": "lowest_cost|cost_cap|bid_cap",
          "optimizationGoal": "REACH|LINK_CLICKS|POST_ENGAGEMENT|LEAD_GENERATION|CONVERSIONS",
          "primaryMetric": "cpm_cents|cpc_cents|ctr_pct|engagement_rate|lead_cost_cents|roas|cpa_cents",
          "ageMin": number or null,
          "ageMax": number or null,
          "locations": ["AU"] or specific regions,
          "interests": ["interest1", "interest2"] or empty,
          "placements": ["feed", "reels", "stories", "explore", "automatic"]
        }
      ]
    }
  ],
  "creativeStrategy": "how to distribute and test the ${input.creativeCount} creative assets across ad sets",
  "scalingRecommendation": {
    "mode": "off|to_cap|indefinite",
    "velocityPct": 20,
    "roasFloor": number or null,
    "dailyCapCents": number or null,
    "humanCheckpoint": true|false,
    "checkpointSpendCents": number or null
  },
  "expectedOutcomes": "realistic expectations for the first 30 days",
  "risks": "what could go wrong and mitigation"
}`;

  const raw = await invokeLlmText({
    job: "meta-campaign-strategy-builder",
    system:
      "You are a senior Meta Ads strategist. You build high-performing campaign structures based on entertainment-first content marketing. Your strategies use the content flywheel: entertainment builds audience, retargeting converts them. Return only valid JSON.",
    prompt,
    maxTokens: 4096,
  });

  try {
    return JSON.parse(raw) as CampaignStrategy;
  } catch {
    return {
      overview: "Strategy generation failed — using conservative defaults.",
      funnelStructure: `Single-stage ${input.objective} campaign.`,
      campaigns: template.stages
        .filter((s) => template.budgetSplit[s] > 0)
        .map((stage) => ({
          name: `${input.contentPoolTag} — ${stage} of funnel`,
          funnelStage: stage,
          objective: input.objective,
          dailyBudgetCents: Math.round(
            actualDailyBudget * (template.budgetSplit[stage] / 100),
          ),
          adSets: [
            {
              name: `${stage} — ${stage === "top" ? "broad" : stage === "middle" ? "retarget engagers" : "retarget + lookalike"}`,
              funnelStage: stage,
              audienceType:
                stage === "top"
                  ? "broad"
                  : stage === "middle"
                    ? "custom_engagement"
                    : "lookalike",
              audienceDescription: `Default ${stage}-of-funnel audience`,
              budgetAllocationPct: 100,
              dailyBudgetCents: Math.round(
                actualDailyBudget * (template.budgetSplit[stage] / 100),
              ),
              bidStrategy: "lowest_cost" as const,
              optimizationGoal:
                stage === "top"
                  ? "REACH"
                  : stage === "middle"
                    ? "LINK_CLICKS"
                    : "CONVERSIONS",
              primaryMetric:
                stage === "top"
                  ? "cpm_cents"
                  : stage === "middle"
                    ? "cpc_cents"
                    : "roas",
              locations: ["AU"],
              interests: [],
              placements: ["automatic"],
            },
          ],
        })),
      creativeStrategy: `Distribute ${input.creativeCount} assets evenly across ad sets. Test all variations.`,
      scalingRecommendation: {
        mode: "to_cap",
        velocityPct: 20,
        roasFloor: input.objective === "conversions" ? 2.0 : null,
        dailyCapCents: actualDailyBudget * 3,
        humanCheckpoint: true,
        checkpointSpendCents: input.monthlyBudgetCents,
      },
      expectedOutcomes:
        "Conservative estimate: expect 3-7 days in learning phase before optimisation kicks in.",
      risks:
        "Low budget may limit learning phase exit. Creative fatigue possible after 2-3 weeks.",
    };
  }
}
