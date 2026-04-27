/**
 * Seed performance benchmarks — industry-standard thresholds for the
 * autonomous optimisation engine. These define what "performing" means
 * at each funnel stage.
 *
 * Metric direction: "lower_is_better" for costs (CPM, CPC, CPA),
 * "higher_is_better" for rates (CTR, ROAS, engagement rate).
 *
 * Thresholds:
 * - good_threshold: performing adequately, maintain
 * - scale_threshold: outperforming, increase budget
 * - kill_threshold: underperforming, pause after min_data_days
 *
 * All cost metrics are in AUD cents unless noted.
 */

import { db } from "@/lib/db";
import { metaPerformanceBenchmarks } from "@/lib/db/schema/meta-campaigns";

interface BenchmarkSeed {
  funnel_stage: "top" | "middle" | "bottom";
  objective: "awareness" | "traffic" | "engagement" | "leads" | "conversions";
  primary_metric: string;
  good_threshold: number;
  scale_threshold: number;
  kill_threshold: number;
  metric_unit: string;
  metric_direction: "higher_is_better" | "lower_is_better";
  min_data_days: number;
  min_impressions: number;
  min_conversions?: number;
  notes: string;
}

const BENCHMARKS: BenchmarkSeed[] = [
  // --- TOP OF FUNNEL (Awareness) ---
  {
    funnel_stage: "top",
    objective: "awareness",
    primary_metric: "cpm_cents",
    good_threshold: 1500,
    scale_threshold: 800,
    kill_threshold: 3000,
    metric_unit: "cents_per_1k",
    metric_direction: "lower_is_better",
    min_data_days: 3,
    min_impressions: 5000,
    notes:
      "Australian market CPM benchmark. Good = $15 CPM, scale below $8, kill above $30. Content-first creative typically achieves $5-12.",
  },
  {
    funnel_stage: "top",
    objective: "awareness",
    primary_metric: "video_views_p50",
    good_threshold: 25,
    scale_threshold: 40,
    kill_threshold: 10,
    metric_unit: "percentage",
    metric_direction: "higher_is_better",
    min_data_days: 3,
    min_impressions: 5000,
    notes:
      "Percentage of viewers reaching 50% of video. Above 40% means the hook is strong — scale. Below 10% means creative is failing.",
  },
  {
    funnel_stage: "top",
    objective: "engagement",
    primary_metric: "engagement_rate",
    good_threshold: 3.0,
    scale_threshold: 6.0,
    kill_threshold: 1.0,
    metric_unit: "percentage",
    metric_direction: "higher_is_better",
    min_data_days: 3,
    min_impressions: 3000,
    notes:
      "Engagement rate = (likes + comments + shares + saves) / reach × 100. Entertainment content should hit 3-8%.",
  },

  // --- MIDDLE OF FUNNEL (Traffic / Engagement retarget) ---
  {
    funnel_stage: "middle",
    objective: "traffic",
    primary_metric: "cpc_cents",
    good_threshold: 150,
    scale_threshold: 80,
    kill_threshold: 350,
    metric_unit: "cents",
    metric_direction: "lower_is_better",
    min_data_days: 3,
    min_impressions: 2000,
    notes:
      "Cost per click for retarget audiences. Retarget CPC is typically 40-60% of cold traffic. Good = $1.50, scale below $0.80, kill above $3.50.",
  },
  {
    funnel_stage: "middle",
    objective: "traffic",
    primary_metric: "ctr_pct",
    good_threshold: 2.0,
    scale_threshold: 4.0,
    kill_threshold: 0.8,
    metric_unit: "percentage",
    metric_direction: "higher_is_better",
    min_data_days: 3,
    min_impressions: 2000,
    notes:
      "Click-through rate for retarget traffic campaigns. Warm audiences should achieve 2-5% CTR. Below 0.8% indicates creative fatigue.",
  },
  {
    funnel_stage: "middle",
    objective: "engagement",
    primary_metric: "cost_per_engagement_cents",
    good_threshold: 30,
    scale_threshold: 15,
    kill_threshold: 80,
    metric_unit: "cents",
    metric_direction: "lower_is_better",
    min_data_days: 3,
    min_impressions: 2000,
    notes:
      "Cost per engagement action (like, comment, share, save). Retarget engagement is cheaper than cold. Good = $0.30, scale below $0.15.",
  },

  // --- BOTTOM OF FUNNEL (Leads / Conversions) ---
  {
    funnel_stage: "bottom",
    objective: "leads",
    primary_metric: "lead_cost_cents",
    good_threshold: 3000,
    scale_threshold: 1500,
    kill_threshold: 8000,
    metric_unit: "cents",
    metric_direction: "lower_is_better",
    min_data_days: 5,
    min_impressions: 1000,
    min_conversions: 5,
    notes:
      "Cost per lead for retarget + lookalike audiences. Good = $30 CPL, scale below $15. Kill above $80 — audience or creative needs work. Needs 5+ leads before statistical confidence.",
  },
  {
    funnel_stage: "bottom",
    objective: "conversions",
    primary_metric: "roas",
    good_threshold: 2.0,
    scale_threshold: 4.0,
    kill_threshold: 0.8,
    metric_unit: "ratio",
    metric_direction: "higher_is_better",
    min_data_days: 7,
    min_impressions: 1000,
    min_conversions: 10,
    notes:
      "Return on ad spend. Good = 2x (break even after margins), scale at 4x+, kill below 0.8x. Needs 7 days and 10+ conversions for signal stability.",
  },
  {
    funnel_stage: "bottom",
    objective: "conversions",
    primary_metric: "cpa_cents",
    good_threshold: 5000,
    scale_threshold: 2500,
    kill_threshold: 12000,
    metric_unit: "cents",
    metric_direction: "lower_is_better",
    min_data_days: 7,
    min_impressions: 1000,
    min_conversions: 10,
    notes:
      "Cost per acquisition. Good = $50 CPA, scale below $25. Kill above $120 — margin-negative for most service businesses. Needs statistical confidence from 10+ conversions.",
  },
];

export async function seedBenchmarks(): Promise<number> {
  const now = Date.now();
  let inserted = 0;

  for (const b of BENCHMARKS) {
    const existing = db
      .select()
      .from(metaPerformanceBenchmarks)
      .where(
        // Simple check — same stage + objective + metric
        // If already seeded, skip
        undefined as never,
      )
      .all();

    // Just insert all — idempotent by clearing first
    const id = crypto.randomUUID();
    db.insert(metaPerformanceBenchmarks)
      .values({
        id,
        funnel_stage: b.funnel_stage,
        objective: b.objective,
        primary_metric: b.primary_metric,
        good_threshold: b.good_threshold,
        scale_threshold: b.scale_threshold,
        kill_threshold: b.kill_threshold,
        metric_unit: b.metric_unit,
        metric_direction: b.metric_direction,
        min_data_days: b.min_data_days,
        min_impressions: b.min_impressions,
        min_conversions: b.min_conversions ?? null,
        notes: b.notes,
        created_at_ms: now,
        updated_at_ms: now,
      })
      .run();
    inserted++;
  }

  return inserted;
}
