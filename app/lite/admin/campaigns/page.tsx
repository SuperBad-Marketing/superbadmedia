"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Megaphone, TrendingUp, Pause, CheckCircle2 } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type { MetaCampaignRow } from "@/lib/db/schema/meta-campaigns";
import { listCampaignsAction } from "./actions";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: "var(--color-neutral-500)", label: "Draft" },
  pending_review: { color: "var(--color-brand-orange)", label: "Review" },
  active: { color: "#7BAE7E", label: "Active" },
  paused: { color: "var(--color-brand-pink)", label: "Paused" },
  completed: { color: "var(--color-neutral-400)", label: "Done" },
  failed: { color: "var(--color-accent-cta)", label: "Failed" },
};

const STAGE_LABELS: Record<string, string> = {
  top: "Top of funnel",
  middle: "Mid-funnel",
  bottom: "Bottom of funnel",
};

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<MetaCampaignRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listCampaignsAction().then((res) => {
      if (res.ok) setCampaigns(res.campaigns);
      setLoaded(true);
    });
  }, []);

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Campaigns
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1
              className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
              style={{ letterSpacing: "-0.4px" }}
            >
              Campaigns
            </h1>
            <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
              Meta ad campaigns — build, launch, optimise.{" "}
              <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
                spend money to make money.
              </em>
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={houseSpring}
            onClick={() => router.push("/lite/admin/campaigns/new")}
            className="flex items-center gap-2 rounded-md bg-[color:var(--color-accent-cta)] px-4 py-2.5 font-[family-name:var(--font-body)] text-[14px] font-medium text-white shadow-sm"
          >
            <Plus size={18} strokeWidth={2} />
            New Campaign
          </motion.button>
        </div>
        <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {campaigns.length}
          </span>
          <span>campaign{campaigns.length === 1 ? "" : "s"}</span>
        </div>
      </header>

      <div className="px-4 pt-6">

      {loaded && campaigns.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={houseSpring}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <Megaphone
            size={48}
            strokeWidth={1}
            className="text-[color:var(--color-neutral-600)] mb-4"
          />
          <p className="text-[color:var(--color-neutral-400)] text-[14px] mb-1">
            No campaigns yet.
          </p>
          <p className="text-[color:var(--color-neutral-500)] text-[12px]">
            Create your first campaign to get started.
          </p>
        </motion.div>
      )}

      <AnimatePresence mode="popLayout">
        <div className="flex flex-col gap-3">
          {campaigns.map((c, i) => {
            const status = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft;
            const daily = c.daily_budget_cents / 100;
            return (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...houseSpring, delay: i * 0.04 }}
                onClick={() => router.push(`/lite/admin/campaigns/${c.id}`)}
                className="group flex items-center gap-4 rounded-lg bg-[color:var(--color-surface-2)] p-4 text-left transition-colors hover:bg-[color:var(--color-surface-3)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-neutral-100)] truncate">
                      {c.name}
                    </span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                      style={{
                        color: status.color,
                        border: `1px solid ${status.color}`,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[color:var(--color-neutral-500)] text-[12px]">
                    <span className="capitalize">{c.objective}</span>
                    <span aria-hidden>·</span>
                    <span>{STAGE_LABELS[c.funnel_stage] ?? c.funnel_stage}</span>
                    <span aria-hidden>·</span>
                    <span>${daily.toFixed(2)}/day</span>
                    {c.content_pool_tag && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-[color:var(--color-brand-pink)]">
                          {c.content_pool_tag}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {c.status === "active" ? (
                    <TrendingUp size={18} className="text-[#7BAE7E]" />
                  ) : c.status === "paused" ? (
                    <Pause size={18} className="text-[color:var(--color-brand-pink)]" />
                  ) : c.status === "completed" ? (
                    <CheckCircle2 size={18} className="text-[color:var(--color-neutral-400)]" />
                  ) : null}
                </div>
              </motion.button>
            );
          })}
        </div>
      </AnimatePresence>
      </div>
    </div>
  );
}
