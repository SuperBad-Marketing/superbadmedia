"use client";

import { useState } from "react";
import { formatTimestamp } from "@/lib/format-timestamp";
import type { RecentCall } from "@/lib/observatory/queries/anomaly-detail";

function formatAud(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function RawDataTable({ calls }: { calls: RecentCall[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      className="rounded-[var(--radius-generous)] p-5"
      style={{ background: "var(--color-surface-1)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <h2
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
        >
          Raw Data ({calls.length} calls)
        </h2>
        <span
          className="text-[12px]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {expanded ? "Collapse" : "Expand"}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--color-surface-2)]">
                {["Time", "Actor", "Units", "Cost", "Prompt Hash"].map(
                  (h) => (
                    <th
                      key={h}
                      className="pb-2 pr-3 font-[family-name:var(--font-label)] text-[10px] uppercase"
                      style={{
                        letterSpacing: "1.5px",
                        color: "var(--color-neutral-500)",
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr
                  key={call.id}
                  className="border-b border-[var(--color-surface-2)] last:border-0"
                >
                  <td
                    className="py-2 pr-3 font-[family-name:var(--font-mono)]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {formatTimestamp(call.created_at_ms, undefined, {
                      format: "datetime",
                    })}
                  </td>
                  <td
                    className="py-2 pr-3"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {call.actor_type}
                    {call.actor_id ? ` · ${call.actor_id.slice(0, 8)}` : ""}
                  </td>
                  <td
                    className="py-2 pr-3 font-[family-name:var(--font-mono)]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {formatUnits(call.units)}
                  </td>
                  <td
                    className="py-2 pr-3 font-[family-name:var(--font-mono)]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {formatAud(call.estimated_cost_aud)}
                  </td>
                  <td
                    className="py-2 font-[family-name:var(--font-mono)]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {call.prompt_version_hash
                      ? call.prompt_version_hash.slice(0, 12)
                      : "—"}
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

function formatUnits(units: unknown): string {
  if (!units || typeof units !== "object") return "—";
  const u = units as Record<string, number>;
  if ("input_tokens" in u && "output_tokens" in u) {
    return `${u.input_tokens?.toLocaleString() ?? 0}in / ${u.output_tokens?.toLocaleString() ?? 0}out`;
  }
  if ("count" in u) return `${u.count}`;
  if ("render_seconds" in u) return `${u.render_seconds}s`;
  return JSON.stringify(units).slice(0, 30);
}
