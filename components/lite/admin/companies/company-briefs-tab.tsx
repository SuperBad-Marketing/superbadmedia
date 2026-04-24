"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";

import type { BriefRow } from "@/lib/db/schema/briefs";

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

const TD: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
};

export function CompanyBriefsTab({
  companyId,
  briefs,
}: {
  companyId: string;
  briefs: BriefRow[];
}) {
  if (briefs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-16">
        <FileText
          className="mb-3 size-8 text-[color:var(--color-neutral-600)]"
          strokeWidth={1}
        />
        <p
          className="font-[family-name:var(--font-display)] text-[20px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.2px" }}
        >
          No briefs linked yet.
        </p>
        <p className="mt-2 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
          briefs find their way here when they match.
        </p>
        <div className="mt-5 flex gap-3">
          <Link
            href="/brief/lean"
            target="_blank"
            className="rounded-[6px] border border-[color:rgba(253,245,230,0.08)] px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[color:var(--color-brand-pink)] hover:text-[color:var(--color-brand-pink)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Lean brief form
          </Link>
          <Link
            href="/brief/structured"
            target="_blank"
            className="rounded-[6px] border border-[color:rgba(253,245,230,0.08)] px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[color:var(--color-brand-pink)] hover:text-[color:var(--color-brand-pink)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Structured brief form
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-[12px]"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <table className="w-full text-left">
        <thead>
          <tr>
            {["Reference", "Type", "Description", "Delivery", "Status", "Submitted"].map(
              (label) => (
                <th
                  key={label}
                  className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                  style={{
                    letterSpacing: "2px",
                    padding: "12px 20px",
                    borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                  }}
                >
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {briefs.map((b) => {
            const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.pending;
            return (
              <motion.tr
                key={b.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="transition-colors duration-[120ms] hover:bg-[color:rgba(253,245,230,0.02)]"
              >
                <td
                  style={TD}
                  className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-brand-cream)]"
                >
                  <span style={{ letterSpacing: "1px" }}>
                    {b.reference_number}
                  </span>
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
                <td
                  style={{ ...TD, maxWidth: "300px" }}
                  className="truncate font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-300)]"
                >
                  {b.project_title ?? b.description}
                </td>
                <td
                  style={TD}
                  className="font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]"
                >
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
                <td
                  style={TD}
                  className="font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]"
                >
                  {formatDate(b.created_at_ms)}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
