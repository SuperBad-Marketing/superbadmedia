import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import type {
  ScheduledTaskRow,
  ScheduledTaskType,
} from "@/lib/db/schema/scheduled-tasks";
import { renderQuotePdf } from "@/lib/quote-builder/render-quote-pdf";
import { sendEmail } from "@/lib/channels/email/send";

/**
 * Quote Builder — scheduled-task handler slots.
 *
 * QB-3 implements `quote_pdf_render` + `quote_email_send` (the two
 * handlers needed for the Send modal flow). Remaining slots stay stubbed
 * until QB-6 per `docs/specs/quote-builder.md` §8.3. Every registered
 * task is dispatched by the worker; stub throws are caught + retried
 * with backoff and surface in the admin "needs attention" queue.
 *
 * Stub slots (6, owned by QB-6):
 *   - quote_expire
 *   - quote_reminder_3d
 *   - manual_invoice_generate
 *   - manual_invoice_send
 *   - subscription_pause_resume_reminder
 *   - subscription_pause_resume
 *
 * Implemented slots (2, owned by QB-3):
 *   - quote_pdf_render
 *   - quote_email_send
 */
export class NotImplementedError extends Error {
  constructor(taskType: ScheduledTaskType) {
    super(`QB-6: handler not implemented (${taskType})`);
    this.name = "NotImplementedError";
  }
}

function stub(taskType: ScheduledTaskType) {
  return async () => {
    throw new NotImplementedError(taskType);
  };
}

interface QuotePdfRenderPayload {
  quote_id: string;
}

interface QuoteEmailSendPayload {
  quote_id: string;
  to: string;
  subject: string;
  bodyHtml: string;
  /** Optional purpose suffix for `external_call_log.job`. */
  purpose?: string;
}

function readPayload<T>(task: ScheduledTaskRow, taskType: ScheduledTaskType): T {
  const payload = task.payload as T | null;
  if (!payload) {
    throw new Error(`${taskType}: missing payload (task ${task.id})`);
  }
  return payload;
}

const quotePdfRender: TaskHandler = async (task) => {
  const { quote_id } = readPayload<QuotePdfRenderPayload>(task, "quote_pdf_render");
  // Render is fire-and-cache from the route handler today; this background
  // handler exists so a later cache layer can warm offline. KISS for now —
  // call through, throw away the buffer (Puppeteer warm-up is the value).
  await renderQuotePdf(quote_id);
};

const quoteEmailSend: TaskHandler = async (task) => {
  const payload = readPayload<QuoteEmailSendPayload>(task, "quote_email_send");
  const result = await sendEmail({
    to: payload.to,
    subject: payload.subject,
    body: payload.bodyHtml,
    classification: "quote_send",
    purpose: payload.purpose ?? `quote-builder:${payload.quote_id}`,
  });
  if (!result.sent && !result.skipped) {
    throw new Error(`quote_email_send: send failed (${result.reason ?? "unknown"})`);
  }
};

export const QUOTE_BUILDER_HANDLERS: HandlerMap = {
  quote_expire: stub("quote_expire"),
  quote_reminder_3d: stub("quote_reminder_3d"),
  manual_invoice_generate: stub("manual_invoice_generate"),
  manual_invoice_send: stub("manual_invoice_send"),
  subscription_pause_resume_reminder: stub("subscription_pause_resume_reminder"),
  subscription_pause_resume: stub("subscription_pause_resume"),
  quote_pdf_render: quotePdfRender,
  quote_email_send: quoteEmailSend,
};

/** Stub-only slots — used by qb1-handlers test to assert "still stubbed". */
export const QUOTE_BUILDER_STUB_TASK_TYPES: readonly ScheduledTaskType[] = [
  "quote_expire",
  "quote_reminder_3d",
  "manual_invoice_generate",
  "manual_invoice_send",
  "subscription_pause_resume_reminder",
  "subscription_pause_resume",
];

export const QUOTE_BUILDER_TASK_TYPES: readonly ScheduledTaskType[] = [
  ...QUOTE_BUILDER_STUB_TASK_TYPES,
  "quote_pdf_render",
  "quote_email_send",
];
