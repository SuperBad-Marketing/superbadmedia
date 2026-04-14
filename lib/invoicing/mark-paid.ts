import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import {
  invoices,
  type InvoiceRow,
  type InvoicePaidVia,
} from "@/lib/db/schema/invoices";
import { logActivity } from "@/lib/activity-log";
import {
  transitionInvoiceStatus,
  IllegalInvoiceTransitionError,
} from "@/lib/invoicing/transitions";

type DatabaseLike = typeof defaultDb;

export type MarkInvoicePaidResult =
  | { ok: true; invoice: InvoiceRow; alreadyPaid: boolean }
  | { ok: false; error: string };

/**
 * Flip an invoice to `paid`. Idempotent — if the row is already `paid`
 * we return `ok: true, alreadyPaid: true` without re-logging. The Stripe
 * webhook and the admin "Mark as paid" button both call this.
 */
export async function markInvoicePaid(
  input: {
    invoice_id: string;
    paid_via: InvoicePaidVia;
    stripe_payment_intent_id?: string | null;
    nowMs?: number;
  },
  dbOverride?: DatabaseLike,
): Promise<MarkInvoicePaidResult> {
  const database = dbOverride ?? defaultDb;
  const now = input.nowMs ?? Date.now();

  const current = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.invoice_id))
    .get();
  if (!current) return { ok: false, error: "invoice_not_found" };

  if (current.status === "paid") {
    return { ok: true, invoice: current, alreadyPaid: true };
  }
  if (current.status !== "sent" && current.status !== "overdue") {
    return { ok: false, error: `invoice_not_payable:${current.status}` };
  }

  try {
    const updated = await transitionInvoiceStatus(
      {
        invoice_id: current.id,
        from: current.status,
        to: "paid",
        patch: {
          paid_at_ms: now,
          paid_via: input.paid_via,
          stripe_payment_intent_id: input.stripe_payment_intent_id ?? null,
        },
        nowMs: now,
      },
      database,
    );

    await logActivity({
      companyId: current.company_id,
      dealId: current.deal_id,
      kind: input.paid_via === "stripe" ? "invoice_paid_online" : "invoice_marked_paid",
      body: `Invoice ${current.invoice_number} paid via ${input.paid_via}.`,
      meta: {
        invoice_id: current.id,
        invoice_number: current.invoice_number,
        paid_via: input.paid_via,
        stripe_payment_intent_id: input.stripe_payment_intent_id ?? null,
      },
      createdAtMs: now,
    });

    return { ok: true, invoice: updated, alreadyPaid: false };
  } catch (err) {
    if (err instanceof IllegalInvoiceTransitionError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}
