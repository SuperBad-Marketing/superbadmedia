import { and, eq, lt } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { invoices, type InvoiceRow } from "@/lib/db/schema/invoices";
import { logActivity } from "@/lib/activity-log";

type DatabaseLike = typeof defaultDb;

/**
 * Transition any `sent` invoices whose `due_at_ms` has passed into
 * `overdue`. Called from the scheduled-tasks worker's main loop (spec
 * §8.4). Returns the invoices that flipped so callers can log/act.
 */
export async function sweepOverdueInvoices(opts: {
  nowMs?: number;
  dbOverride?: DatabaseLike;
} = {}): Promise<InvoiceRow[]> {
  const database = opts.dbOverride ?? defaultDb;
  const now = opts.nowMs ?? Date.now();

  const flipped = await database
    .update(invoices)
    .set({ status: "overdue", updated_at_ms: now })
    .where(and(eq(invoices.status, "sent"), lt(invoices.due_at_ms, now)))
    .returning();

  for (const inv of flipped) {
    await logActivity({
      companyId: inv.company_id,
      dealId: inv.deal_id,
      kind: "invoice_overdue",
      body: `Invoice ${inv.invoice_number} moved to overdue.`,
      meta: {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        due_at_ms: inv.due_at_ms,
      },
      createdAtMs: now,
    });
  }

  return flipped;
}
