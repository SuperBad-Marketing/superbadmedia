"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { companies } from "@/lib/db/schema/companies";
import { invoices, type InvoiceLineItem } from "@/lib/db/schema/invoices";
import { generateInvoice } from "@/lib/invoicing/generate";
import { sendInvoice } from "@/lib/invoicing/send";
import { markInvoicePaid } from "@/lib/invoicing/mark-paid";
import {
  addInvoiceLineItem,
  cancelAutoSendForInvoice,
  removeInvoiceLineItem,
  sendInvoiceReminder,
  supersedeInvoice,
  updateInvoiceDueDate,
  voidInvoice,
} from "@/lib/invoicing/admin-mutations";
import { composeInvoiceReminderEmailAI } from "@/lib/invoicing/compose-reminder-email";
import { paragraphsToInvoiceHtml } from "@/lib/invoicing/email-html";
import type { DriftCheckResult } from "@/lib/ai/drift-check";
import type { InvoicePaidVia } from "@/lib/db/schema/invoices";

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult<{ actor: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  return { ok: true, actor: `user:${session.user.id ?? "admin"}` };
}

function bump(invoiceId?: string) {
  revalidatePath("/lite/admin/invoices");
  if (invoiceId) revalidatePath(`/lite/admin/invoices`);
}

export async function createManualInvoiceAction(input: {
  companyId: string;
  dealId?: string | null;
}): Promise<ActionResult<{ invoiceId: string }>> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  // Resolve a deal — manual invoices need a deal_id per schema (FK not-null).
  // If no dealId passed, prefer the most recent won deal for this company.
  let dealId = input.dealId ?? null;
  if (!dealId) {
    const { deals } = await import("@/lib/db/schema/deals");
    const { desc } = await import("drizzle-orm");
    const row = await db
      .select({ id: deals.id })
      .from(deals)
      .where(eq(deals.company_id, input.companyId))
      .orderBy(desc(deals.last_stage_change_at_ms))
      .limit(1)
      .get();
    dealId = row?.id ?? null;
  }
  if (!dealId) return { ok: false, error: "No deal on this company yet." };

  const result = await generateInvoice({
    deal_id: dealId,
    cycle_index: null,
    source: "manual",
  });
  if (!result.ok) return { ok: false, error: result.error };

  bump(result.invoice.id);
  return { ok: true, invoiceId: result.invoice.id };
}

export async function addInvoiceLineItemAction(input: {
  invoiceId: string;
  lineItem: {
    description: string;
    quantity: number;
    unit_price_cents_inc_gst: number;
    is_recurring?: boolean;
  };
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const result = await addInvoiceLineItem({
    invoice_id: input.invoiceId,
    lineItem: input.lineItem as Omit<
      InvoiceLineItem,
      "line_total_cents_inc_gst" | "is_recurring"
    > & { is_recurring?: boolean },
  });
  if (!result.ok) return { ok: false, error: result.error };
  bump(input.invoiceId);
  return { ok: true };
}

export async function removeInvoiceLineItemAction(input: {
  invoiceId: string;
  index: number;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const result = await removeInvoiceLineItem({
    invoice_id: input.invoiceId,
    index: input.index,
  });
  if (!result.ok) return { ok: false, error: result.error };
  bump(input.invoiceId);
  return { ok: true };
}

export async function updateInvoiceDueDateAction(input: {
  invoiceId: string;
  dueAtMs: number;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const result = await updateInvoiceDueDate({
    invoice_id: input.invoiceId,
    due_at_ms: input.dueAtMs,
  });
  if (!result.ok) return { ok: false, error: result.error };
  bump(input.invoiceId);
  return { ok: true };
}

export async function sendInvoiceNowAction(input: {
  invoiceId: string;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const invoice = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.invoiceId))
    .get();
  if (!invoice) return { ok: false, error: "invoice_not_found" };

  // Cancel the auto-send cron for this cycle before sending manually.
  await cancelAutoSendForInvoice(invoice);

  const result = await sendInvoice({ invoice_id: input.invoiceId });
  if (!result.ok) return { ok: false, error: result.error };
  bump(input.invoiceId);
  return { ok: true };
}

export async function voidInvoiceAction(input: {
  invoiceId: string;
  reason?: string | null;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const result = await voidInvoice({
    invoice_id: input.invoiceId,
    reason: input.reason ?? null,
  });
  if (!result.ok) return { ok: false, error: result.error };
  bump(input.invoiceId);
  return { ok: true };
}

export async function supersedeInvoiceAction(input: {
  sourceInvoiceId: string;
}): Promise<ActionResult<{ newInvoiceId: string }>> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const result = await supersedeInvoice({
    source_invoice_id: input.sourceInvoiceId,
  });
  if (!result.ok) return { ok: false, error: result.error };
  bump(result.new_invoice.id);
  return { ok: true, newInvoiceId: result.new_invoice.id };
}

export interface PrepareReminderResult {
  subject: string;
  bodyParagraphs: string[];
  recipientEmail: string;
  recipientName: string;
  invoiceUrl: string;
  daysOverdue: number;
  reminderCount: number;
  drift: DriftCheckResult;
  fallbackUsed: boolean;
}

/**
 * Draft a manual follow-up reminder for Andy to review + edit before
 * dispatch. Claude-drafted when the LLM kill-switch is on, deterministic
 * fallback otherwise. Andy ships edits via `sendReminderAction({draft:…})`.
 */
export async function prepareReminderAction(input: {
  invoiceId: string;
}): Promise<ActionResult<{ value: PrepareReminderResult }>> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  try {
    const draft = await composeInvoiceReminderEmailAI({ invoice_id: input.invoiceId });
    return {
      ok: true,
      value: {
        subject: draft.subject,
        bodyParagraphs: draft.bodyParagraphs,
        recipientEmail: draft.recipientEmail,
        recipientName: draft.recipientName,
        invoiceUrl: draft.invoiceUrl,
        daysOverdue: draft.daysOverdue,
        reminderCount: draft.reminderCount,
        drift: draft.drift,
        fallbackUsed: draft.fallbackUsed,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "compose_failed",
    };
  }
}

export async function sendReminderAction(input: {
  invoiceId: string;
  /** Andy-edited draft from the modal. When omitted, server re-composes and sends. */
  draft?: { subject: string; bodyParagraphs: string[] };
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  // Re-fetch the invoice to rebuild the invoice-URL button inside the HTML
  // the server is about to dispatch. Edits to paragraph text come from
  // Andy; link + sign-off are server-owned.
  let override:
    | { subject: string; bodyParagraphs: string[]; bodyHtml: string }
    | undefined;
  if (input.draft) {
    const invoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, input.invoiceId))
      .get();
    if (!invoice) return { ok: false, error: "invoice_not_found" };
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://superbadmedia.com.au";
    const invoiceUrl = `${base.replace(/\/$/, "")}/lite/invoices/${invoice.token}`;
    override = {
      subject: input.draft.subject,
      bodyParagraphs: input.draft.bodyParagraphs,
      bodyHtml: paragraphsToInvoiceHtml(input.draft.bodyParagraphs, invoiceUrl),
    };
  }

  const result = await sendInvoiceReminder({
    invoice_id: input.invoiceId,
    draftOverride: override,
  });
  if (!result.ok) return { ok: false, error: result.error };
  bump(input.invoiceId);
  return { ok: true };
}

export async function markInvoicePaidAction(input: {
  invoiceId: string;
  paidVia?: InvoicePaidVia;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const result = await markInvoicePaid({
    invoice_id: input.invoiceId,
    paid_via: input.paidVia ?? "bank_transfer",
  });
  if (!result.ok) return { ok: false, error: result.error };
  bump(input.invoiceId);
  return { ok: true };
}

export async function updateCompanyPaymentTermsAction(input: {
  companyId: string;
  paymentTermsDays: 7 | 14 | 30 | 60;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  if (![7, 14, 30, 60].includes(input.paymentTermsDays)) {
    return { ok: false, error: "payment_terms_invalid" };
  }
  await db
    .update(companies)
    .set({ payment_terms_days: input.paymentTermsDays, updated_at_ms: Date.now() })
    .where(eq(companies.id, input.companyId));
  revalidatePath(`/lite/admin/companies/${input.companyId}`);
  return { ok: true };
}
