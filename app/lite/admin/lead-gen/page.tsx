import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { leadRuns } from "@/lib/db/schema/lead-runs";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { RunNowButton } from "./RunNowButton";
import {
  RunsTable,
  type RunForTable,
  type CandidateForTable,
} from "./RunsTable";

export const metadata: Metadata = {
  title: "SuperBad — Lead Generation",
  robots: { index: false, follow: false },
};

export default async function LeadGenPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const runs = await db
    .select({
      id: leadRuns.id,
      run_started_at: leadRuns.run_started_at,
      trigger: leadRuns.trigger,
      found_count: leadRuns.found_count,
      dnc_filtered_count: leadRuns.dnc_filtered_count,
      qualified_count: leadRuns.qualified_count,
      drafted_count: leadRuns.drafted_count,
      capped_reason: leadRuns.capped_reason,
      effective_cap_at_run: leadRuns.effective_cap_at_run,
    })
    .from(leadRuns)
    .orderBy(desc(leadRuns.run_started_at))
    .limit(30);

  const runIds = runs.map((r) => r.id);

  type RawCandidate = {
    id: string;
    lead_run_id: string;
    company_name: string;
    domain: string | null;
    qualified_track: "saas" | "retainer";
    saas_score: number;
    retainer_score: number;
    promoted_to_deal_id: string | null;
    skipped_at: Date | null;
    pending_draft_id: string | null;
  };

  let rawCandidates: RawCandidate[] = [];
  if (runIds.length > 0) {
    rawCandidates = await db
      .select({
        id: leadCandidates.id,
        lead_run_id: leadCandidates.lead_run_id,
        company_name: leadCandidates.company_name,
        domain: leadCandidates.domain,
        qualified_track: leadCandidates.qualified_track,
        saas_score: leadCandidates.saas_score,
        retainer_score: leadCandidates.retainer_score,
        promoted_to_deal_id: leadCandidates.promoted_to_deal_id,
        skipped_at: leadCandidates.skipped_at,
        pending_draft_id: leadCandidates.pending_draft_id,
      })
      .from(leadCandidates)
      .where(inArray(leadCandidates.lead_run_id, runIds));
  }

  const runsForTable: RunForTable[] = runs.map((r) => ({
    id: r.id,
    run_started_at_ms: r.run_started_at ? r.run_started_at.getTime() : null,
    trigger: r.trigger,
    found_count: r.found_count,
    dnc_filtered_count: r.dnc_filtered_count,
    qualified_count: r.qualified_count,
    drafted_count: r.drafted_count,
    capped_reason: r.capped_reason,
    effective_cap_at_run: r.effective_cap_at_run,
  }));

  const candidatesByRunId: Record<string, CandidateForTable[]> = {};
  for (const c of rawCandidates) {
    const entry: CandidateForTable = {
      id: c.id,
      lead_run_id: c.lead_run_id,
      company_name: c.company_name,
      domain: c.domain,
      qualified_track: c.qualified_track,
      saas_score: c.saas_score,
      retainer_score: c.retainer_score,
      is_promoted: c.promoted_to_deal_id !== null,
      is_skipped: c.skipped_at !== null,
      is_drafted: c.pending_draft_id !== null,
    };
    if (!candidatesByRunId[c.lead_run_id]) {
      candidatesByRunId[c.lead_run_id] = [];
    }
    candidatesByRunId[c.lead_run_id].push(entry);
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Page header */}
      <header
        className="flex items-start justify-between gap-4 pb-6"
        style={{ borderBottom: "1px solid rgba(253,245,230,0.05)" }}
      >
        <div className="flex flex-col gap-2">
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Admin <span style={{ color: "var(--color-neutral-600)" }}>/</span>{" "}
            Lead Generation
          </div>
          <h1
            className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            Lead Generation.
          </h1>
          <p className="max-w-[560px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
            Last 30 runs. Click any row to see every candidate that walked
            through the door.
          </p>
          <p className="font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
            the machine runs while you sleep.
          </p>
        </div>
        <RunNowButton />
      </header>

      {/* Runs table */}
      <section aria-labelledby="runs-heading">
        <h2 id="runs-heading" className="sr-only">
          Runs log
        </h2>
        <RunsTable runs={runsForTable} candidatesByRunId={candidatesByRunId} />
      </section>
    </div>
  );
}
