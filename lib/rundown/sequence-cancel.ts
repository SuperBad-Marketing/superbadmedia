import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rundown_sequence_emails } from "@/lib/db/schema/rundown-sequence-emails";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import { logActivity } from "@/lib/activity-log";

export async function cancelPendingSequenceForSession(
  sessionId: string,
  reason: string,
): Promise<number> {
  const pending = await db
    .select({ id: rundown_sequence_emails.id, scheduled_task_id: rundown_sequence_emails.scheduled_task_id })
    .from(rundown_sequence_emails)
    .where(
      and(
        eq(rundown_sequence_emails.session_id, sessionId),
        eq(rundown_sequence_emails.status, "pending"),
      ),
    );

  if (pending.length === 0) return 0;

  const now = Date.now();
  const emailIds = pending.map((e) => e.id);
  const taskIds = pending
    .map((e) => e.scheduled_task_id)
    .filter((id): id is string => id !== null);

  await db
    .update(rundown_sequence_emails)
    .set({ status: "cancelled", cancelled_at_ms: now, cancel_reason: reason })
    .where(inArray(rundown_sequence_emails.id, emailIds));

  if (taskIds.length > 0) {
    await db
      .update(scheduled_tasks)
      .set({ status: "skipped", done_at_ms: now })
      .where(
        and(
          inArray(scheduled_tasks.id, taskIds),
          eq(scheduled_tasks.status, "pending"),
        ),
      );
  }

  await logActivity({
    kind: "rundown_sequence_cancelled",
    body: `Cancelled ${pending.length} pending sequence email(s): ${reason}`,
    meta: { sessionId, emailIds, reason },
  });

  return pending.length;
}

export async function cancelPendingSequenceByEmail(
  email: string,
  reason: string,
): Promise<number> {
  const normalised = email.toLowerCase().trim();
  const sessions = await db
    .select({ id: rundownSessions.id })
    .from(rundownSessions)
    .where(eq(rundownSessions.email_normalised, normalised));

  let cancelled = 0;
  for (const session of sessions) {
    cancelled += await cancelPendingSequenceForSession(session.id, reason);
  }
  return cancelled;
}
