"use client";

import { useState } from "react";
import type {
  TierHealthCard,
  TierSubscriberRow,
} from "@/lib/observatory/queries/tier-health";

function formatAud(value: number): string {
  return `$${value.toFixed(2)}`;
}

function healthColor(health: "green" | "amber" | "red"): string {
  if (health === "red") return "var(--color-error)";
  if (health === "amber") return "var(--color-warning)";
  return "var(--color-success)";
}

function healthBg(health: "green" | "amber" | "red"): string {
  if (health === "red") return "var(--color-error-50)";
  if (health === "amber") return "var(--color-warning-50)";
  return "var(--color-success-50)";
}

function SubscriberList({
  subscribers,
  tierName,
}: {
  subscribers: TierSubscriberRow[];
  tierName: string;
}) {
  const isLarge = tierName.toLowerCase() === "large";

  if (subscribers.length === 0) {
    return (
      <p
        className="px-4 py-3 text-[13px] italic"
        style={{ color: "var(--color-neutral-500)" }}
      >
        No active subscribers on this tier.
      </p>
    );
  }

  return (
    <div className="divide-y" style={{ borderColor: "var(--color-neutral-200)" }}>
      {subscribers.map((s) => (
        <div key={s.deal_id} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span
              className="text-[14px] font-medium"
              style={{ color: "var(--color-neutral-100)" }}
            >
              {s.company_name}
            </span>
            <span
              className="text-[13px] font-mono"
              style={{
                color:
                  s.margin_aud < 0
                    ? "var(--color-error)"
                    : "var(--color-neutral-700)",
              }}
            >
              {formatAud(s.margin_aud)} margin
            </span>
          </div>
          <div
            className="mt-1 flex gap-4 text-[12px]"
            style={{ color: "var(--color-neutral-500)" }}
          >
            <span>Rev: {formatAud(s.monthly_revenue_aud)}</span>
            <span>Cost: {formatAud(s.total_cost_aud)}</span>
          </div>

          {isLarge && s.margin_aud < 0 && (
            <div
              className="mt-3 rounded-lg p-3"
              style={{ backgroundColor: "var(--color-error-50)" }}
            >
              <div
                className="text-[12px] font-medium uppercase"
                style={{
                  letterSpacing: "1px",
                  color: "var(--color-error)",
                }}
              >
                Top cost drivers
              </div>
              <div className="mt-2 space-y-1">
                {s.top_jobs.map((j) => (
                  <div
                    key={j.job}
                    className="flex justify-between text-[13px] font-mono"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    <span>{j.job}</span>
                    <span>{formatAud(j.cost_aud)}</span>
                  </div>
                ))}
              </div>
              <div
                className="mt-3 text-[12px]"
                style={{ color: "var(--color-neutral-500)" }}
              >
                Options: cap conversation · renegotiate to custom · accept as goodwill
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function TierHealthPanel({ tiers }: { tiers: TierHealthCard[] }) {
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  if (tiers.length === 0) {
    return (
      <section
        className="rounded-xl border p-6"
        style={{
          borderColor: "var(--color-neutral-200)",
          backgroundColor: "var(--color-neutral-50)",
        }}
      >
        <h2
          className="font-[family-name:var(--font-label)] text-[11px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          Tier Health
        </h2>
        <p
          className="mt-3 text-[14px] italic"
          style={{ color: "var(--color-neutral-500)" }}
        >
          No SaaS tiers configured yet.
        </p>
      </section>
    );
  }

  const allGreen = tiers.every((t) => t.health === "green");

  return (
    <section
      className="rounded-xl border"
      style={{
        borderColor: "var(--color-neutral-200)",
        backgroundColor: "var(--color-neutral-50)",
      }}
    >
      <div className="p-4 pb-3">
        <h2
          className="font-[family-name:var(--font-label)] text-[11px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          Tier Health
        </h2>
        {allGreen && (
          <p
            className="mt-2 text-[14px] italic"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Every tier is healthy. Margins are where they should be.
          </p>
        )}
      </div>

      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
        {tiers.map((tier) => {
          const expanded = expandedTier === tier.tier_id;
          return (
            <div
              key={tier.tier_id}
              className="rounded-lg border transition-shadow"
              style={{
                borderColor:
                  tier.health !== "green"
                    ? healthColor(tier.health)
                    : "var(--color-neutral-200)",
                backgroundColor: "var(--color-white)",
              }}
            >
              <button
                type="button"
                className="w-full p-4 text-left"
                onClick={() =>
                  setExpandedTier(expanded ? null : tier.tier_id)
                }
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[16px] font-medium"
                    style={{ color: "var(--color-neutral-100)" }}
                  >
                    {tier.tier_name}
                  </span>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: healthColor(tier.health) }}
                  />
                </div>
                <div
                  className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  <span>{tier.subscriber_count} subscribers</span>
                  <span>{formatAud(tier.monthly_revenue_aud)} rev</span>
                  <span>{formatAud(tier.avg_margin_per_subscriber)} avg margin</span>
                  <span>{tier.percent_underwater}% underwater</span>
                </div>
              </button>

              {expanded && (
                <div
                  className="border-t"
                  style={{ borderColor: "var(--color-neutral-200)" }}
                >
                  <SubscriberList
                    subscribers={tier.subscribers}
                    tierName={tier.tier_name}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
