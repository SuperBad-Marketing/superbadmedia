import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import {
  invoices,
  type InvoiceInsert,
  type InvoiceLineItem,
  type InvoiceRow,
} from "@/lib/db/schema/invoices";
import { companies } from "@/lib/db/schema/companies";
import { allocateInvoiceNumber } from "@/lib/invoicing/sequences";
import { deriveInvoiceTotals, sumLineItems } from "@/lib/invoicing/totals";
import { logActivity } from "@/lib/activity-log";
import { transitionInvoiceStatus } from "@/lib/invoicing/transitions";
import { sendEmail } from "@/lib/channels/email/send";
import {
  composeInvoiceSupersedeEmail,
  composeInvoiceReminderEmail,
} from "@/lib/invoicing/compose-emails";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import {
  cancelPendingTaskByKey,
  invoiceIdempotencyKeys,
} from "@/lib/invoicing/cancel-scheduled";

type DatabaseLike = typeof defaultDb;

export type AdminMutationResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

function parseLineItems(raw: unknown): InvoiceLineItem[] {
  if (Array.isArray(raw)) return raw as InvoiceLineItem[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as InvoiceLineItem[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function recomputeTotals(
  items: InvoiceLineItem[],
  gstApplicable: boolean,
): { total_cents_inc_gst: number; total_cents_ex_gst: number; gst_cents: number } {
  const total = sumLineItems(items);
  return deriveInvoiceTotals(total, gstApplicable);
}

/**
 * Append a line item to a `draft` invoice, re-derive totals, persist.
 * Rejects non-draft rows — spec §4.3 action matrix only allows "Add line
 * item" on draft.
 */
export async function addInvoiceLineItem(
  input: {
    invoice_id: string;
    lineItem: Omit<InvoiceLineItem, "line_total_cents_inc_gst" | "is_recurring"> & {
      is_recurring?: boolean;
    };
    nowMs?: number;
  },
  dbOverride?: DatabaseLike,
): Promise<AdminMutationResult<{ invoice: InvoiceRow }>> {
  const database = dbOverride ?? defaultDb;
  const now = input.nowMs ?? Date.now();

  const invoice = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.invoice_id))
    .get();
  if (!invoice) return { ok: false, error: "invoice_not_found" };
  if (invoice.status !== "draft") {
    return { ok: false, error: `invoice_not_draft:${invoice.status}` };
  }

  const items = parseLineItems(invoice.line_items_json);
  const qty = Math.max(1, Math.floor(input.lineItem.quantity));
  const unit = Math.max(0, Math.round(input.lineItem.unit_price_cents_inc_gst));
  const added: InvoiceLineItem = {
    description: input.lineItem.description.trim(),
    quantity: qty,
    unit_price_cents_inc_gst: unit,
    line_total_cents_inc_gst: qty * unit,
    is_recurring: input.lineItem.is_recurring ?? false,
  };
  if (!added.description) return { ok: false, error: "description_empty" };

  const nextItems = [...items, added];
  const totals = recomputeTotals(nextItems, invoice.gst_applicable);

  const [updated] = await database
    .update(invoices)
    .set({
      line_items_json: nextItems as unknown as string,
      total_cents_inc_gst: totals.total_cents_inc_gst,
      total_cents_ex_gst: totals.total_cents_ex_gst,
      gst_cents: totals.gst_cents,
      updated_at_ms: now,
    })
    .where(eq(invoices.id, invoice.id))
    .returning();

  return { ok: true, invoice: updated };
}

export async function removeInvoiceLineItem(
  input: { invoice_id: string; index: number; nowMs?: number },
  dbOverride?: DatabaseLike,
): Promise<AdminMutationResult<{ invoice: InvoiceRow }>> {
  const database = dbOverride ?? defaultDb;
  const now = input.nowMs ?? Date.now();

  const invoice = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.invoice_id))
    .get();
  if (!invoice) return { ok: false, error: "invoice_not_found" };
  if (invoice.status !== "draft") {
    return { ok: false, error: `invoice_not_draft:${invoice.status}` };
  }

  const items = parseLineItems(invoice.line_items_json);
  if (input.index < 0 || input.index >= items.length) {
    return { ok: false, error: "index_out_of_range" };
  }
  const nextItems = items.filter((_, i) => i !== input.index);
  const totals = recomputeTotals(nextItems, invoice.gst_applicable);

  const [updated] = await database
    .update(invoices)
    .set({
      line_items_json: nextItems as unknown as string,
      total_cents_inc_gst: totals.total_cents_inc_gst,
      total_cents_ex_gst: totals.total_cents_ex_gst,
      gst_cents: totals.gst_cents,
      updated_at_ms: now,
    })
    .where(eq(invoices.id, invoice.id))
    .returning();

  return { ok: true, invoice: updated };
}

export async function updateInvoiceDueDate(
  input: { invoice_id: string; due_at_ms: number; nowMs?: number },
  dbOverride?: DatabaseLike,
): Promise<AdminMutationResult<{ invoice: InvoiceRow }>> {
  const database = dbOverride ?? defaultDb;
  const now = input.nowMs ?? Date.now();

  const invoice = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.invoice_id))
    .get();
  if (!invoice) return { ok: false, error: "invoice_not_found" };
  if (invoice.status !== "draft") {
    return { ok: false, error: `invoice_not_draft:${invoice.status}` };
  }
  if (!Number.isFinite(input.due_at_ms) || input.due_at_ms <= 0) {
    return { ok: false, error: "due_at_invalid" };
  }

  const [updated] = await database
    .update(invoices)
    .set({ due_at_ms: input.due_at_ms, updated_at_ms: now })
    .where(eq(invoices.id, invoice.id))
    .returning();

  return { ok: true, invoice: updated };
}

/**
 * Admin void — transitions draft/sent/overdue → void. Cancels any
 * pending scheduled tasks for this invoice's cycle.
 */
export async function voidInvoice(
  input: { invoice_id: string; reason?: string | null; nowMs?: number },
  dbOverride?: DatabaseLike,
): Promise<AdminMutationResult<{ invoice: InvoiceRow }>> {
  const database = dbOverride ?? defaultDb;
  const now = input.nowMs ?? Date.now();

  const current = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.invoice_id))
    .get();
  if (!current) return { ok: false, error: "invoice_not_found" };
  if (current.status === "void") {
    return { ok: true, invoice: current };
  }
  if (current.status === "paid") {
    return { ok: false, error: "invoice_paid_cannot_void" };
  }

  const updated = await transitionInvoiceStatus(
    {
      invoice_id: current.id,
      from: current.status,
      to: "void",
      nowMs: now,
    },
    database,
  );

  // Cancel any in-flight auto-send + overdue reminder for this invoice.
  if (current.cycle_index != null) {
    await cancelPendingTaskByKey(
      invoiceIdempotencyKeys.send(current.deal_id, current.cycle_index),
      database,
    );
  }
  await cancelPendingTaskByKey(
    invoiceIdempotencyKeys.overdueReminder(current.id),
    database,
  );

  await logActivity({
    companyId: current.company_id,
    dealId: current.deal_id,
    kind: "invoice_voided",
    body: `Invoice ${current.invoice_number} voided${input.reason ? ` — ${input.reason}` : ""}.`,
    meta: {
      invoice_id: current.id,
      invoice_number: current.invoice_number,
      previous_status: current.status,
      reason: input.reason ?? null,
    },
    createdAtMs: now,
  });

  return { ok: true, invoice: updated };
}

/**
 * Supersede — void source + create a fresh draft carrying forward deal,
 * company, source quote, scope summary, and existing line items. Stamps
 * `supersedes_invoice_id` on the new row; the inverse relationship is
 * recovered by query (no schema change). If the source was already
 * `sent`/`overdue`, dispatches the deterministic supersede notification.
 */
export async function supersedeInvoice(
  input: { source_invoice_id: string; nowMs?: number },
  dbOverride?: DatabaseLike,
): Promise<AdminMutationResult<{ new_invoice: InvoiceRow }>> {
  const database = dbOverride ?? defaultDb;
  const now = input.nowMs ?? Date.now();

  const source = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.source_invoice_id))
    .get();
  if (!source) return { ok: false, error: "invoice_not_found" };
  if (source.status === "paid") {
    return { ok: false, error: "invoice_paid_cannot_supersede" };
  }
  if (source.status === "void") {
    return { ok: false, error: "invoice_already_void" };
  }

  const company = await database
    .select()
    .from(companies)
    .where(eq(companies.id, source.company_id))
    .get();
  if (!company) return { ok: false, error: "company_not_found" };

  const previousStatus = source.status;

  // Void the source first (cancels pending scheduled tasks for its cycle).
  const voidResult = await voidInvoice(
    { invoice_id: source.id, reason: "superseded", nowMs: now },
    database,
  );
  if (!voidResult.ok) return { ok: false, error: voidResult.error };

  // Carry forward line items + totals. GST applicability snapshots from
  // the current company state — matches generateInvoice() semantics.
  const carriedItems =
    typeof source.line_items_json === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(source.line_items_json as unknown as string);
            return Array.isArray(parsed) ? (parsed as InvoiceLineItem[]) : [];
          } catch {
            return [];
          }
        })()
      : Array.isArray(source.line_items_json)
        ? (source.line_items_json as unknown as InvoiceLineItem[])
        : [];
  const totals = recomputeTotals(carriedItems, company.gst_applicable);

  const year = new Date(now).getUTCFullYear();
  const invoice_number = await allocateInvoiceNumber({ year, db: database });

  const DAY_MS = 24 * 60 * 60 * 1000;
  const due_at_ms = now + company.payment_terms_days * DAY_MS;

  const row: InvoiceInsert = {
    id: randomUUID(),
    invoice_number,
    deal_id: source.deal_id,
    company_id: source.company_id,
    quote_id: source.quote_id,
    token: randomBytes(24).toString("base64url"),
    status: "draft",
    cycle_index: source.cycle_index,
    cycle_start_ms: source.cycle_start_ms,
    cycle_end_ms: source.cycle_end_ms,
    issue_date_ms: now,
    due_at_ms,
    paid_at_ms: null,
    paid_via: null,
    stripe_payment_intent_id: null,
    total_cents_inc_gst: totals.total_cents_inc_gst,
    total_cents_ex_gst: totals.total_cents_ex_gst,
    gst_cents: totals.gst_cents,
    gst_applicable: company.gst_applicable,
    line_items_json: carriedItems as unknown as string,
    scope_summary: source.scope_summary,
    supersedes_invoice_id: source.id,
    thread_message_id: null,
    reminder_count: 0,
    last_reminder_at_ms: null,
    auto_send_at_ms: null,
    created_at_ms: now,
    updated_at_ms: now,
  };

  const inserted = await database.insert(invoices).values(row).returning();
  const newInvoice = inserted[0];

  await logActivity({
    companyId: source.company_id,
    dealId: source.deal_id,
    kind: "invoice_superseded",
    body: `Invoice ${source.invoice_number} superseded by ${newInvoice.invoice_number}.`,
    meta: {
      source_invoice_id: source.id,
      source_invoice_number: source.invoice_number,
      new_invoice_id: newInvoice.id,
      new_invoice_number: newInvoice.invoice_number,
      previous_status: previousStatus,
    },
    createdAtMs: now,
  });

  await logActivity({
    companyId: newInvoice.company_id,
    dealId: newInvoice.deal_id,
    kind: "invoice_generated",
    body: `Invoice ${newInvoice.invoice_number} generated (supersedes ${source.invoice_number}).`,
    meta: {
      invoice_id: newInvoice.id,
      invoice_number: newInvoice.invoice_number,
      source: "manual",
      supersedes_invoice_id: source.id,
    },
    createdAtMs: now,
  });

  // Notify client when the superseded invoice had already left the client's inbox.
  if (previousStatus === "sent" || previousStatus === "overdue") {
    const deal = await database
      .select()
      .from(deals)
      .where(eq(deals.id, source.deal_id))
      .get();
    const recipient = deal?.primary_contact_id
      ? (await database
          .select()
          .from(contacts)
          .where(eq(contacts.id, deal.primary_contact_id))
          .get()) ?? null
      : null;
    const to = recipient?.email ?? null;
    if (to) {
      const parts = composeInvoiceSupersedeEmail({
        newInvoice,
        previousInvoiceNumber: source.invoice_number,
        company,
      });
      await sendEmail({
        to,
        subject: parts.subject,
        body: parts.bodyHtml,
        classification: "invoice_supersede",
        purpose: `invoicing:supersede:${newInvoice.id}`,
      });
    }
  }

  return { ok: true, new_invoice: newInvoice };
}

/**
 * Admin-triggered reminder (manual, any time on sent/overdue). Uses the
 * deterministic reminder composer; bumps `reminder_count` +
 * `last_reminder_at_ms`; cancels the automated overdue reminder so the
 * cron won't fire a duplicate.
 */
export async function sendInvoiceReminder(
  input: { invoice_id: string; nowMs?: number },
  dbOverride?: DatabaseLike,
): Promise<AdminMutationResult<{ invoice: InvoiceRow; recipient: string | null }>> {
  const database = dbOverride ?? defaultDb;
  const now = input.nowMs ?? Date.now();

  const invoice = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.invoice_id))
    .get();
  if (!invoice) return { ok: false, error: "invoice_not_found" };
  if (invoice.status !== "sent" && invoice.status !== "overdue") {
    return { ok: false, error: `invoice_not_remindable:${invoice.status}` };
  }

  const company = await database
    .select()
    .from(companies)
    .where(eq(companies.id, invoice.company_id))
    .get();
  if (!company) return { ok: false, error: "company_not_found" };

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, invoice.deal_id))
    .get();
  const recipient = deal?.primary_contact_id
    ? (await database
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) ?? null
    : null;
  const to = recipient?.email ?? null;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const daysOverdue = Math.max(
    0,
    Math.floor((now - invoice.due_at_ms) / DAY_MS),
  );
  const email = composeInvoiceReminderEmail({
    invoice,
    company,
    reminderCount: invoice.reminder_count,
    daysOverdue,
  });

  if (to) {
    const result = await sendEmail({
      to,
      subject: email.subject,
      body: email.bodyHtml,
      classification: "invoice_reminder",
      purpose: `invoicing:reminder_manual:${invoice.id}`,
    });
    if (!result.sent && !result.skipped) {
      return { ok: false, error: `send_failed:${result.reason ?? "unknown"}` };
    }
  }

  const [updated] = await database
    .update(invoices)
    .set({
      reminder_count: invoice.reminder_count + 1,
      last_reminder_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(invoices.id, invoice.id))
    .returning();

  // Cancel the automated overdue reminder if still pending — we're doing it manually.
  await cancelPendingTaskByKey(
    invoiceIdempotencyKeys.overdueReminder(invoice.id),
    database,
  );

  await logActivity({
    companyId: invoice.company_id,
    dealId: invoice.deal_id,
    contactId: recipient?.id ?? null,
    kind: "invoice_reminder_sent",
    body: `Reminder sent for ${invoice.invoice_number} (manual, ${daysOverdue} days overdue).`,
    meta: {
      invoice_id: invoice.id,
      reminder_count: invoice.reminder_count + 1,
      days_overdue: daysOverdue,
      recipient_email: to,
      trigger: "manual",
    },
    createdAtMs: now,
  });

  return { ok: true, invoice: updated, recipient: to };
}

/**
 * Cancel the auto-send scheduled task so `sendInvoice()` can be called
 * immediately without the cron racing a second dispatch.
 */
export async function cancelAutoSendForInvoice(
  invoice: Pick<InvoiceRow, "deal_id" | "cycle_index">,
  dbOverride?: DatabaseLike,
): Promise<void> {
  if (invoice.cycle_index == null) return;
  await cancelPendingTaskByKey(
    invoiceIdempotencyKeys.send(invoice.deal_id, invoice.cycle_index),
    dbOverride,
  );
}
