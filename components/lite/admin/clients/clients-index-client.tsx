"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export type HealthScore = "healthy" | "cooling" | "at_risk" | "stale";
export type ClientStageFilter = "active" | "completed" | "churned";

export interface ClientIndexRow {
  id: string;
  name: string;
  primary_contact_name: string | null;
  health: HealthScore;
  package_type: "retainer" | "project" | "saas";
  monthly_value_cents: number;
  last_activity_ms: number | null;
  overdue_invoice_count: number;
  stage: "active" | "completed" | "churned";
  billing_mode: string;
  industry_vertical: string | null;
}

export interface ClientsSummary {
  active_count: number;
  monthly_revenue_cents: number;
  needing_attention_count: number;
  overdue_invoice_count: number;
}

interface Props {
  rows: ClientIndexRow[];
  summary: ClientsSummary;
  initialStage: ClientStageFilter;
}

const STAGE_TABS: { id: ClientStageFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "churned", label: "Churned" },
];

const HEALTH_DOT_COLORS: Record<HealthScore, string> = {
  healthy: "var(--color-semantic-success, #7BAE7E)",
  cooling: "var(--color-brand-cream, #FDF5E6)",
  at_risk: "var(--color-brand-orange, #F28C52)",
  stale: "var(--color-brand-red, #B22848)",
};

const HEALTH_LABELS: Record<HealthScore, string> = {
  healthy: "Healthy",
  cooling: "Cooling",
  at_risk: "At risk",
  stale: "Stale",
};

function formatCentsCompact(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatRelativeDate(ms: number | null, nowMs: number): string {
  if (ms == null) return "—";
  const diff = nowMs - ms;
  const dayMs = 24 * 60 * 60 * 1000;
  if (diff < dayMs) return "today";
  const days = Math.floor(diff / dayMs);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function ClientsIndexClient({ rows, summary, initialStage }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stage, setStage] = React.useState<ClientStageFilter>(initialStage);
  const [search, setSearch] = React.useState("");
  const [healthFilter, setHealthFilter] = React.useState<HealthScore | "all">(
    "all",
  );
  const [now] = React.useState(() => Date.now());

  React.useEffect(() => {
    setStage(initialStage);
  }, [initialStage]);

  function updateStage(next: ClientStageFilter) {
    setStage(next);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "active") {
      params.delete("stage");
    } else {
      params.set("stage", next);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  const visible = React.useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.stage !== stage) return false;
      if (healthFilter !== "all" && r.health !== healthFilter) return false;
      if (!s) return true;
      return (
        r.name.toLowerCase().includes(s) ||
        (r.primary_contact_name?.toLowerCase().includes(s) ?? false)
      );
    });
  }, [rows, stage, healthFilter, search]);

  const stageCount = React.useMemo(() => {
    return rows.filter((r) => r.stage === stage).length;
  }, [rows, stage]);

  const isEmpty = rows.length === 0;

  return (
    <div className="space-y-5 px-4 pb-10">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard
          label="Active Clients"
          value={String(summary.active_count)}
          accent={false}
        />
        <SummaryCard
          label="Monthly Revenue"
          value={formatCentsCompact(summary.monthly_revenue_cents)}
          accent={false}
        />
        <SummaryCard
          label="Needing Attention"
          value={String(summary.needing_attention_count)}
          accent={summary.needing_attention_count > 0}
        />
        <SummaryCard
          label="Overdue Invoices"
          value={String(summary.overdue_invoice_count)}
          accent={summary.overdue_invoice_count > 0}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            role="tablist"
            aria-label="Filter clients by relationship stage"
            className="inline-flex items-center gap-1 rounded-[10px] p-1"
            style={{
              background: "rgba(15, 15, 14, 0.45)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            {STAGE_TABS.map((tab) => {
              const active = stage === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  aria-controls="clients-list"
                  type="button"
                  onClick={() => updateStage(tab.id)}
                  data-testid={`client-stage-${tab.id}`}
                  className="relative rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase leading-none transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    letterSpacing: "1.5px",
                    color: active
                      ? "var(--color-brand-cream)"
                      : "var(--color-neutral-500)",
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="client-stage-active"
                      className="absolute inset-0 rounded-md"
                      style={{
                        background: "var(--color-surface-2)",
                        boxShadow: "var(--surface-highlight)",
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Health filter */}
          <select
            value={healthFilter}
            onChange={(e) =>
              setHealthFilter(e.target.value as HealthScore | "all")
            }
            aria-label="Filter by health score"
            className="h-8 rounded-md bg-transparent px-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors focus:outline-none focus:border-[color:rgba(244,160,176,0.35)]"
            style={{
              letterSpacing: "1.5px",
              border: "1px solid rgba(253, 245, 230, 0.05)",
              background: "rgba(15, 15, 14, 0.45)",
            }}
          >
            <option value="all">All health</option>
            <option value="healthy">Healthy</option>
            <option value="cooling">Cooling</option>
            <option value="at_risk">At risk</option>
            <option value="stale">Stale</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client or contact"
            aria-label="Search clients"
            className="h-9 w-64 rounded-md bg-transparent px-3 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus:border-[color:rgba(244,160,176,0.35)]"
            style={{
              border: "1px solid rgba(253, 245, 230, 0.05)",
              background: "rgba(15, 15, 14, 0.45)",
            }}
          />
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] tabular-nums"
            style={{ letterSpacing: "1.5px" }}
          >
            {visible.length} / {stageCount}
          </span>
        </div>
      </div>

      {/* Client list */}
      {isEmpty ? (
        <EmptyClients />
      ) : (
        <div
          id="clients-list"
          className="overflow-hidden rounded-[12px]"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
          }}
        >
          <table className="w-full text-left">
            <thead>
              <tr>
                {[
                  { label: "Client", align: "left" as const },
                  { label: "Contact", align: "left" as const },
                  { label: "Health", align: "center" as const },
                  { label: "Type", align: "left" as const },
                  { label: "Monthly", align: "right" as const },
                  { label: "Last Activity", align: "left" as const },
                  { label: "Next", align: "left" as const },
                ].map((h) => (
                  <th
                    key={h.label}
                    className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      padding: "12px 14px",
                      borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                      textAlign: h.align,
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-500)]"
                  >
                    No clients match that filter.
                  </td>
                </tr>
              )}
              {visible.map((r) => (
                <ClientRow key={r.id} row={r} nowMs={now} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: boolean;
}) {
  return (
    <div
      className="rounded-[10px] px-4 py-3"
      style={{
        background: accent
          ? "linear-gradient(135deg, rgba(178,40,72,0.12), rgba(242,140,82,0.06))"
          : "var(--color-surface-2)",
        border: accent
          ? "1px solid rgba(178, 40, 72, 0.25)"
          : "1px solid rgba(253, 245, 230, 0.05)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </div>
      <div
        className="mt-1 font-[family-name:var(--font-display)] text-[28px] leading-none tabular-nums"
        style={{
          color: accent
            ? "var(--color-brand-orange)"
            : "var(--color-brand-cream)",
          letterSpacing: "-0.3px",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function HealthDot({ score }: { score: HealthScore }) {
  return (
    <span
      aria-label={HEALTH_LABELS[score]}
      title={HEALTH_LABELS[score]}
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: HEALTH_DOT_COLORS[score] }}
    />
  );
}

function ClientRow({
  row,
  nowMs,
}: {
  row: ClientIndexRow;
  nowMs: number;
}) {
  const nextAction = row.overdue_invoice_count > 0
    ? `${row.overdue_invoice_count} overdue invoice${row.overdue_invoice_count === 1 ? "" : "s"}`
    : null;

  return (
    <tr
      className="group transition-colors hover:bg-[color:var(--color-surface-3)]"
      style={{
        borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      <td className="px-3.5 py-3">
        <Link
          href={`/lite/admin/companies/${row.id}`}
          className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] hover:underline"
        >
          {row.name}
        </Link>
      </td>
      <td className="px-3.5 py-3 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)]">
        {row.primary_contact_name ?? "—"}
      </td>
      <td className="px-3.5 py-3 text-center">
        <HealthDot score={row.health} />
      </td>
      <td className="px-3.5 py-3">
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {row.package_type}
        </span>
      </td>
      <td className="px-3.5 py-3 text-right font-[family-name:var(--font-body)] text-[13px] tabular-nums text-[color:var(--color-neutral-300)]">
        {row.monthly_value_cents > 0
          ? formatCentsCompact(row.monthly_value_cents)
          : "—"}
      </td>
      <td className="px-3.5 py-3 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
        {formatRelativeDate(row.last_activity_ms, nowMs)}
      </td>
      <td className="px-3.5 py-3 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)]">
        {nextAction ? (
          <span className="text-[color:var(--color-brand-orange)]">
            {nextAction}
          </span>
        ) : (
          <span className="text-[color:var(--color-neutral-500)]">—</span>
        )}
      </td>
    </tr>
  );
}

function EmptyClients() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-neutral-500)]">
        No clients yet.
      </p>
      <p className="mt-2 max-w-[400px] text-center font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-500)]">
        Win a deal on the pipeline and they&apos;ll appear here automatically.
      </p>
    </div>
  );
}
