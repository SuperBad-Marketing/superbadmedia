import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { invoices } from "@/lib/db/schema/invoices";
import { contacts } from "@/lib/db/schema/contacts";
import { generateInvoice } from "@/lib/invoicing/generate";
import { sendInvoice } from "@/lib/invoicing/send";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { sendEmail } from "@/lib/channels/email/send";
import { composeInvoiceReminderEmail } from "@/lib/invoicing/compose-emails";
import { logActivity } from "@/lib/activity-log";
import { transitionInvoiceStatus } from "@/lib/invoicing/transitions";
import settings from "@/lib/settings";

const DAY_MS = 24 * 60 * 60 * 1000;
const AVG_MONTH_MS = 30 * DAY_MS;

interface GeneratePayload {
  deal_id: string;
  cycle_index: number;
  cycle_start?: number | null;
  cycle_end?: number | null;
  send_at?: number | null;
}

interface SendPayload {
  deal_id: string;
  cycle_index: number;
  invoice_id?: string | null;
}

interface ReminderPayload {
  invoice_id: string;
}

function readPayload<T>(task: ScheduledTaskRow, label: string): T {
  const payload = task.payload as T | null;
  if (!payload) throw new Error(`${label}: missing payload (task ${task.id})`);
  return payload;
}

/**
 * spec §8.1 — generate the draft invoice for a cycle, fire cockpit
 * notification (deferred to BI-2 UI wave), and enqueue the send task
 * for `now + review_window_days`.
 */
const handleManualInvoiceGenerate: TaskHandler = async (task) => {
  const p = readPayload<GeneratePayload>(task, "manual_invoice_generate");
  const now = Date.now();

  const deal = await defaultDb
    .select()
    .from(deals)
    .where(eq(deals.id, p.deal_id))
    .get();
  if (!deal || deal.stage !== "won") return; // chain stop
  const company = await defaultDb
    .select()
    .from(companies)
    .where(eq(companies.id, deal.company_id))
    .get();
  if (!company || company.billing_mode !== "manual") return;

  const result = await generateInvoice({
    deal_id: deal.id,
    cycle_index: p.cycle_index,
    cycle_start_ms: p.cycle_start ?? null,
    cycle_end_ms: p.cycle_end ?? null,
    source: "auto",
    nowMs: now,
  });
  if (!result.ok) throw new Error(`generateInvoice failed: ${result.error}`);

  const reviewDays = await settings.get("invoice.review_window_days");
  const sendAt = (p.send_at ?? now) + reviewDays * DAY_MS;
  await enqueueTask({
    task_type: "manual_invoice_send",
    runAt: sendAt,
    payload: {
      deal_id: deal.id,
      cycle_index: p.cycle_index,
      invoice_id: result.invoice.id,
    } satisfies SendPayload,
    idempotencyKey: `manual_invoice_send:${deal.id}:${p.cycle_index}`,
  });
};

/**
 * spec §8.2 — if still draft, send. On success enqueue the overdue
 * reminder + (if the subscription is still active and committed)
 * the next cycle's generate.
 */
const handleManualInvoiceSend: TaskHandler = async (task) => {
  const p = readPayload<SendPayload>(task, "manual_invoice_send");
  const invoice_id = p.invoice_id;
  if (!invoice_id) return; // legacy payload shape — skip

  const invoice = await defaultDb
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoice_id))
    .get();
  if (!invoice) return;
  if (invoice.status !== "draft") return; // already sent / voided / paid

  const result = await sendInvoice({ invoice_id: invoice.id });
  if (!result.ok) throw new Error(`sendInvoice failed: ${result.error}`);
  const sent = result.invoice;

  // Overdue reminder — due_at + overdue_reminder_days.
  const reminderDays = await settings.get("invoice.overdue_reminder_days");
  await enqueueTask({
    task_type: "invoice_overdue_reminder",
    runAt: sent.due_at_ms + reminderDays * DAY_MS,
    payload: { invoice_id: sent.id } satisfies ReminderPayload,
    idempotencyKey: `invoice_overdue_reminder:${sent.id}`,
  });

  // Chain continuation — only retainers with an active subscription +
  // remaining commitment. Project-only invoices stop after cycle 0.
  const deal = await defaultDb
    .select()
    .from(deals)
    .where(eq(deals.id, p.deal_id))
    .get();
  if (!deal) return;
  const active = deal.subscription_state === "active";
  const committed = deal.committed_until_date_ms;
  const nextSendAt = sent.issue_date_ms + AVG_MONTH_MS;
  if (active && committed && nextSendAt < committed) {
    const reviewDays = await settings.get("invoice.review_window_days");
    await enqueueTask({
      task_type: "manual_invoice_generate",
      runAt: nextSendAt - reviewDays * DAY_MS,
      payload: {
        deal_id: deal.id,
        cycle_index: p.cycle_index + 1,
        cycle_start: nextSendAt,
        cycle_end: nextSendAt + AVG_MONTH_MS,
        send_at: nextSendAt,
      } satisfies GeneratePayload,
      idempotencyKey: `manual_invoice_generate:${deal.id}:${p.cycle_index + 1}`,
    });
  }
};

/**
 * spec §8.3 — automated overdue reminder (once per invoice, 3 days
 * post-due). Manual follow-ups live at the admin action in BI-2.
 */
const handleInvoiceOverdueReminder: TaskHandler = async (task) => {
  const p = readPayload<ReminderPayload>(task, "invoice_overdue_reminder");
  const now = Date.now();

  const invoice = await defaultDb
    .select()
    .from(invoices)
    .where(eq(invoices.id, p.invoice_id))
    .get();
  if (!invoice) return;
  if (invoice.status !== "sent" && invoice.status !== "overdue") return;

  let current = invoice;
  if (current.status === "sent") {
    current = await transitionInvoiceStatus(
      { invoice_id: current.id, from: "sent", to: "overdue", nowMs: now },
      defaultDb,
    );
  }

  const company = await defaultDb
    .select()
    .from(companies)
    .where(eq(companies.id, current.company_id))
    .get();
  if (!company) return;

  const deal = await defaultDb
    .select()
    .from(deals)
    .where(eq(deals.id, current.deal_id))
    .get();
  const recipient = deal?.primary_contact_id
    ? (await defaultDb
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) ?? null
    : null;
  const to = recipient?.email ?? null;

  const daysOverdue = Math.max(
    0,
    Math.floor((now - current.due_at_ms) / DAY_MS),
  );
  const parts = composeInvoiceReminderEmail({
    invoice: current,
    company,
    reminderCount: current.reminder_count,
    daysOverdue,
  });

  if (to) {
    const result = await sendEmail({
      to,
      subject: parts.subject,
      body: parts.bodyHtml,
      classification: "invoice_reminder",
      purpose: `invoicing:reminder:${current.id}`,
    });
    if (!result.sent && !result.skipped) {
      throw new Error(
        `invoice_overdue_reminder: send failed (${result.reason ?? "unknown"})`,
      );
    }
  }

  await defaultDb
    .update(invoices)
    .set({
      reminder_count: current.reminder_count + 1,
      last_reminder_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(invoices.id, current.id));

  await logActivity({
    companyId: current.company_id,
    dealId: current.deal_id,
    contactId: recipient?.id ?? null,
    kind: "invoice_reminder_sent",
    body: `Reminder sent for ${current.invoice_number} (${daysOverdue} days overdue).`,
    meta: {
      invoice_id: current.id,
      reminder_count: current.reminder_count + 1,
      days_overdue: daysOverdue,
      recipient_email: to,
    },
    createdAtMs: now,
  });
};

export const INVOICING_HANDLERS: HandlerMap = {
  manual_invoice_generate: handleManualInvoiceGenerate,
  manual_invoice_send: handleManualInvoiceSend,
  invoice_overdue_reminder: handleInvoiceOverdueReminder,
};
