/**
 * Support-ticket idle auto-resolve scheduler + shared enqueue helper.
 *
 * Called from `lib/graph/sync.ts` on every new inbound to a support@
 * thread, and from `setTicketStatus` / `closeTicket` server actions, so
 * the idle clock always restarts from the latest activity.
 *
 * Idempotency key is bucketed by thread + scheduled day so the enqueue
 * collapses duplicates within a day but does move the run forward when
 * fresh activity lands (worker will see an earlier pending row for the
 * same thread and leave it alone; when the existing row fires, the
 * handler re-checks the idle clock and re-enqueues itself if still
 * active).
 *
 * Auto-resolve threshold lives in `settings.inbox.ticket_auto_resolve_idle_days`
 * (default 7 per spec §4.3, seeded in migration 0037).
 */
import settings from "@/lib/settings";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function scheduleTicketAutoResolveIdle(
  threadId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  const idleDays = await settings.get("inbox.ticket_auto_resolve_idle_days");
  const runAtMs = nowMs + idleDays * MS_PER_DAY;
  const bucketDay = Math.floor(runAtMs / MS_PER_DAY);
  await enqueueTask({
    task_type: "inbox_ticket_auto_resolve_idle",
    runAt: runAtMs,
    payload: { thread_id: threadId },
    idempotencyKey: `inbox-ticket-auto-resolve:${threadId}:${bucketDay}`,
  });
}
