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
  open: "var(--color-success)",
  draft: "var(--color-brand-cream)",
  paused: "var(--color-brand-orange)",
  filled: "var(--color-neutral-600)",
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
  const [filter, setFilter] = React.useState<RoleBriefStatus | "all">("all");

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  const counts = {
    all: rows.length,
    open: rows.filter((r) => r.status === "open").length,
    draft: rows.filter((r) => r.status === "draft").length,
    paused: rows.filter((r) => r.status === "paused").length,
    filled: rows.filter((r) => r.status === "filled").length,
  };

  return (
    <div className="px-4 pt-6 pb-10">
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Admin · Hiring · Role Briefs
      </div>
      <div className="mt-3 flex items-start justify-between gap-4">
        <h1
          className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Role Briefs
        </h1>
        <Link
          href="/lite/setup/admin/hiring-role-brief"
          className="rounded-[8px] px-3 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase transition-colors"
          style={{
            letterSpacing: "1.5px",
            background: "rgba(193, 32, 45, 0.15)",
            color: "var(--color-brand-red)",
          }}
        >
          New Role
        </Link>
      </div>
      <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
        What you&apos;re looking for and where you&apos;re looking.
      </p>

      {/* Filter tabs */}
      <div className="mt-5 flex gap-2 pb-4">
        {(["all", "open", "draft", "paused", "filled"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-full px-3 py-1.5 font-[family-name:var(--font-label)] text-[11px] uppercase transition-colors ${
              filter === tab
                ? "bg-[color:var(--color-brand-pink)]/10 text-[color:var(--color-brand-cream)]"
                : "text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
            }`}
            style={{ letterSpacing: "1.5px" }}
          >
            {tab === "all" ? "All" : STATUS_LABELS[tab]} ({counts[tab]})
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p
            className="font-[family-name:var(--font-display)] text-[24px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.2px" }}
          >
            No role briefs yet.
          </p>
          <p className="mt-3 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
            define a role and the scouts go looking.
          </p>
        </div>
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
                className="block rounded-[12px] p-4 transition-all hover:brightness-110"
                style={{
                  background: "var(--color-surface-2)",
                  boxShadow: "var(--surface-highlight)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[brief.status] }}
                      />
                      <h3 className="truncate font-[family-name:var(--font-body)] text-[16px] font-medium text-[color:var(--color-brand-cream)]">
                        {brief.role_name}
                      </h3>
                      <span
                        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                        style={{ letterSpacing: "1.2px" }}
                      >
                        {STATUS_LABELS[brief.status]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
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
                  <div className="flex flex-col items-end gap-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1.2px" }}>
                    <span>
                      Bench {brief.bench_active}/{brief.bench_total}
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
