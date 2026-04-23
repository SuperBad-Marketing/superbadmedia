"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type SortKey = "date" | "score" | "name" | "track";
type SortDir = "asc" | "desc";
type TrackFilter = "all" | "saas" | "retainer";
type StatusFilter = "all" | "active" | "promoted" | "skipped" | "no_email";

interface CandidateRow {
  id: string;
  company_name: string;
  domain: string | null;
  contact_email: string | null;
  qualified_track: string;
  saas_score: number;
  retainer_score: number;
  sourced_from: string;
  skipped_at: unknown;
  promoted_to_deal_id: string | null;
  created_at: unknown;
}

function TrackBadge({ track }: { track: string }) {
  const isSaas = track === "saas";
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
      style={{
        letterSpacing: "1.2px",
        backgroundColor: isSaas
          ? "rgba(168, 85, 247, 0.15)"
          : "rgba(59, 130, 246, 0.15)",
        color: isSaas ? "#c084fc" : "#93c5fd",
      }}
    >
      {track}
    </span>
  );
}

function StatusBadge({ candidate }: { candidate: CandidateRow }) {
  if (candidate.promoted_to_deal_id) {
    return (
      <span
        className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
        style={{ letterSpacing: "1.2px", backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#86efac" }}
      >
        Promoted
      </span>
    );
  }
  if (candidate.skipped_at) {
    return (
      <span
        className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
        style={{ letterSpacing: "1.2px", backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#fca5a5" }}
      >
        Skipped
      </span>
    );
  }
  if (candidate.contact_email) {
    return (
      <span
        className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
        style={{ letterSpacing: "1.2px", backgroundColor: "rgba(253, 245, 230, 0.06)", color: "var(--color-neutral-300)" }}
      >
        Active
      </span>
    );
  }
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
      style={{ letterSpacing: "1.2px", backgroundColor: "rgba(253, 245, 230, 0.04)", color: "var(--color-neutral-500)" }}
    >
      No email
    </span>
  );
}

function getStatus(c: CandidateRow): string {
  if (c.promoted_to_deal_id) return "promoted";
  if (c.skipped_at) return "skipped";
  if (c.contact_email) return "active";
  return "no_email";
}

function getScore(c: CandidateRow): number {
  return c.qualified_track === "saas" ? c.saas_score : c.retainer_score;
}

function getCreatedMs(c: CandidateRow): number {
  return typeof c.created_at === "number"
    ? c.created_at
    : new Date(c.created_at as string).getTime();
}

export function CandidatesList({ candidates }: { candidates: CandidateRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const filtered = useMemo(() => {
    let list = candidates;
    if (trackFilter !== "all") {
      list = list.filter((c) => c.qualified_track === trackFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((c) => getStatus(c) === statusFilter);
    }
    return list;
  }, [candidates, trackFilter, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "date":
          return (getCreatedMs(a) - getCreatedMs(b)) * dir;
        case "score":
          return (getScore(a) - getScore(b)) * dir;
        case "name":
          return a.company_name.localeCompare(b.company_name) * dir;
        case "track":
          return a.qualified_track.localeCompare(b.qualified_track) * dir;
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const sortButtons: { key: SortKey; label: string }[] = [
    { key: "date", label: "Date" },
    { key: "score", label: "Score" },
    { key: "name", label: "Name" },
  ];

  return (
    <div>
      {/* Controls bar */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Sort */}
        <div className="flex items-center gap-2">
          <span
            className="font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            Sort
          </span>
          {sortButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => handleSort(btn.key)}
              className="rounded-md px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
              style={{
                letterSpacing: "1px",
                color:
                  sortKey === btn.key
                    ? "var(--color-brand-cream)"
                    : "var(--color-neutral-500)",
                background:
                  sortKey === btn.key
                    ? "rgba(178, 40, 72, 0.16)"
                    : "transparent",
                border:
                  sortKey === btn.key
                    ? "1px solid rgba(178, 40, 72, 0.35)"
                    : "1px solid rgba(253, 245, 230, 0.05)",
              }}
            >
              {btn.label}
              {sortKey === btn.key && (
                <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
              )}
            </button>
          ))}
        </div>

        {/* Track filter */}
        <div className="flex items-center gap-2">
          <span
            className="font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            Track
          </span>
          {(["all", "saas", "retainer"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTrackFilter(f)}
              className="rounded-md px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
              style={{
                letterSpacing: "1px",
                color:
                  trackFilter === f
                    ? "var(--color-brand-cream)"
                    : "var(--color-neutral-500)",
                background:
                  trackFilter === f ? "rgba(178, 40, 72, 0.16)" : "transparent",
                border:
                  trackFilter === f
                    ? "1px solid rgba(178, 40, 72, 0.35)"
                    : "1px solid rgba(253, 245, 230, 0.05)",
              }}
            >
              {f === "all" ? "All" : f === "saas" ? "SaaS" : "Retainer"}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <span
            className="font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            Status
          </span>
          {(["all", "active", "promoted", "skipped", "no_email"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className="rounded-md px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
                style={{
                  letterSpacing: "1px",
                  color:
                    statusFilter === f
                      ? "var(--color-brand-cream)"
                      : "var(--color-neutral-500)",
                  background:
                    statusFilter === f
                      ? "rgba(178, 40, 72, 0.16)"
                      : "transparent",
                  border:
                    statusFilter === f
                      ? "1px solid rgba(178, 40, 72, 0.35)"
                      : "1px solid rgba(253, 245, 230, 0.05)",
                }}
              >
                {f === "no_email" ? "No email" : f === "all" ? "All" : f}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Count */}
      <div className="mb-3 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
        {sorted.length} candidate{sorted.length === 1 ? "" : "s"}
        {(trackFilter !== "all" || statusFilter !== "all") && " (filtered)"}
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div
          className="rounded-[12px] px-8 py-10 text-center"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
          }}
        >
          <p
            className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.2px" }}
          >
            No matches.
          </p>
          <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
            try a different filter.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((c) => (
            <Link
              key={c.id}
              href={`/lite/admin/lead-gen/candidates/${c.id}`}
              className="group flex items-center gap-4 rounded-xl p-4 transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                backgroundColor: "var(--color-surface-2)",
                boxShadow: "var(--surface-highlight)",
                border: "1px solid rgba(253, 245, 230, 0.03)",
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-body)] text-[15px] font-medium text-[color:var(--color-brand-cream)] truncate">
                    {c.company_name}
                  </span>
                  <TrackBadge track={c.qualified_track} />
                  <StatusBadge candidate={c} />
                </div>
                <div className="mt-1 flex items-center gap-3 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                  {c.domain && <span>{c.domain}</span>}
                  {c.contact_email && (
                    <>
                      <span>·</span>
                      <span>{c.contact_email}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{c.sourced_from.replace(/_/g, " ")}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                    Score
                  </div>
                  <div className="font-[family-name:var(--font-body)] text-[16px] font-mono text-[color:var(--color-brand-cream)]">
                    {getScore(c)}
                  </div>
                </div>
                <span className="text-[color:var(--color-neutral-500)] transition-colors group-hover:text-[color:var(--color-brand-pink)]">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
