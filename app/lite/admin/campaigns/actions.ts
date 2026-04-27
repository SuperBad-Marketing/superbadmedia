"use server";

import { db } from "@/lib/db";
import {
  metaAdAccounts,
  metaCampaigns,
  metaAdSets,
  metaAds,
  type MetaCampaignRow,
  type MetaAdAccountRow,
} from "@/lib/db/schema/meta-campaigns";
import {
  contentStudioPosts,
  contentStudioRenders,
} from "@/lib/db/schema/content-studio";
import { eq, desc } from "drizzle-orm";
import { buildCampaignStrategy, type StrategyInput, type CampaignStrategy } from "@/lib/meta-campaigns/build-strategy";
import { seedBenchmarks } from "@/lib/meta-campaigns/seed-benchmarks";

export async function listCampaignsAction(): Promise<{
  ok: boolean;
  campaigns: MetaCampaignRow[];
}> {
  const campaigns = db
    .select()
    .from(metaCampaigns)
    .orderBy(desc(metaCampaigns.created_at_ms))
    .all();
  return { ok: true, campaigns };
}

export async function listAdAccountsAction(): Promise<{
  ok: boolean;
  accounts: MetaAdAccountRow[];
}> {
  const accounts = db.select().from(metaAdAccounts).all();
  return { ok: true, accounts };
}

export async function createAdAccountAction(input: {
  name: string;
  metaAccountId: string;
}): Promise<{ ok: boolean; id: string }> {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.insert(metaAdAccounts)
    .values({
      id,
      meta_account_id: input.metaAccountId,
      name: input.name,
      currency: "AUD",
      timezone: "Australia/Melbourne",
      status: "active",
      created_at_ms: now,
      updated_at_ms: now,
    })
    .run();
  return { ok: true, id };
}

export async function buildStrategyAction(
  input: StrategyInput,
): Promise<{ ok: boolean; strategy: CampaignStrategy }> {
  const strategy = await buildCampaignStrategy(input);
  return { ok: true, strategy };
}

export async function seedBenchmarksAction(): Promise<{
  ok: boolean;
  count: number;
}> {
  const count = await seedBenchmarks();
  return { ok: true, count };
}

export async function createCampaignFromStrategyAction(input: {
  adAccountId: string;
  companyId?: string;
  strategy: CampaignStrategy;
  strategyInput: StrategyInput;
}): Promise<{ ok: boolean; campaignIds: string[] }> {
  const now = Date.now();
  const campaignIds: string[] = [];

  for (const planned of input.strategy.campaigns) {
    const campaignId = crypto.randomUUID();
    campaignIds.push(campaignId);

    db.insert(metaCampaigns)
      .values({
        id: campaignId,
        ad_account_id: input.adAccountId,
        company_id: input.companyId ?? null,
        name: planned.name,
        objective: planned.objective,
        funnel_stage: planned.funnelStage,
        status: "draft",
        daily_budget_cents: planned.dailyBudgetCents,
        scaling_mode: input.strategy.scalingRecommendation.mode,
        scaling_velocity_pct: input.strategy.scalingRecommendation.velocityPct,
        scaling_roas_floor: input.strategy.scalingRecommendation.roasFloor,
        scaling_daily_cap_cents: input.strategy.scalingRecommendation.dailyCapCents,
        human_checkpoint_enabled: input.strategy.scalingRecommendation.humanCheckpoint,
        human_checkpoint_spend_cents: input.strategy.scalingRecommendation.checkpointSpendCents,
        ai_strategy_json: input.strategy,
        content_pool_tag: input.strategyInput.contentPoolTag,
        strategy_notes: input.strategyInput.strategyNotes ?? null,
        start_date_ms: now,
        end_date_ms: now + input.strategyInput.durationDays * 86400000,
        created_at_ms: now,
        updated_at_ms: now,
      })
      .run();

    for (const adSet of planned.adSets) {
      const adSetId = crypto.randomUUID();
      db.insert(metaAdSets)
        .values({
          id: adSetId,
          campaign_id: campaignId,
          name: adSet.name,
          status: "draft",
          funnel_stage: adSet.funnelStage,
          audience_type: adSet.audienceType as "broad" | "interest" | "custom_engagement" | "custom_website" | "custom_list" | "lookalike",
          audience_config_json: {
            description: adSet.audienceDescription,
            ageMin: adSet.ageMin,
            ageMax: adSet.ageMax,
            interests: adSet.interests,
          },
          daily_budget_cents: adSet.dailyBudgetCents,
          bid_strategy: adSet.bidStrategy,
          placements_json: adSet.placements,
          locations_json: adSet.locations,
          interests_json: adSet.interests,
          age_min: adSet.ageMin ?? null,
          age_max: adSet.ageMax ?? null,
          optimization_goal: adSet.optimizationGoal,
          primary_metric: adSet.primaryMetric,
          created_at_ms: now,
          updated_at_ms: now,
        })
        .run();
    }
  }

  return { ok: true, campaignIds };
}

export async function getCampaignAction(id: string): Promise<{
  ok: boolean;
  campaign: MetaCampaignRow | null;
  adSets: Array<{ id: string; name: string; funnel_stage: string; audience_type: string; daily_budget_cents: number; status: string }>;
}> {
  const rows = db
    .select()
    .from(metaCampaigns)
    .where(eq(metaCampaigns.id, id))
    .all();
  const campaign = rows[0] ?? null;
  if (!campaign) return { ok: true, campaign: null, adSets: [] };

  const adSetRows = db
    .select()
    .from(metaAdSets)
    .where(eq(metaAdSets.campaign_id, id))
    .all();

  return {
    ok: true,
    campaign,
    adSets: adSetRows.map((r) => ({
      id: r.id,
      name: r.name,
      funnel_stage: r.funnel_stage,
      audience_type: r.audience_type,
      daily_budget_cents: r.daily_budget_cents,
      status: r.status,
    })),
  };
}

export type StudioPostSummary = {
  id: string;
  brief: string;
  content_type: string;
  status: string;
  thumbnailUrl: string | null;
  createdAtMs: number;
};

export async function listStudioPostsAction(): Promise<{
  ok: boolean;
  posts: StudioPostSummary[];
}> {
  const posts = db
    .select()
    .from(contentStudioPosts)
    .orderBy(desc(contentStudioPosts.created_at_ms))
    .limit(50)
    .all();

  const result: StudioPostSummary[] = [];
  for (const p of posts) {
    const renders = db
      .select()
      .from(contentStudioRenders)
      .where(eq(contentStudioRenders.post_id, p.id))
      .all();
    const thumb = renders.find((r) => r.cloudinary_url)?.cloudinary_url ?? null;
    result.push({
      id: p.id,
      brief: p.brief,
      content_type: p.content_type,
      status: p.status,
      thumbnailUrl: thumb,
      createdAtMs: p.created_at_ms,
    });
  }
  return { ok: true, posts: result };
}

export async function updateCampaignStatusAction(
  id: string,
  status: "draft" | "pending_review" | "active" | "paused" | "completed" | "failed",
): Promise<{ ok: boolean }> {
  db.update(metaCampaigns)
    .set({ status, updated_at_ms: Date.now() })
    .where(eq(metaCampaigns.id, id))
    .run();
  return { ok: true };
}
