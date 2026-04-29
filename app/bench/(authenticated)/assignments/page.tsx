import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { trial_tasks } from "@/lib/db/schema/trial-tasks";
import { getBenchSession } from "@/lib/bench/guard";
import { AssignmentsList } from "@/components/lite/bench/assignments-list";

export const metadata = {
  title: "SuperBad | Assignments",
};

export default async function BenchAssignmentsPage() {
  const session = await getBenchSession();
  if (!session) redirect("/bench/expired");

  const tasks = db
    .select({
      id: trial_tasks.id,
      task_description: trial_tasks.task_description,
      budget_cap_aud: trial_tasks.budget_cap_aud,
      due_at_ms: trial_tasks.due_at_ms,
      delivered_at_ms: trial_tasks.delivered_at_ms,
      delivery_url_or_asset: trial_tasks.delivery_url_or_asset,
      disposition: trial_tasks.disposition,
      sent_at_ms: trial_tasks.sent_at_ms,
    })
    .from(trial_tasks)
    .where(eq(trial_tasks.candidate_id, session.candidateId))
    .orderBy(desc(trial_tasks.due_at_ms))
    .all();

  const active = tasks.filter(
    (t) => t.disposition === "pending" || t.disposition === "redelivered",
  );
  const completed = tasks.filter(
    (t) => t.disposition === "shipped" || t.disposition === "archived",
  );

  return (
    <AssignmentsList
      activeTasks={active}
      completedTasks={completed}
    />
  );
}
