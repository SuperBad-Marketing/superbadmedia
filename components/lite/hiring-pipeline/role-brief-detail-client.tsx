"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  retuneRoleBriefAction,
  updateRoleBriefAction,
  type UpdateRoleBriefInput,
} from "@/app/lite/admin/hiring/actions";
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

const inputClass =
  "w-full rounded-md border px-3 py-1.5 text-sm bg-[var(--color-brand-charcoal)]/5 text-[var(--color-brand-charcoal)] border-[var(--color-brand-charcoal)]/15 placeholder:text-[var(--color-brand-charcoal)]/30 focus:outline-none focus:border-[var(--color-brand-charcoal)]/40";

const numberInputClass =
  "w-[100px] rounded-md border px-3 py-1.5 text-sm tabular-nums bg-[var(--color-brand-charcoal)]/5 text-[var(--color-brand-charcoal)] border-[var(--color-brand-charcoal)]/15 focus:outline-none focus:border-[var(--color-brand-charcoal)]/40";

interface Props {
  detail: RoleBriefDetail;
}

export function RoleBriefDetailClient({ detail }: Props) {
  const router = useRouter();
  const [retuning, setRetuning] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [roleName, setRoleName] = React.useState(detail.role_name);
  const [engagementType, setEngagementType] = React.useState(detail.engagement_type);
  const [rateMin, setRateMin] = React.useState<string>(detail.rate_min_aud?.toString() ?? "");
  const [rateMax, setRateMax] = React.useState<string>(detail.rate_max_aud?.toString() ?? "");
  const [rateUnit, setRateUnit] = React.useState(detail.rate_unit ?? "per_hour");
  const [hoursPerWeek, setHoursPerWeek] = React.useState<string>(
    detail.target_hours_per_week?.toString() ?? "",
  );
  const [locationCity, setLocationCity] = React.useState(detail.location_pref_city ?? "");
  const [remoteOk, setRemoteOk] = React.useState(detail.remote_ok);
  const [tagsText, setTagsText] = React.useState(detail.extracted_tags.join(", "));
  const [hintsText, setHintsText] = React.useState(detail.discovery_search_hints.join("\n"));
  const [overrides, setOverrides] = React.useState(detail.andy_overrides ?? "");

  function resetForm() {
    setRoleName(detail.role_name);
    setEngagementType(detail.engagement_type);
    setRateMin(detail.rate_min_aud?.toString() ?? "");
    setRateMax(detail.rate_max_aud?.toString() ?? "");
    setRateUnit(detail.rate_unit ?? "per_hour");
    setHoursPerWeek(detail.target_hours_per_week?.toString() ?? "");
    setLocationCity(detail.location_pref_city ?? "");
    setRemoteOk(detail.remote_ok);
    setTagsText(detail.extracted_tags.join(", "));
    setHintsText(detail.discovery_search_hints.join("\n"));
    setOverrides(detail.andy_overrides ?? "");
  }

  async function handleRetune() {
    setRetuning(true);
    await retuneRoleBriefAction(detail.id);
    setRetuning(false);
  }

  async function handleSave() {
    if (!roleName.trim()) {
      toast.error("Role name is required.");
      return;
    }
    setSaving(true);
    const input: UpdateRoleBriefInput = {
      role_name: roleName.trim(),
      engagement_type: engagementType as "contractor" | "employee",
      rate_min_aud: rateMin ? Number(rateMin) : null,
      rate_max_aud: rateMax ? Number(rateMax) : null,
      rate_unit: (rateUnit as "per_hour" | "per_day" | "per_project") || null,
      target_hours_per_week: hoursPerWeek ? Number(hoursPerWeek) : null,
      location_pref_city: locationCity.trim() || null,
      remote_ok: remoteOk,
      extracted_tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      discovery_search_hints: hintsText
        .split("\n")
        .map((h) => h.trim())
        .filter(Boolean),
      andy_overrides: overrides.trim() || null,
    };
    const res = await updateRoleBriefAction(detail.id, input);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Search settings saved.");
    setEditing(false);
    router.refresh();
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
              ? ` · ${detail.target_hours_per_week} hrs/wk`
              : ""}
            {detail.location_pref_city
              ? ` · ${detail.location_pref_city}${detail.remote_ok ? " / remote" : ""}`
              : detail.remote_ok
                ? " · Remote"
                : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (editing) {
                resetForm();
                setEditing(false);
              } else {
                setEditing(true);
              }
            }}
            className="rounded-md border border-[var(--color-brand-charcoal)]/20 px-3 py-1.5 text-sm font-medium text-[var(--color-brand-charcoal)] transition-colors hover:bg-[var(--color-brand-charcoal)]/5"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
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

      {/* Edit Mode — Search Settings */}
      {editing && (
        <motion.section
          className="mb-6 rounded-lg border border-[var(--color-brand-charcoal)]/12 bg-white p-6"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <h2 className="mb-5 text-sm font-semibold text-[var(--color-brand-charcoal)]">
            Search Settings
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Role Name */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-brand-charcoal)]/60">
                Position
              </label>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Video Editor"
                className={inputClass}
              />
            </div>

            {/* Engagement Type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-brand-charcoal)]/60">
                Engagement
              </label>
              <select
                value={engagementType}
                onChange={(e) => setEngagementType(e.target.value)}
                className={inputClass}
              >
                <option value="contractor">Contractor</option>
                <option value="employee">Employee</option>
              </select>
            </div>

            {/* Rate Range */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-brand-charcoal)]/60">
                Rate range (AUD)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={rateMin}
                  onChange={(e) => setRateMin(e.target.value)}
                  placeholder="Min"
                  className={numberInputClass}
                />
                <span className="text-xs text-[var(--color-brand-charcoal)]/40">–</span>
                <input
                  type="number"
                  value={rateMax}
                  onChange={(e) => setRateMax(e.target.value)}
                  placeholder="Max"
                  className={numberInputClass}
                />
                <select
                  value={rateUnit}
                  onChange={(e) => setRateUnit(e.target.value)}
                  className="rounded-md border px-2 py-1.5 text-xs bg-[var(--color-brand-charcoal)]/5 text-[var(--color-brand-charcoal)] border-[var(--color-brand-charcoal)]/15 focus:outline-none"
                >
                  <option value="per_hour">/hr</option>
                  <option value="per_day">/day</option>
                  <option value="per_project">/project</option>
                </select>
              </div>
            </div>

            {/* Hours + Location */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-brand-charcoal)]/60">
                  Hours per week
                </label>
                <input
                  type="number"
                  value={hoursPerWeek}
                  onChange={(e) => setHoursPerWeek(e.target.value)}
                  placeholder="e.g. 20"
                  className={numberInputClass}
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[var(--color-brand-charcoal)]/60">
                    Location
                  </label>
                  <input
                    type="text"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    placeholder="e.g. Melbourne"
                    className={inputClass}
                  />
                </div>
                <label className="mt-4 flex items-center gap-1.5 text-xs text-[var(--color-brand-charcoal)]/70 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remoteOk}
                    onChange={(e) => setRemoteOk(e.target.checked)}
                    className="accent-[var(--color-brand-charcoal)]"
                  />
                  Remote OK
                </label>
              </div>
            </div>

            {/* Tags (skills) */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--color-brand-charcoal)]/60">
                Skills &amp; tags
              </label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="e.g. motion graphics, after effects, colour grading"
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-[var(--color-brand-charcoal)]/40">
                Comma-separated. Used to match candidates against this role.
              </p>
            </div>

            {/* Discovery Search Hints */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--color-brand-charcoal)]/60">
                Discovery search queries
              </label>
              <textarea
                value={hintsText}
                onChange={(e) => setHintsText(e.target.value)}
                placeholder={"e.g.\nmelbourne food videographer portfolio\ndocumentary editor vimeo australia"}
                rows={4}
                className={inputClass + " resize-y min-h-[80px]"}
              />
              <p className="mt-1 text-[10px] text-[var(--color-brand-charcoal)]/40">
                One per line. These seed the discovery agent when it searches for candidates.
              </p>
            </div>

            {/* Andy Overrides */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--color-brand-charcoal)]/60">
                Manual notes
              </label>
              <textarea
                value={overrides}
                onChange={(e) => setOverrides(e.target.value)}
                placeholder="Any specific instructions or criteria for the AI discovery agent..."
                rows={3}
                className={inputClass + " resize-y min-h-[60px]"}
              />
              <p className="mt-1 text-[10px] text-[var(--color-brand-charcoal)]/40">
                Free text guidance that gets passed to the AI alongside the search queries.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={() => {
                resetForm();
                setEditing(false);
              }}
              disabled={saving}
              className="rounded-md border border-[var(--color-brand-charcoal)]/20 px-4 py-1.5 text-sm font-medium text-[var(--color-brand-charcoal)] transition-colors hover:bg-[var(--color-brand-charcoal)]/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !roleName.trim()}
              className="rounded-md bg-[var(--color-brand-charcoal)] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-charcoal)]/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </motion.section>
      )}

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
              Skills &amp; Tags
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

        {/* Discovery & Meta */}
        <motion.section
          className="rounded-lg border border-[var(--color-brand-charcoal)]/8 bg-white p-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.2 }}
        >
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-brand-charcoal)]">
            Discovery
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
                <dt className="mb-1 font-medium text-[var(--color-brand-charcoal)]">
                  Search queries
                </dt>
                <dd>
                  <ul className="space-y-0.5">
                    {detail.discovery_search_hints.map((hint, i) => (
                      <li key={i}>{hint}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {detail.andy_overrides && (
              <div className="pt-2">
                <dt className="mb-1 font-medium text-[var(--color-brand-charcoal)]">
                  Manual notes
                </dt>
                <dd>{detail.andy_overrides}</dd>
              </div>
            )}
          </dl>
        </motion.section>
      </div>
    </div>
  );
}
