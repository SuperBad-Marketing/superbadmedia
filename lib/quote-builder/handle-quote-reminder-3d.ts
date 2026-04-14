import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { quotes, type QuoteRow } from "@/lib/db/schema/quotes";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import { composeQuoteReminder3d } from "@/lib/quote-builder/compose-reminder-email";

type DatabaseLike = typeof defaultDb;

export interface HandleQuoteReminder3dInput {
  quote_id: string;
  task_id?: string;
  /** Passed through from the scheduled_tasks row for audit. */
  attempts?: number;
}

export interface HandleQuoteReminder3dResult {
  /** `true` = reminder sent (or fallback dispatched); `false` = skipped. */
  sent: boolean;
  skippedReason?:
    | "status_not_sent"
    | "quote_missing"
    | "send_failed"
    | "no_recipient_email";
}

/**
 * `quote_reminder_3d` handler core per spec §8.3.
 *
 * Spec semantics: re-read quote; if status is not `sent` (explicitly
 * excludes `viewed`), skip. View-tracking already flipped the pending
 * `quote_reminder_3d` row to `skipped` when the viewer opened the page
 * (see `view-tracking.ts`), so arriving here with `viewed` means a race;
 * treat as skip anyway.
 *
 * Otherwise compose the Claude-drafted reminder, run the drift check
 * (inside `composeQuoteReminder3d`), dispatch via `sendEmail()`, and log
 * `quote_reminder_sent`.
 */
export async function handleQuoteReminder3d(
  input: HandleQuoteReminder3dInput,
  dbOverride?: DatabaseLike,
): Promise<HandleQuoteReminder3dResult> {
  const database = dbOverride ?? defaultDb;
  const quote = (await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, input.quote_id))
    .get()) as QuoteRow | undefined;

  if (!quote) return { sent: false, skippedReason: "quote_missing" };
  if (quote.status !== "sent") {
    return { sent: false, skippedReason: "status_not_sent" };
  }

  const composed = await composeQuoteReminder3d(
    { quote_id: quote.id },
    database,
  );

  if (!composed.recipientEmail) {
    return { sent: false, skippedReason: "no_recipient_email" };
  }

  const sendResult = await sendEmail({
    to: composed.recipientEmail,
    subject: composed.subject,
    body: composed.bodyHtml,
    classification: "quote_reminder",
    purpose: `quote-reminder-3d:${quote.id}`,
  });

  if (!sendResult.sent) {
    // Let the worker's backoff handle retry — throw so the scheduled_tasks
    // row increments attempts and reschedules. A log-only no-op would
    // silently swallow the failure.
    throw new Error(
      `quote_reminder_3d: send failed (${sendResult.reason ?? "unknown"})`,
    );
  }

  // Email has already been dispatched — a log write failure here must not
  // cause the worker to retry and double-send. Swallow + warn; the send is
  // the irreversible side effect, the log is bookkeeping.
  try {
    await logActivity({
    companyId: quote.company_id,
    dealId: quote.deal_id,
    kind: "quote_reminder_sent",
    body: "3-day unread reminder sent.",
    meta: {
      quote_id: quote.id,
      deal_id: quote.deal_id,
      company_id: quote.company_id,
      task_id: input.task_id ?? null,
      email_message_id: sendResult.messageId ?? null,
      drift_check_result: composed.drift.pass
        ? composed.drift.notes
          ? "pass_with_notes"
          : "pass"
        : "fail_redraft",
      llm_job: "draft-quote-reminder-3d",
      attempts: input.attempts ?? 0,
      fallback_used: composed.fallbackUsed,
    },
    });
  } catch (err) {
    console.warn(
      `quote_reminder_3d: email dispatched but activity log failed (quote=${quote.id}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { sent: true };
}
