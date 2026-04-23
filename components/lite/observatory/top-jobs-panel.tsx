"use client";

import { useState } from "react";
import type { TopJobRow } from "@/lib/observatory/queries/dashboard";

function formatAud(value: number): string {
  return `$${value.toFixed(2)}`;
}

type SortKey = "total_aud" | "total_calls" | "avg_aud_per_call" | "job";

export function TopJobsPanel({ jobs }: { jobs: TopJobRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("total_aud");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...jobs].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") {
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const headerClass =
    "cursor-pointer select-none font-[family-name:var(--font-label)] text-[10px] uppercase";
  const headerStyle = { letterSpacing: "1.5px", color: "var(--color-neutral-500)" };

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return <span className="ml-0.5">{sortAsc ? "↑" : "↓"}</span>;
  }

  return (
    <section
      className="rounded-[var(--radius-generous)] p-5"
      style={{ background: "var(--color-surface-1)" }}
    >
      <h2
        className="font-[family-name:var(--font-label)] text-[10px] uppercase"
        style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
      >
        Top Jobs This Month
      </h2>

      {jobs.length === 0 ? (
        <p
          className="mt-4 py-6 text-center font-[family-name:var(--font-serif)] text-[14px] italic"
          style={{ color: "var(--color-neutral-500)" }}
        >
          The ledger is empty. First external call will show up here.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-surface-2)]">
                <th className={`${headerClass} pb-2 pr-4`} style={headerStyle} onClick={() => toggleSort("job")}>
                  Job<SortIndicator col="job" />
                </th>
                <th className={`${headerClass} pb-2 pr-4`} style={headerStyle}>
                  Vendor
                </th>
                <th
                  className={`${headerClass} pb-2 pr-4 text-right`}
                  style={headerStyle}
                  onClick={() => toggleSort("total_calls")}
                >
                  Calls<SortIndicator col="total_calls" />
                </th>
                <th
                  className={`${headerClass} pb-2 pr-4 text-right`}
                  style={headerStyle}
                  onClick={() => toggleSort("total_aud")}
                >
                  Total AUD<SortIndicator col="total_aud" />
                </th>
                <th
                  className={`${headerClass} pb-2 text-right`}
                  style={headerStyle}
                  onClick={() => toggleSort("avg_aud_per_call")}
                >
                  Avg/Call<SortIndicator col="avg_aud_per_call" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((job) => (
                <tr
                  key={job.job}
                  className="border-b border-[var(--color-surface-2)] last:border-0"
                >
                  <td
                    className="py-2.5 pr-4 font-[family-name:var(--font-mono)] text-[13px]"
                    style={{ color: "var(--color-neutral-100)" }}
                  >
                    {job.job}
                  </td>
                  <td
                    className="py-2.5 pr-4 font-[family-name:var(--font-label)] text-[10px] uppercase"
                    style={{ letterSpacing: "1px", color: "var(--color-neutral-500)" }}
                  >
                    {job.vendor}
                  </td>
                  <td
                    className="py-2.5 pr-4 text-right font-[family-name:var(--font-mono)]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {job.total_calls.toLocaleString()}
                  </td>
                  <td
                    className="py-2.5 pr-4 text-right font-[family-name:var(--font-mono)]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {formatAud(job.total_aud)}
                  </td>
                  <td
                    className="py-2.5 text-right font-[family-name:var(--font-mono)]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {formatAud(job.avg_aud_per_call)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
