import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";

type DatabaseLike = typeof defaultDb;

/**
 * Cancel pending `scheduled_tasks` rows by exact `idempotency_key`. Used
 * when the admin preempts an automated path (send-now, void, supersede,
 * manual reminder) — the row is marked `skipped` rather than deleted so
 * the audit trail stays intact.
 *
 * Only rows still in `pending` status are touched. Returns the count of
 * rows updated.
 */
export async function cancelPendingTaskByKey(
  idempotencyKey: string,
  dbOverride?: DatabaseLike,
): Promise<number> {
  const database = dbOverride ?? defaultDb;
  const rows = await database
    .update(scheduled_tasks)
    .set({ status: "skipped" })
    .where(
      and(
        eq(scheduled_tasks.idempotency_key, idempotencyKey),
        eq(scheduled_tasks.status, "pending"),
      ),
    )
    .returning({ id: scheduled_tasks.id });
  return rows.length;
}

/**
 * Idempotency key helpers — single source of truth for the keys every
 * invoicing call-site (handlers + admin actions) agrees on. Drifting
 * strings in different files was the trap BI-1a caller split avoided.
 */
export const invoiceIdempotencyKeys = {
  generate: (dealId: string, cycleIndex: number) =>
    `manual_invoice_generate:${dealId}:${cycleIndex}`,
  send: (dealId: string, cycleIndex: number) =>
    `manual_invoice_send:${dealId}:${cycleIndex}`,
  overdueReminder: (invoiceId: string) =>
    `invoice_overdue_reminder:${invoiceId}`,
};
