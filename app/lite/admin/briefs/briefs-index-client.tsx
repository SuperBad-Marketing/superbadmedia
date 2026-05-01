"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Download, FileText, Globe, Search } from "lucide-react";

import { Input } from "@/components/ui/input";

export interface BriefIndexRow {
  id: string;
  reference_number: string;
  brief_type: string;
  status: string;
  source: string;
  business_name: string;
  contact_name: string;
  delivery_date_ms: number;
  company_id: string | null;
  company_name: string | null;
  match_confidence: number | null;
  match_method: string | null;
  created_at_ms: number;
}

type StatusFilter = "all" | "pending" | "matched" | "unmatched" | "in_progress" | "completed" | "cancelled";
type TypeFilter = "all" | "lean" | "structured";

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "matched", label: "Matched" },
  { id: "unmatched", label: "Unmatched" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "rgba(244, 160, 176, 0.10)", color: "var(--color-brand-pink)", label: "Pending" },
  matched: { bg: "rgba(123, 174, 126, 0.12)", color: "var(--color-success)", label: "Matched" },
  unmatched: { bg: "rgba(242, 140, 82, 0.12)", color: "var(--color-brand-orange)", label: "Unmatched" },
  in_progress: { bg: "rgba(253, 245, 230, 0.08)", color: "var(--color-brand-cream)", label: "In Progress" },
  completed: { bg: "rgba(128, 127, 115, 0.15)", color: "var(--color-neutral-500)", label: "Completed" },
  cancelled: { bg: "rgba(128, 127, 115, 0.10)", color: "var(--color-neutral-600)", label: "Cancelled" },
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

export function BriefsIndexClient({ rows }: { rows: BriefIndexRow[] }) {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [search, setSearch] = React.useState("");

  const filtered = rows.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (typeFilter !== "all" && b.brief_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.business_name.toLowerCase().includes(q) ||
        b.contact_name.toLowerCase().includes(q) ||
        b.reference_number.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="px-4 pb-8">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex gap-1 rounded-[8px] bg-[color:rgba(253,245,230,0.03)] p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`cursor-pointer rounded-[6px] border-none px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                statusFilter === tab.id
                  ? "bg-[color:rgba(253,245,230,0.08)] text-[color:var(--color-brand-cream)]"
                  : "bg-transparent text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
              }`}
              style={{ letterSpacing: "1.5px" }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="rounded-[6px] border border-[color:rgba(253,245,230,0.08)] bg-transparent px-2.5 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] outline-none transition-colors duration-[180ms] focus:border-[color:var(--color-brand-pink)]"
          style={{ letterSpacing: "1.5px" }}
        >
          <option value="all">All types</option>
          <option value="lean">Lean</option>
          <option value="structured">Structured</option>
        </select>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[color:var(--color-neutral-600)]" strokeWidth={1.5} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search briefs…"
            className="pl-8 text-[12px]"
            style={{ maxWidth: "220px" }}
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[12px] px-8 py-16" style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}>
          <FileText className="mb-3 size-8 text-[color:var(--color-neutral-600)]" strokeWidth={1} />
          <p className="font-[family-name:var(--font-display)] text-[20px] leading-none text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "-0.2px" }}>
            {rows.length === 0 ? "No briefs yet." : "No briefs match your filters."}
          </p>
          <p className="mt-2 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
            {rows.length === 0 ? "share the brief forms and they'll start rolling in." : "widen the net."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px]" style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}>
          <table className="w-full text-left">
            <thead>
              <tr>
                {["Reference", "Business", "Contact", "Type", "Delivery", "Status", "Match", ""].map((label) => (
                  <th
                    key={label}
                    className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      padding: "12px 16px",
                      borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.pending;
                return (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="transition-colors duration-[120ms] hover:bg-[color:rgba(253,245,230,0.02)]"
                  >
                    <td style={TD} className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-brand-cream)]" >
                      <Link
                        href={`/lite/admin/briefs/${b.id}`}
                        className="transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-pink)]"
                        style={{ letterSpacing: "1px" }}
                      >
                        {b.reference_number}
                      </Link>
                    </td>
                    <td style={TD} className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                      {b.company_id ? (
                        <Link
                          href={`/lite/admin/companies/${b.company_id}`}
                          className="transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-pink)]"
                        >
                          {b.business_name}
                        </Link>
                      ) : (
                        b.business_name
                      )}
                    </td>
                    <td style={TD} className="text-[12px] text-[color:var(--color-neutral-300)]">
                      {b.contact_name}
                    </td>
                    <td style={TD}>
                      <span
                        className="inline-flex rounded-full px-2 py-[1px] font-[family-name:var(--font-label)] text-[9px] uppercase"
                        style={{
                          letterSpacing: "1.2px",
                          background: "rgba(253, 245, 230, 0.05)",
                          color: "var(--color-neutral-400)",
                        }}
                      >
                        {b.brief_type}
                      </span>
                    </td>
                    <td style={TD} className="font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]">
                      {formatDate(b.delivery_date_ms)}
                    </td>
                    <td style={TD}>
                      <span
                        className="inline-flex rounded-full px-2 py-[1px] font-[family-name:var(--font-label)] text-[9px] uppercase"
                        style={{
                          letterSpacing: "1.2px",
                          background: sc.bg,
                          color: sc.color,
                        }}
                      >
                        {sc.label}
                      </span>
                    </td>
                    <td style={TD} className="text-[12px] text-[color:var(--color-neutral-400)]">
                      {b.match_method === "auto" && "Auto"}
                      {b.match_method === "suggested" && (
                        <span>
                          Suggested{" "}
                          <span className="text-[color:var(--color-neutral-600)]">
                            ({b.match_confidence}%)
                          </span>
                        </span>
                      )}
                      {b.match_method === "manual" && "Manual"}
                      {b.match_method === "portal" && "Portal"}
                      {!b.match_method && (
                        <span className="italic text-[color:var(--color-neutral-600)]">
                          —
                        </span>
                      )}
                    </td>
                    <td style={TD}>
                      <div className="flex items-center gap-1">
                        <a
                          href={`/api/briefs/${b.id}/export?format=md`}
                          download
                          className="flex size-7 items-center justify-center rounded-md transition-colors duration-[180ms] hover:bg-[color:rgba(253,245,230,0.06)]"
                          title="Download .md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="size-3.5 text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] hover:text-[color:var(--color-brand-cream)]" strokeWidth={1.5} />
                        </a>
                        <a
                          href={`/api/briefs/${b.id}/export?format=html`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex size-7 items-center justify-center rounded-md transition-colors duration-[180ms] hover:bg-[color:rgba(253,245,230,0.06)]"
                          title="Open branded brief"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe className="size-3.5 text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] hover:text-[color:var(--color-brand-cream)]" strokeWidth={1.5} />
                        </a>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TD: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
};
