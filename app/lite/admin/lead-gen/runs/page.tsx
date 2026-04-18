import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getRecentRuns, getCandidatesForRun } from "@/lib/lead-gen/queries";
import { LeadGenTabs } from "../_components/lead-gen-tabs";
import { RunsLog } from "../_components/runs-log";
import type { LeadCandidateRow } from "@/lib/db/schema/lead-candidates";

export const metadata: Metadata = {
  title: "Lead Gen Runs — SuperBad",
};

export default async function LeadGenRunsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const runs = await getRecentRuns();

  const candidatesByRun: Record<string, LeadCandidateRow[]> = {};
  for (const run of runs) {
    candidatesByRun[run.id] = await getCandidatesForRun(run.id);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <LeadGenTabs currentPath="/lite/admin/lead-gen/runs" />
      <RunsLog runs={runs} candidatesByRun={candidatesByRun} />
    </div>
  );
}
