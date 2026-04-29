import { redirect } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { trial_tasks } from "@/lib/db/schema/trial-tasks";
import { getBenchSession } from "@/lib/bench/guard";
import { BenchDashboard } from "@/components/lite/bench/bench-dashboard";

export const metadata = {
  title: "SuperBad | Your assignments",
};

export default async function BenchHomePage() {
  const session = await getBenchSession();
  if (!session) redirect("/bench/expired");

  const candidate = db
    .select({
      name: candidates.name,
      bench_status: candidates.bench_status,
      paused_until_ms: candidates.paused_until_ms,
      hourly_rate_aud: candidates.hourly_rate_aud,
      weekly_capacity_hours: candidates.weekly_capacity_hours,
    })
    .from(candidates)
    .where(eq(candidates.id, session.candidateId))
    .get();

  if (!candidate) redirect("/bench/expired");

  const activeTasks = db
    .select({
      id: trial_tasks.id,
      task_description: trial_tasks.task_description,
      budget_cap_aud: trial_tasks.budget_cap_aud,
      due_at_ms: trial_tasks.due_at_ms,
      disposition: trial_tasks.disposition,
    })
    .from(trial_tasks)
    .where(
      and(
        eq(trial_tasks.candidate_id, session.candidateId),
        eq(trial_tasks.disposition, "pending"),
      ),
    )
    .orderBy(desc(trial_tasks.due_at_ms))
    .all();

  return (
    <BenchDashboard
      candidateName={candidate.name}
      benchStatus={candidate.bench_status}
      pausedUntilMs={candidate.paused_until_ms}
      activeTasks={activeTasks}
    />
  );
}
