"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { RoleBriefStatus } from "@/lib/db/schema/role-briefs";

export interface RoleBriefListRow {
  id: string;
  role_name: string;
  status: RoleBriefStatus;
  engagement_type: string;
  rate_min_aud: number | null;
  rate_max_aud: number | null;
  rate_unit: string | null;
  target_hours_per_week: number | null;
  location_pref_city: string | null;
  remote_ok: boolean;
  bench_active: number;
  bench_total: number;
  candidate_count: number;
  last_discovery_run_at_ms: number | null;
  last_regenerated_at_ms: number | null;
  created_at_ms: number;
  updated_at_ms: number;
}

const STATUS_COLORS: Record<RoleBriefStatus, string> = {
  open: "var(--color-semantic-success, #7BAE7E)",
  draft: "var(--color-brand-cream, #FDF5E6)",
  paused: "var(--color-brand-orange, #F28C52)",
  filled: "var(--color-brand-charcoal, #2B2B2B)",
};

const STATUS_LABELS: Record<RoleBriefStatus, string> = {
  open: "Open",
  draft: "Draft",
  paused: "Paused",
  filled: "Filled",
};

function formatRate(min: number | null, max: number | null, unit: string | null): string {
  if (min == null && max == null) return "—";
  const unitLabel = unit === "per_hour" ? "/hr" : unit === "per_day" ? "/day" : "/project";
  if (min != null && max != null) return `$${min}–$${max}${unitLabel}`;
  if (min != null) return `$${min}+${unitLabel}`;
  return `up to $${max}${unitLabel}`;
}

function formatRelativeMs(ms: number | null): string {
  if (ms == null) return "never";
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface Props {
  rows: RoleBriefListRow[];
}

export function RoleBriefsClient({ rows }: Props) {
  const statusFilter = React.useState<RoleBriefStatus | "all">("all");
  const [filter, setFilter] = statusFilter;

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  const counts = {
    all: rows.length,
    open: rows.filter((r) => r.status === "open").length,
    draft: rows.filter((r) => r.status === "draft").length,
    paused: rows.filter((r) => r.status === "paused").length,
    filled: rows.filter((r) => r.status === "filled").length,
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-brand-charcoal)]">
          Role Briefs
        </h1>
        <Link
          href="/lite/admin/hiring?action=new-role"
          className="rounded-md bg-[var(--color-brand-charcoal)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-charcoal)]/90"
        >
          New Role
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2 border-b border-[var(--color-brand-charcoal)]/10 pb-2">
        {(["all", "open", "draft", "paused", "filled"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab
                ? "bg-[var(--color-brand-charcoal)] text-white"
                : "text-[var(--color-brand-charcoal)]/60 hover:text-[var(--color-brand-charcoal)]"
            }`}
          >
            {tab === "all" ? "All" : STATUS_LABELS[tab]} ({counts[tab]})
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-brand-charcoal)]/50">
          No role briefs to show.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((brief, i) => (
            <motion.div
              key={brief.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <Link
                href={`/lite/admin/hiring/briefs/${brief.id}`}
                className="block rounded-lg border border-[var(--color-brand-charcoal)]/8 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[brief.status] }}
                      />
                      <h3 className="truncate text-base font-medium text-[var(--color-brand-charcoal)]">
                        {brief.role_name}
                      </h3>
                      <span className="text-xs text-[var(--color-brand-charcoal)]/50">
                        {STATUS_LABELS[brief.status]}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-brand-charcoal)]/60">
                      <span>{formatRate(brief.rate_min_aud, brief.rate_max_aud, brief.rate_unit)}</span>
                      {brief.target_hours_per_week && (
                        <span>{brief.target_hours_per_week} hrs/wk</span>
                      )}
                      {brief.location_pref_city && (
                        <span>{brief.location_pref_city}{brief.remote_ok ? " / remote" : ""}</span>
                      )}
                      {!brief.location_pref_city && brief.remote_ok && (
                        <span>Remote</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-[var(--color-brand-charcoal)]/60">
                    <span>
                      Bench: {brief.bench_active}/{brief.bench_total}
                    </span>
                    <span>{brief.candidate_count} candidate{brief.candidate_count === 1 ? "" : "s"}</span>
                    <span>Discovery: {formatRelativeMs(brief.last_discovery_run_at_ms)}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
