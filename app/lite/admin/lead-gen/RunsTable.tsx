"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

export type RunForTable = {
  id: string;
  run_started_at_ms: number | null;
  trigger: "scheduled" | "run_now" | "manual_brief";
  found_count: number;
  dnc_filtered_count: number;
  qualified_count: number;
  drafted_count: number;
  capped_reason: string | null;
  effective_cap_at_run: number;
};

export type CandidateForTable = {
  id: string;
  lead_run_id: string;
  company_name: string;
  domain: string | null;
  qualified_track: "saas" | "retainer";
  saas_score: number;
  retainer_score: number;
  is_promoted: boolean;
  is_skipped: boolean;
  is_drafted: boolean;
};

type Props = {
  runs: RunForTable[];
  candidatesByRunId: Record<string, CandidateForTable[]>;
};

function formatDate(ms: number | null): string {
  if (ms === null) return "—";
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });
}

function TriggerChip({ trigger }: { trigger: RunForTable["trigger"] }) {
  const styles: Record<
    RunForTable["trigger"],
    { label: string; bg: string; color: string }
  > = {
    scheduled: {
      label: "Scheduled",
      bg: "rgba(128,127,115,0.12)",
      color: "var(--color-neutral-300)",
    },
    run_now: {
      label: "Manual",
      bg: "rgba(242,140,82,0.15)",
      color: "var(--color-brand-orange)",
    },
    manual_brief: {
      label: "Brief",
      bg: "rgba(244,160,176,0.12)",
      color: "var(--color-brand-pink)",
    },
  };
  const s = styles[trigger];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{ letterSpacing: "1.5px", background: s.bg, color: s.color }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {s.label}
    </span>
  );
}

function TrackChip({ track }: { track: CandidateForTable["qualified_track"] }) {
  const isSaas = track === "saas";
  return (
    <span
      className="inline-flex shrink-0 rounded-full px-2 py-[2px] font-[family-name:var(--font-label)] text-[9px] uppercase leading-none"
      style={{
        letterSpacing: "1.2px",
        background: isSaas
          ? "rgba(242,140,82,0.14)"
          : "rgba(244,160,176,0.12)",
        color: isSaas
          ? "var(--color-brand-orange)"
          : "var(--color-brand-pink)",
      }}
    >
      {isSaas ? "SaaS" : "Retainer"}
    </span>
  );
}

function CandidateStatusChip({
  is_promoted,
  is_skipped,
  is_drafted,
}: Pick<CandidateForTable, "is_promoted" | "is_skipped" | "is_drafted">) {
  if (is_promoted) {
    return (
      <span
        className="inline-flex shrink-0 rounded-full px-2 py-[2px] font-[family-name:var(--font-label)] text-[9px] uppercase leading-none"
        style={{
          letterSpacing: "1.2px",
          background: "rgba(123,174,126,0.14)",
          color: "var(--color-success)",
        }}
      >
        Promoted
      </span>
    );
  }
  if (is_skipped) {
    return (
      <span
        className="inline-flex shrink-0 rounded-full px-2 py-[2px] font-[family-name:var(--font-label)] text-[9px] uppercase leading-none"
        style={{
          letterSpacing: "1.2px",
          background: "rgba(128,127,115,0.12)",
          color: "var(--color-neutral-500)",
        }}
      >
        Skipped
      </span>
    );
  }
  if (is_drafted) {
    return (
      <span
        className="inline-flex shrink-0 rounded-full px-2 py-[2px] font-[family-name:var(--font-label)] text-[9px] uppercase leading-none"
        style={{
          letterSpacing: "1.2px",
          background: "rgba(228,176,98,0.14)",
          color: "var(--color-warning)",
        }}
      >
        Drafted
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 rounded-full px-2 py-[2px] font-[family-name:var(--font-label)] text-[9px] uppercase leading-none"
      style={{
        letterSpacing: "1.2px",
        background: "rgba(244,160,176,0.10)",
        color: "var(--color-brand-pink)",
      }}
    >
      Pending
    </span>
  );
}

const COL_HEADERS = [
  { label: "Date", w: "22%" },
  { label: "Trigger", w: "14%" },
  { label: "Found", w: "10%" },
  { label: "DNC filtered", w: "13%" },
  { label: "Qualified", w: "11%" },
  { label: "Cap reason", w: "30%" },
];

export function RunsTable({ runs, candidatesByRunId }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div
        className="flex flex-col gap-3 rounded-[12px] px-8 py-10"
        style={{
          border: "1px dashed rgba(253,245,230,0.07)",
          background: "rgba(15,15,14,0.3)",
        }}
      >
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
          style={{ letterSpacing: "2px" }}
        >
          Lead Generation · no runs yet
        </div>
        <h4
          className="font-[family-name:var(--font-display)] text-[26px] leading-[1.1] text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.2px" }}
        >
          Nothing in the log.
        </h4>
        <p className="max-w-[440px] font-[family-name:var(--font-body)] text-[14px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          No runs yet. Click &ldquo;Run now&rdquo; to start.
        </p>
        <p className="font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
          the first one&apos;s always the hardest.
        </p>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-[12px]"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "inset 0 1px 0 rgba(253,245,230,0.04)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]" aria-label="Lead generation runs">
          <thead>
            <tr>
              {COL_HEADERS.map((h) => (
                <th
                  key={h.label}
                  scope="col"
                  className="px-[14px] py-[10px] text-left font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                  style={{
                    letterSpacing: "2px",
                    borderBottom: "1px solid rgba(253,245,230,0.05)",
                    width: h.w,
                  }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const isExpanded = expandedId === run.id;
              const candidates = candidatesByRunId[run.id] ?? [];
              return (
                <>
                  <tr
                    key={run.id}
                    onClick={() =>
                      setExpandedId(isExpanded ? null : run.id)
                    }
                    className="cursor-pointer transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[rgba(253,245,230,0.025)]"
                    aria-expanded={isExpanded}
                  >
                    <td
                      className="font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-500)]"
                      style={{
                        padding: "14px",
                        borderBottom: isExpanded
                          ? "none"
                          : "1px solid rgba(253,245,230,0.03)",
                      }}
                    >
                      {formatDate(run.run_started_at_ms)}
                    </td>
                    <td
                      style={{
                        padding: "14px",
                        borderBottom: isExpanded
                          ? "none"
                          : "1px solid rgba(253,245,230,0.03)",
                      }}
                    >
                      <TriggerChip trigger={run.trigger} />
                    </td>
                    <td
                      className="font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]"
                      style={{
                        padding: "14px",
                        letterSpacing: "1px",
                        textAlign: "right",
                        borderBottom: isExpanded
                          ? "none"
                          : "1px solid rgba(253,245,230,0.03)",
                      }}
                    >
                      {run.found_count}
                    </td>
                    <td
                      className="font-[family-name:var(--font-label)] text-[color:var(--color-neutral-300)]"
                      style={{
                        padding: "14px",
                        letterSpacing: "1px",
                        textAlign: "right",
                        borderBottom: isExpanded
                          ? "none"
                          : "1px solid rgba(253,245,230,0.03)",
                      }}
                    >
                      {run.dnc_filtered_count}
                    </td>
                    <td
                      className="font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]"
                      style={{
                        padding: "14px",
                        letterSpacing: "1px",
                        textAlign: "right",
                        borderBottom: isExpanded
                          ? "none"
                          : "1px solid rgba(253,245,230,0.03)",
                      }}
                    >
                      {run.qualified_count}
                    </td>
                    <td
                      className="font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]"
                      style={{
                        padding: "14px",
                        borderBottom: isExpanded
                          ? "none"
                          : "1px solid rgba(253,245,230,0.03)",
                      }}
                    >
                      {run.capped_reason ?? "—"}
                    </td>
                  </tr>
                  <tr key={`${run.id}-expand`}>
                    <td
                      colSpan={6}
                      style={{ padding: 0, borderBottom: "1px solid rgba(253,245,230,0.03)" }}
                    >
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            key="candidates"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={houseSpring}
                            style={{ overflow: "hidden" }}
                          >
                            <CandidatesSubTable candidates={candidates} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CandidatesSubTable({
  candidates,
}: {
  candidates: CandidateForTable[];
}) {
  if (candidates.length === 0) {
    return (
      <div
        className="px-6 py-4 font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]"
        style={{ borderTop: "1px solid rgba(253,245,230,0.04)" }}
      >
        No candidates recorded for this run.
      </div>
    );
  }

  return (
    <div style={{ borderTop: "1px solid rgba(253,245,230,0.04)" }}>
      <table
        className="w-full text-[12px]"
        aria-label="Candidates from this run"
      >
        <thead>
          <tr>
            {[
              { label: "Business", w: "28%" },
              { label: "Domain", w: "22%" },
              { label: "Track", w: "12%" },
              { label: "SaaS", w: "10%" },
              { label: "Retainer", w: "10%" },
              { label: "Status", w: "18%" },
            ].map((h) => (
              <th
                key={h.label}
                scope="col"
                className="px-[14px] py-[8px] text-left font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
                style={{
                  letterSpacing: "1.5px",
                  borderBottom: "1px solid rgba(253,245,230,0.04)",
                  width: h.w,
                  background: "rgba(15,15,14,0.25)",
                }}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr
              key={c.id}
              style={{ background: "rgba(15,15,14,0.15)" }}
            >
              <td
                className="font-[family-name:var(--font-body)] font-medium text-[color:var(--color-brand-cream)]"
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(253,245,230,0.025)",
                }}
              >
                {c.company_name}
              </td>
              <td
                className="font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]"
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(253,245,230,0.025)",
                }}
              >
                {c.domain ?? "—"}
              </td>
              <td
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(253,245,230,0.025)",
                }}
              >
                <TrackChip track={c.qualified_track} />
              </td>
              <td
                className="font-[family-name:var(--font-label)] text-[color:var(--color-neutral-300)]"
                style={{
                  padding: "10px 14px",
                  letterSpacing: "1px",
                  textAlign: "right",
                  borderBottom: "1px solid rgba(253,245,230,0.025)",
                }}
              >
                {c.saas_score}
              </td>
              <td
                className="font-[family-name:var(--font-label)] text-[color:var(--color-neutral-300)]"
                style={{
                  padding: "10px 14px",
                  letterSpacing: "1px",
                  textAlign: "right",
                  borderBottom: "1px solid rgba(253,245,230,0.025)",
                }}
              >
                {c.retainer_score}
              </td>
              <td
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(253,245,230,0.025)",
                }}
              >
                <CandidateStatusChip
                  is_promoted={c.is_promoted}
                  is_skipped={c.is_skipped}
                  is_drafted={c.is_drafted}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
