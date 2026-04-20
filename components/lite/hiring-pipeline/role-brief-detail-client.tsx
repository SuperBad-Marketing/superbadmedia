"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { retuneRoleBriefAction } from "@/app/lite/admin/hiring/actions";
import type { RoleBriefStatus } from "@/lib/db/schema/role-briefs";

export interface RoleBriefDetail {
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
  open_count: number;
  style_summary: string | null;
  extracted_tags: string[];
  style_do_list: string[];
  style_avoid_list: string[];
  discovery_search_hints: string[];
  andy_overrides: string | null;
  last_regenerated_at_ms: number | null;
  last_discovery_run_at_ms: number | null;
  created_at_ms: number;
  bench_members: {
    id: string;
    name: string;
    bench_status: string;
    weekly_capacity_hours: number;
    hourly_rate_aud: number;
  }[];
  archive_patterns: { reason_code: string; count: number }[];
  pipeline_counts: Record<string, number>;
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

function formatRate(min: number | null, max: number | null, unit: string | null): string {
  if (min == null && max == null) return "—";
  const unitLabel = unit === "per_hour" ? "/hr" : unit === "per_day" ? "/day" : "/project";
  if (min != null && max != null) return `$${min}–$${max}${unitLabel}`;
  if (min != null) return `$${min}+${unitLabel}`;
  return `up to $${max}${unitLabel}`;
}

const STATUS_COLORS: Record<RoleBriefStatus, string> = {
  open: "var(--color-semantic-success, #7BAE7E)",
  draft: "var(--color-brand-cream, #FDF5E6)",
  paused: "var(--color-brand-orange, #F28C52)",
  filled: "var(--color-brand-charcoal, #2B2B2B)",
};

interface Props {
  detail: RoleBriefDetail;
}

export function RoleBriefDetailClient({ detail }: Props) {
  const [retuning, setRetuning] = React.useState(false);

  async function handleRetune() {
    setRetuning(true);
    await retuneRoleBriefAction(detail.id);
    setRetuning(false);
  }

  const totalPipeline = Object.values(detail.pipeline_counts).reduce(
    (s, c) => s + c,
    0,
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="mb-2">
        <Link
          href="/lite/admin/hiring/briefs"
          className="text-xs text-[var(--color-brand-charcoal)]/50 hover:text-[var(--color-brand-charcoal)]"
        >
          &larr; All Briefs
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[detail.status] }}
            />
            <h1 className="text-2xl font-semibold text-[var(--color-brand-charcoal)]">
              {detail.role_name}
            </h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-brand-charcoal)]/60">
            {detail.engagement_type === "contractor" ? "Contractor" : "Employee"} &middot;{" "}
            {formatRate(detail.rate_min_aud, detail.rate_max_aud, detail.rate_unit)}
            {detail.target_hours_per_week
              ? ` &middot; ${detail.target_hours_per_week} hrs/wk`
              : ""}
            {detail.location_pref_city
              ? ` &middot; ${detail.location_pref_city}${detail.remote_ok ? " / remote" : ""}`
              : detail.remote_ok
                ? " &middot; Remote"
                : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRetune}
            disabled={retuning}
            className="rounded-md border border-[var(--color-brand-charcoal)]/20 px-3 py-1.5 text-sm font-medium text-[var(--color-brand-charcoal)] transition-colors hover:bg-[var(--color-brand-charcoal)]/5 disabled:opacity-50"
          >
            {retuning ? "Retuning..." : "Retune"}
          </button>
          <Link
            href={`/lite/admin/hiring?brief=${detail.id}`}
            className="rounded-md bg-[var(--color-brand-charcoal)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-charcoal)]/90"
          >
            View Pipeline
          </Link>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Style Summary */}
        {detail.style_summary && (
          <motion.section
            className="rounded-lg border border-[var(--color-brand-charcoal)]/8 bg-white p-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="mb-2 text-sm font-semibold text-[var(--color-brand-charcoal)]">
              Style Summary
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-brand-charcoal)]/80">
              {detail.style_summary}
            </p>
          </motion.section>
        )}

        {/* Tags */}
        {detail.extracted_tags.length > 0 && (
          <motion.section
            className="rounded-lg border border-[var(--color-brand-charcoal)]/8 bg-white p-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.2 }}
          >
            <h2 className="mb-2 text-sm font-semibold text-[var(--color-brand-charcoal)]">
              Extracted Tags
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {detail.extracted_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--color-brand-charcoal)]/5 px-2.5 py-0.5 text-xs text-[var(--color-brand-charcoal)]/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.section>
        )}

        {/* Do / Avoid */}
        <motion.section
          className="rounded-lg border border-[var(--color-brand-charcoal)]/8 bg-white p-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.2 }}
        >
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-brand-charcoal)]">
            Style Direction
          </h2>
          {detail.style_do_list.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-[var(--color-semantic-success)]">Do</p>
              <ul className="space-y-0.5 text-xs text-[var(--color-brand-charcoal)]/70">
                {detail.style_do_list.map((item, i) => (
                  <li key={i}>&bull; {item}</li>
                ))}
              </ul>
            </div>
          )}
          {detail.style_avoid_list.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--color-brand-red,#B22848)]">Avoid</p>
              <ul className="space-y-0.5 text-xs text-[var(--color-brand-charcoal)]/70">
                {detail.style_avoid_list.map((item, i) => (
                  <li key={i}>&bull; {item}</li>
                ))}
              </ul>
            </div>
          )}
        </motion.section>

        {/* Bench Members */}
        <motion.section
          className="rounded-lg border border-[var(--color-brand-charcoal)]/8 bg-white p-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.2 }}
        >
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-brand-charcoal)]">
            Bench ({detail.bench_members.length})
          </h2>
          {detail.bench_members.length === 0 ? (
            <p className="text-xs text-[var(--color-brand-charcoal)]/50">No bench members yet.</p>
          ) : (
            <ul className="space-y-2">
              {detail.bench_members.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-brand-charcoal)]/80">{m.name}</span>
                  <span className="text-[var(--color-brand-charcoal)]/50">
                    {m.bench_status === "paused" ? "Paused" : `${m.weekly_capacity_hours}h/wk`} &middot; ${m.hourly_rate_aud}/hr
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* Pipeline */}
        <motion.section
          className="rounded-lg border border-[var(--color-brand-charcoal)]/8 bg-white p-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.2 }}
        >
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-brand-charcoal)]">
            Pipeline ({totalPipeline})
          </h2>
          <div className="space-y-1 text-xs text-[var(--color-brand-charcoal)]/70">
            {Object.entries(detail.pipeline_counts).map(([stage, ct]) => (
              <div key={stage} className="flex justify-between">
                <span className="capitalize">{stage.replace(/_/g, " ")}</span>
                <span>{ct}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Archive Patterns */}
        {detail.archive_patterns.length > 0 && (
          <motion.section
            className="rounded-lg border border-[var(--color-brand-charcoal)]/8 bg-white p-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.2 }}
          >
            <h2 className="mb-2 text-sm font-semibold text-[var(--color-brand-charcoal)]">
              Archive Patterns
            </h2>
            <div className="space-y-1 text-xs text-[var(--color-brand-charcoal)]/70">
              {detail.archive_patterns.map((p) => (
                <div key={p.reason_code} className="flex justify-between">
                  <span className="capitalize">{p.reason_code.replace(/_/g, " ")}</span>
                  <span>{p.count}</span>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Meta */}
        <motion.section
          className="rounded-lg border border-[var(--color-brand-charcoal)]/8 bg-white p-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.2 }}
        >
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-brand-charcoal)]">
            Meta
          </h2>
          <dl className="space-y-1 text-xs text-[var(--color-brand-charcoal)]/70">
            <div className="flex justify-between">
              <dt>Created</dt>
              <dd>{formatRelativeMs(detail.created_at_ms)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Last regenerated</dt>
              <dd>{formatRelativeMs(detail.last_regenerated_at_ms)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Last discovery run</dt>
              <dd>{formatRelativeMs(detail.last_discovery_run_at_ms)}</dd>
            </div>
            {detail.discovery_search_hints.length > 0 && (
              <div className="pt-2">
                <dt className="mb-1 font-medium">Discovery hints</dt>
                <dd>{detail.discovery_search_hints.join(", ")}</dd>
              </div>
            )}
            {detail.andy_overrides && (
              <div className="pt-2">
                <dt className="mb-1 font-medium">Overrides</dt>
                <dd>{detail.andy_overrides}</dd>
              </div>
            )}
          </dl>
        </motion.section>
      </div>
    </div>
  );
}
