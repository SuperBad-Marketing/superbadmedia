"use client";

import { useState } from "react";
import type { JobDetail, JobCallRow, PromptVersionEntry } from "@/lib/observatory/queries/job-detail";

function formatAud(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function CallHistoryTable({ calls }: { calls: JobCallRow[] }) {
  if (calls.length === 0) {
    return (
      <p
        className="px-4 py-6 text-center text-[14px] italic"
        style={{ color: "var(--color-neutral-500)" }}
      >
        No calls recorded for this job.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr
            style={{
              backgroundColor: "var(--color-surface-1)",
              color: "var(--color-neutral-500)",
            }}
          >
            <th className="px-4 py-2 text-left font-medium">Time</th>
            <th className="px-4 py-2 text-left font-medium">Actor</th>
            <th className="px-4 py-2 text-right font-medium">Cost</th>
            <th className="px-4 py-2 text-left font-medium">Prompt</th>
          </tr>
        </thead>
        <tbody
          className="divide-y"
          style={{ borderColor: "var(--color-neutral-200)" }}
        >
          {calls.map((c) => (
            <tr key={c.id}>
              <td
                className="px-4 py-2 whitespace-nowrap"
                style={{ color: "var(--color-neutral-500)" }}
              >
                <span title={formatTimestamp(c.created_at_ms)}>
                  {relativeTime(c.created_at_ms)}
                </span>
              </td>
              <td
                className="px-4 py-2 font-mono"
                style={{ color: "var(--color-neutral-500)" }}
              >
                {c.actor_type}
                {c.actor_id ? ` / ${c.actor_id.slice(0, 8)}` : ""}
              </td>
              <td
                className="px-4 py-2 text-right font-mono"
                style={{ color: "var(--color-neutral-100)" }}
              >
                {formatAud(c.estimated_cost_aud)}
              </td>
              <td
                className="px-4 py-2 font-mono text-[12px]"
                style={{ color: "var(--color-neutral-500)" }}
              >
                {c.prompt_version_hash?.slice(0, 8) ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PromptVersionTable({
  versions,
}: {
  versions: PromptVersionEntry[];
}) {
  if (versions.length === 0) return null;

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
          Prompt Versions
        </h2>
      </div>
      <div
        className="overflow-x-auto border-t"
        style={{ borderColor: "var(--color-neutral-200)" }}
      >
        <table className="w-full text-[13px]">
          <thead>
            <tr
              style={{
                backgroundColor: "var(--color-surface-1)",
                color: "var(--color-neutral-500)",
              }}
            >
              <th className="px-4 py-2 text-left font-medium">Hash</th>
              <th className="px-4 py-2 text-left font-medium">First seen</th>
              <th className="px-4 py-2 text-left font-medium">Last seen</th>
              <th className="px-4 py-2 text-right font-medium">Calls</th>
              <th className="px-4 py-2 text-right font-medium">Total cost</th>
            </tr>
          </thead>
          <tbody
            className="divide-y"
            style={{ borderColor: "var(--color-neutral-200)" }}
          >
            {versions.map((v) => (
              <tr key={v.hash}>
                <td
                  className="px-4 py-2 font-mono"
                  style={{ color: "var(--color-neutral-100)" }}
                >
                  {v.hash.slice(0, 12)}
                </td>
                <td
                  className="px-4 py-2"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  {formatTimestamp(v.first_seen_ms)}
                </td>
                <td
                  className="px-4 py-2"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  {formatTimestamp(v.last_seen_ms)}
                </td>
                <td
                  className="px-4 py-2 text-right font-mono"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  {v.call_count}
                </td>
                <td
                  className="px-4 py-2 text-right font-mono"
                  style={{ color: "var(--color-neutral-100)" }}
                >
                  {formatAud(v.total_cost_aud)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function JobDetailView({
  detail,
}: {
  detail: JobDetail;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const totalPages = Math.ceil(detail.call_count_total / pageSize);

  return (
    <div className="flex flex-col gap-6">
      <section
        className="rounded-xl border p-6"
        style={{
          borderColor: "var(--color-neutral-200)",
          backgroundColor: "var(--color-neutral-50)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2
              className="font-mono text-[18px] font-medium"
              style={{ color: "var(--color-neutral-100)" }}
            >
              {detail.job}
            </h2>
            {detail.registry && (
              <p
                className="mt-1 text-[13px]"
                style={{ color: "var(--color-neutral-500)" }}
              >
                {detail.registry.vendor} · {detail.registry.description ?? ""}
              </p>
            )}
          </div>
          <div
            className="text-right text-[13px]"
            style={{ color: "var(--color-neutral-500)" }}
          >
            <div>{detail.call_count_total} total calls</div>
            {detail.registry?.bands && (
              <>
                <div className="mt-1 font-mono">
                  Per-call: {formatAud(detail.registry.bands.per_call_ceiling_aud)}
                </div>
                <div className="font-mono">
                  Daily: {formatAud(detail.registry.bands.daily_ceiling_aud)}
                </div>
              </>
            )}
          </div>
        </div>

        {detail.daily_summary.length > 0 && (
          <div className="mt-4">
            <div
              className="text-[11px] uppercase font-medium"
              style={{
                letterSpacing: "1px",
                color: "var(--color-neutral-500)",
              }}
            >
              Last 30 days
            </div>
            <div className="mt-2 flex items-end gap-px h-16">
              {detail.daily_summary.map((d) => {
                const maxAud = Math.max(
                  ...detail.daily_summary.map((s) => s.total_aud),
                  0.01,
                );
                const pct = Math.max((d.total_aud / maxAud) * 100, 2);
                return (
                  <div
                    key={d.date}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${pct}%`,
                      backgroundColor: "var(--color-neutral-400)",
                    }}
                    title={`${d.date}: ${formatAud(d.total_aud)} (${d.call_count} calls)`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      <PromptVersionTable versions={detail.prompt_versions} />

      <section
        className="rounded-xl border"
        style={{
          borderColor: "var(--color-neutral-200)",
          backgroundColor: "var(--color-neutral-50)",
        }}
      >
        <div className="flex items-center justify-between p-4 pb-3">
          <h2
            className="font-[family-name:var(--font-label)] text-[11px] uppercase"
            style={{
              letterSpacing: "1.5px",
              color: "var(--color-neutral-500)",
            }}
          >
            Call History
          </h2>
          {totalPages > 1 && (
            <div
              className="flex items-center gap-2 text-[12px]"
              style={{ color: "var(--color-neutral-500)" }}
            >
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded px-2 py-1 transition-opacity disabled:opacity-30"
                style={{ backgroundColor: "var(--color-neutral-200)" }}
              >
                Prev
              </button>
              <span>
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded px-2 py-1 transition-opacity disabled:opacity-30"
                style={{ backgroundColor: "var(--color-neutral-200)" }}
              >
                Next
              </button>
            </div>
          )}
        </div>
        <div
          className="border-t"
          style={{ borderColor: "var(--color-neutral-200)" }}
        >
          <CallHistoryTable calls={detail.calls} />
        </div>
      </section>
    </div>
  );
}
