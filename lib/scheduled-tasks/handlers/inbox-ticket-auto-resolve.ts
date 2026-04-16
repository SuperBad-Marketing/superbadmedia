/**
 * Support-ticket idle auto-resolve handler — flips `ticket_status` to
 * `resolved` on support@ threads that haven't received new activity
 * within `settings.inbox.ticket_auto_resolve_idle_days` (spec §4.3).
 *
 * The handler is triggered per-thread by `scheduleTicketAutoResolveIdle`
 * in `lib/graph/ticket-auto-resolve.ts`. Every new inbound on a support@
 * thread re-enqueues, so the idle clock restarts from the latest
 * activity — a fresh reply from the customer effectively cancels an
 * older pending resolution by the idempotency key changing day bucket.
 *
 * The handler checks the idle clock itself rather than trusting the
 * enqueue time, because the row may have been stuck behind other tasks
 * or re-enqueued by a newer inbound. If the ticket has been touched
 * since, the handler re-enqueues for the next idle window instead of
 * resolving.
 *
 * Only threads whose current `ticket_status` is `open` or
 * `waiting_on_customer` are touched; already-`resolved` or NULL-status
 * threads (e.g. no ticket bound, or manually resolved) are left alone.
 *
 * Logs `inbox_ticket_auto_resolved` with the pre-resolution status.
 */
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { threads } from "@/lib/db/schema/messages";
import { activity_log } from "@/lib/db/schema/activity-log";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import settings from "@/lib/settings";
import { scheduleTicketAutoResolveIdle } from "@/lib/graph/ticket-auto-resolve";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const handleInboxTicketAutoResolveIdle: TaskHandler = async (task) => {
  const payload = task.payload as { thread_id?: string } | null;
  const threadId = payload?.thread_id;
  if (!threadId) {
    throw new Error("inbox_ticket_auto_resolve_idle: missing thread_id in payload");
  }

  const threadRow = await db
    .select({
      id: threads.id,
      sending_address: threads.sending_address,
      ticket_status: threads.ticket_status,
      last_message_at_ms: threads.last_message_at_ms,
      last_inbound_at_ms: threads.last_inbound_at_ms,
      last_outbound_at_ms: threads.last_outbound_at_ms,
      updated_at_ms: threads.updated_at_ms,
      contact_id: threads.contact_id,
    })
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();

  if (!threadRow) return;
  if (threadRow.sending_address !== "support@") return;
  if (threadRow.ticket_status !== "open" && threadRow.ticket_status !== "waiting_on_customer") {
    return;
  }

  const idleDays = await settings.get("inbox.ticket_auto_resolve_idle_days");
  const thresholdMs = idleDays * MS_PER_DAY;
  const nowMs = Date.now();

  const mostRecentActivityMs = Math.max(
    threadRow.last_message_at_ms ?? 0,
    threadRow.last_inbound_at_ms ?? 0,
    threadRow.last_outbound_at_ms ?? 0,
    threadRow.updated_at_ms ?? 0,
  );

  if (nowMs - mostRecentActivityMs < thresholdMs) {
    await scheduleTicketAutoResolveIdle(threadId, nowMs);
    return;
  }

  const previousStatus = threadRow.ticket_status;
  await db
    .update(threads)
    .set({
      ticket_status: "resolved",
      ticket_resolved_at_ms: nowMs,
      updated_at_ms: nowMs,
    })
    .where(eq(threads.id, threadId));

  await db.insert(activity_log).values({
    id: randomUUID(),
    contact_id: threadRow.contact_id,
    company_id: null,
    deal_id: null,
    kind: "inbox_ticket_auto_resolved",
    body: `Support ticket auto-resolved after ${idleDays} day${idleDays === 1 ? "" : "s"} idle.`,
    meta: {
      thread_id: threadId,
      previous_status: previousStatus,
      idle_days: idleDays,
    },
    created_at_ms: nowMs,
    created_by: "claude",
  });
};

export const INBOX_TICKET_AUTO_RESOLVE_HANDLERS: HandlerMap = {
  inbox_ticket_auto_resolve_idle: handleInboxTicketAutoResolveIdle,
};
