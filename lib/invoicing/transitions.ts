import { eq, and } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import {
  invoices,
  type InvoiceRow,
  type InvoiceStatus,
} from "@/lib/db/schema/invoices";

type DatabaseLike = typeof defaultDb;

/**
 * Invoice state machine (spec §Q9).
 *
 *   draft → sent        (sendInvoice)
 *   sent  → overdue     (sweepOverdue / overdue-reminder handler)
 *   sent  → paid        (markInvoicePaid / stripe webhook)
 *   overdue → paid      (same)
 *   draft|sent|overdue → void  (supersede / admin void)
 *
 * `paid` and `void` are terminal. Every transition asserts the current
 * status in the WHERE clause so two concurrent callers can't collide.
 */
const LEGAL_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["sent", "void"],
  sent: ["overdue", "paid", "void"],
  overdue: ["paid", "void"],
  paid: [],
  void: [],
};

export function isLegalInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export type InvoiceTransitionPatch = Partial<
  Pick<
    InvoiceRow,
    | "paid_at_ms"
    | "paid_via"
    | "stripe_payment_intent_id"
    | "thread_message_id"
    | "supersedes_invoice_id"
  >
>;

export interface TransitionInvoiceInput {
  invoice_id: string;
  from: InvoiceStatus;
  to: InvoiceStatus;
  patch?: InvoiceTransitionPatch;
  nowMs?: number;
}

export class IllegalInvoiceTransitionError extends Error {
  constructor(public readonly from: InvoiceStatus, public readonly to: InvoiceStatus) {
    super(`illegal_invoice_transition:${from}→${to}`);
    this.name = "IllegalInvoiceTransitionError";
  }
}

/**
 * Atomically flip an invoice row to `to` only if its current status is
 * `from`. Returns the updated row. Throws
 * `IllegalInvoiceTransitionError` on concurrency-miss or illegal move.
 */
export async function transitionInvoiceStatus(
  input: TransitionInvoiceInput,
  dbOverride?: DatabaseLike,
): Promise<InvoiceRow> {
  if (!isLegalInvoiceTransition(input.from, input.to)) {
    throw new IllegalInvoiceTransitionError(input.from, input.to);
  }
  const database = dbOverride ?? defaultDb;
  const now = input.nowMs ?? Date.now();

  const updated = await database
    .update(invoices)
    .set({
      status: input.to,
      updated_at_ms: now,
      ...(input.patch ?? {}),
    })
    .where(
      and(eq(invoices.id, input.invoice_id), eq(invoices.status, input.from)),
    )
    .returning();

  const row = updated[0];
  if (!row) {
    throw new IllegalInvoiceTransitionError(input.from, input.to);
  }
  return row;
}
