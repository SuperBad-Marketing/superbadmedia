"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  Pause,
  Target,
  DollarSign,
  Users,
  TrendingUp,
} from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type { MetaCampaignRow } from "@/lib/db/schema/meta-campaigns";
import type { CampaignStrategy } from "@/lib/meta-campaigns/build-strategy";
import { getCampaignAction, updateCampaignStatusAction } from "../actions";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: "var(--color-neutral-500)", label: "Draft" },
  pending_review: { color: "var(--color-brand-orange)", label: "Pending Review" },
  active: { color: "#7BAE7E", label: "Active" },
  paused: { color: "var(--color-brand-pink)", label: "Paused" },
  completed: { color: "var(--color-neutral-400)", label: "Completed" },
  failed: { color: "var(--color-accent-cta)", label: "Failed" },
};

const STAGE_LABELS: Record<string, string> = {
  top: "Top of funnel",
  middle: "Mid-funnel",
  bottom: "Bottom of funnel",
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [campaign, setCampaign] = useState<MetaCampaignRow | null>(null);
  const [adSets, setAdSets] = useState<
    Array<{
      id: string;
      name: string;
      funnel_stage: string;
      audience_type: string;
      daily_budget_cents: number;
      status: string;
    }>
  >([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCampaignAction(id).then((res) => {
      if (res.ok) {
        setCampaign(res.campaign);
        setAdSets(res.adSets);
      }
      setLoaded(true);
    });
  }, [id]);

  function handleStatusChange(
    status: "pending_review" | "active" | "paused" | "completed",
  ) {
    if (!id) return;
    startTransition(async () => {
      await updateCampaignStatusAction(id, status);
      setCampaign((prev) => (prev ? { ...prev, status } : prev));
      toast.success(`Campaign ${status.replace("_", " ")}.`);
    });
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="h-8 w-48 rounded bg-[color:var(--color-surface-2)] animate-pulse" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-[color:var(--color-neutral-400)]">Campaign not found.</p>
      </div>
    );
  }

  const status = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
  const strategy = campaign.ai_strategy_json as CampaignStrategy | null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Header */}
      <button
        onClick={() => router.push("/lite/admin/campaigns")}
        className="flex items-center gap-1.5 text-[color:var(--color-neutral-500)] text-[length:var(--text-small)] mb-4 hover:text-[color:var(--color-neutral-300)] transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Campaigns
      </button>

      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-[family-name:var(--font-righteous)] text-[length:var(--text-display)] text-[color:var(--color-neutral-100)]">
              {campaign.name}
            </h1>
            <span
              className="rounded-full px-2.5 py-0.5 text-[length:var(--text-micro)] font-medium uppercase tracking-wider"
              style={{
                color: status.color,
                border: `1px solid ${status.color}`,
              }}
            >
              {status.label}
            </span>
          </div>
          <p className="text-[color:var(--color-neutral-500)] text-[length:var(--text-body)]">
            {STAGE_LABELS[campaign.funnel_stage] ?? campaign.funnel_stage} ·{" "}
            <span className="capitalize">{campaign.objective}</span>
            {campaign.content_pool_tag && (
              <>
                {" · "}
                <span className="text-[color:var(--color-brand-pink)]">
                  {campaign.content_pool_tag}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={houseSpring}
              onClick={() => handleStatusChange("pending_review")}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md bg-[color:var(--color-accent-cta)] px-3 py-2 text-[length:var(--text-small)] font-medium text-white"
            >
              <Target size={14} />
              Submit for Review
            </motion.button>
          )}
          {(campaign.status === "pending_review" ||
            campaign.status === "paused") && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={houseSpring}
              onClick={() => handleStatusChange("active")}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md bg-[#7BAE7E] px-3 py-2 text-[length:var(--text-small)] font-medium text-white"
            >
              <Play size={14} />
              Activate
            </motion.button>
          )}
          {campaign.status === "active" && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={houseSpring}
              onClick={() => handleStatusChange("paused")}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md bg-[color:var(--color-surface-3)] px-3 py-2 text-[length:var(--text-small)] font-medium text-[color:var(--color-neutral-200)]"
            >
              <Pause size={14} />
              Pause
            </motion.button>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-[color:var(--color-neutral-500)]" />
            <span className="text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
              Daily Budget
            </span>
          </div>
          <span className="text-[color:var(--color-neutral-100)] text-[length:var(--text-heading)] font-medium">
            ${(campaign.daily_budget_cents / 100).toFixed(2)}
          </span>
        </div>
        <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-[color:var(--color-neutral-500)]" />
            <span className="text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
              Total Spent
            </span>
          </div>
          <span className="text-[color:var(--color-neutral-100)] text-[length:var(--text-heading)] font-medium">
            ${(campaign.total_spent_cents / 100).toFixed(2)}
          </span>
        </div>
        <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-[color:var(--color-neutral-500)]" />
            <span className="text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
              Ad Sets
            </span>
          </div>
          <span className="text-[color:var(--color-neutral-100)] text-[length:var(--text-heading)] font-medium">
            {adSets.length}
          </span>
        </div>
      </div>

      {/* Ad sets */}
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-righteous)] text-[length:var(--text-heading)] text-[color:var(--color-neutral-100)] mb-4">
          Ad Sets
        </h2>
        {adSets.length === 0 ? (
          <p className="text-[color:var(--color-neutral-500)] text-[length:var(--text-body)]">
            No ad sets yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {adSets.map((as) => {
              const adSetStatus = STATUS_CONFIG[as.status] ?? STATUS_CONFIG.draft;
              return (
                <div
                  key={as.id}
                  className="flex items-center gap-4 rounded-lg bg-[color:var(--color-surface-2)] p-4"
                >
                  <div className="flex-1 min-w-0">
                    <span className="block text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium truncate">
                      {as.name}
                    </span>
                    <span className="text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
                      {STAGE_LABELS[as.funnel_stage] ?? as.funnel_stage} ·{" "}
                      {as.audience_type.replace("_", " ")} ·{" "}
                      ${(as.daily_budget_cents / 100).toFixed(2)}/day
                    </span>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[length:var(--text-micro)] font-medium uppercase tracking-wider"
                    style={{
                      color: adSetStatus.color,
                      border: `1px solid ${adSetStatus.color}`,
                    }}
                  >
                    {adSetStatus.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Strategy overview */}
      {strategy && (
        <div>
          <h2 className="font-[family-name:var(--font-righteous)] text-[length:var(--text-heading)] text-[color:var(--color-neutral-100)] mb-4">
            Strategy
          </h2>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
              <h3 className="text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium mb-2">
                Overview
              </h3>
              <p className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
                {strategy.overview}
              </p>
            </div>
            <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
              <h3 className="text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium mb-2">
                Creative Strategy
              </h3>
              <p className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
                {strategy.creativeStrategy}
              </p>
            </div>
            <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
              <h3 className="text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium mb-2">
                Expected Outcomes
              </h3>
              <p className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
                {strategy.expectedOutcomes}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
