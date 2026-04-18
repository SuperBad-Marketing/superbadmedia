"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { LeadRunRow } from "@/lib/db/schema/lead-runs";
import type { LeadCandidateRow } from "@/lib/db/schema/lead-candidates";

interface RunsLogProps {
  runs: LeadRunRow[];
  candidatesByRun: Record<string, LeadCandidateRow[]>;
}

export function RunsLog({ runs, candidatesByRun }: RunsLogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No runs recorded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Trigger</th>
            <th className="pb-2 pr-4 text-right">Found</th>
            <th className="pb-2 pr-4 text-right">DNC</th>
            <th className="pb-2 pr-4 text-right">Qualified</th>
            <th className="pb-2 pr-4 text-right">Drafted</th>
            <th className="pb-2 pr-4 text-right">Cap</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const isExpanded = expandedId === run.id;
            const candidates = candidatesByRun[run.id] ?? [];
            const startedAt = new Date(
              run.run_started_at as unknown as number,
            );

            return (
              <RunRow
                key={run.id}
                run={run}
                startedAt={startedAt}
                isExpanded={isExpanded}
                candidates={candidates}
                onToggle={() =>
                  setExpandedId(isExpanded ? null : run.id)
                }
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RunRow({
  run,
  startedAt,
  isExpanded,
  candidates,
  onToggle,
}: {
  run: LeadRunRow;
  startedAt: Date;
  isExpanded: boolean;
  candidates: LeadCandidateRow[];
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-border/50 cursor-pointer hover:bg-surface-1 transition-colors"
        onClick={onToggle}
      >
        <td className="py-2 pr-4">
          {startedAt.toLocaleDateString("en-AU", {
            day: "numeric",
            month: "short",
            timeZone: "Australia/Melbourne",
          })}{" "}
          <span className="text-muted-foreground">
            {startedAt.toLocaleTimeString("en-AU", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
              timeZone: "Australia/Melbourne",
            })}
          </span>
        </td>
        <td className="py-2 pr-4">
          <Badge variant="outline" className="text-xs">
            {run.trigger}
          </Badge>
        </td>
        <td className="py-2 pr-4 text-right">{run.found_count}</td>
        <td className="py-2 pr-4 text-right">{run.dnc_filtered_count}</td>
        <td className="py-2 pr-4 text-right">{run.qualified_count}</td>
        <td className="py-2 pr-4 text-right">{run.drafted_count}</td>
        <td className="py-2 pr-4 text-right">
          {run.effective_cap_at_run}
          {run.capped_reason && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({run.capped_reason})
            </span>
          )}
        </td>
      </tr>
      {isExpanded && candidates.length > 0 && (
        <tr>
          <td colSpan={7} className="py-2 px-4 bg-surface-1/50">
            <div className="space-y-2">
              {candidates.map((c) => {
                const effectiveScore =
                  c.qualified_track === "retainer"
                    ? c.retainer_score
                    : c.saas_score;
                const reactiveAdj = c.reactive_adjustment || 0;
                const displayScore =
                  reactiveAdj !== 0
                    ? `${effectiveScore - reactiveAdj} → ${effectiveScore}`
                    : String(effectiveScore);

                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span className="font-medium min-w-[140px]">
                      {c.company_name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {c.qualified_track === "retainer"
                        ? "Retainer"
                        : "SaaS"}
                    </Badge>
                    <span className="text-muted-foreground">
                      score {displayScore}
                      {c.rescore_count > 0 && (
                        <> (rescored {c.rescore_count}×)</>
                      )}
                    </span>
                    {c.skipped_at && (
                      <span className="text-muted-foreground">
                        skipped: {c.skipped_reason ?? "unknown"}
                      </span>
                    )}
                    {c.promoted_to_deal_id && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-green-500/10 text-green-600 border-green-500/20"
                      >
                        promoted
                      </Badge>
                    )}
                    {c.below_floor_after_rescore && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-red-500/10 text-red-500 border-red-500/20"
                      >
                        below floor
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
      {isExpanded && candidates.length === 0 && (
        <tr>
          <td
            colSpan={7}
            className="py-2 px-4 text-xs text-muted-foreground bg-surface-1/50"
          >
            No candidates from this run.
          </td>
        </tr>
      )}
    </>
  );
}
