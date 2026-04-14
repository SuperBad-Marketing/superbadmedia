import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { quotes, type QuoteRow, type QuoteStatus } from "@/lib/db/schema/quotes";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { transitionQuoteStatus } from "@/lib/quote-builder/transitions";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import { buildQuoteExpiredEmail } from "@/lib/quote-builder/emails/quote-expired-email";

type DatabaseLike = typeof defaultDb;

export interface HandleQuoteExpireInput {
  quote_id: string;
  /** Scheduled task row id for audit-trail linking. */
  task_id?: string;
}

export interface HandleQuoteExpireResult {
  /** `true` = transitioned to expired; `false` = no-op (already moved on). */
  expired: boolean;
  priorStatus?: QuoteStatus;
  emailSkipped?: boolean;
  emailSkippedReason?: string;
}

/**
 * `quote_expire` handler core per spec §8.3.
 *
 * Re-reads the quote. If status is not in {`sent`, `viewed`}, returns a
 * no-op — the lifecycle already moved on (accepted, superseded,
 * withdrawn, or a concurrent expire). Otherwise transitions status →
 * `expired`, fires the static link-only expiry email, and logs
 * `quote_expired`.
 *
 * The transition call uses the row's current status as the `from`
 * precondition (concurrency guard). If two workers race, only one
 * transition succeeds; the loser catches and treats it as a no-op.
 */
export async function handleQuoteExpire(
  input: HandleQuoteExpireInput,
  dbOverride?: DatabaseLike,
): Promise<HandleQuoteExpireResult> {
  const database = dbOverride ?? defaultDb;
  const quote = (await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, input.quote_id))
    .get()) as QuoteRow | undefined;

  if (!quote) {
    // Quote vanished between enqueue and dispatch. Treat as no-op rather
    // than a hard failure — the scheduled row is doing its job.
    return { expired: false };
  }

  if (quote.status !== "sent" && quote.status !== "viewed") {
    return { expired: false, priorStatus: quote.status };
  }

  const priorStatus = quote.status;

  try {
    await transitionQuoteStatus(
      {
        quote_id: quote.id,
        from: priorStatus,
        to: "expired",
        patch: { expires_at_ms: Date.now() },
      },
      database,
    );
  } catch {
    // Concurrency — another tick or an admin transitioned the quote between
    // our read and the UPDATE. Treat as no-op, don't double-log or double-email.
    return { expired: false, priorStatus };
  }

  const company = (await database
    .select()
    .from(companies)
    .where(eq(companies.id, quote.company_id))
    .get()) as CompanyRow | undefined;

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, quote.deal_id))
    .get();

  let contact: ContactRow | undefined;
  if (deal && "primary_contact_id" in deal && deal.primary_contact_id) {
    contact = (await database
      .select()
      .from(contacts)
      .where(eq(contacts.id, deal.primary_contact_id))
      .get()) as ContactRow | undefined;
  }

  const recipientEmail = contact?.email ?? "";
  const recipientName = contact?.name ?? company?.name ?? "there";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const quoteUrl = `${baseUrl.replace(/\/$/, "")}/lite/quotes/${quote.token}`;

  let emailSkipped = false;
  let emailSkippedReason: string | undefined;
  if (!recipientEmail) {
    emailSkipped = true;
    emailSkippedReason = "no_recipient_email";
  } else {
    const email = buildQuoteExpiredEmail({
      recipientName,
      companyName: company?.name ?? "your company",
      quoteUrl,
    });
    const result = await sendEmail({
      to: recipientEmail,
      subject: email.subject,
      body: email.bodyHtml,
      classification: "quote_expired",
      purpose: `quote-expire:${quote.id}`,
    });
    if (!result.sent) {
      emailSkipped = true;
      emailSkippedReason = result.reason ?? "send_failed";
    }
  }

  await logActivity({
    companyId: quote.company_id,
    dealId: quote.deal_id,
    contactId: contact?.id ?? null,
    kind: "quote_expired",
    body: `Quote expired after ${priorStatus}.`,
    meta: {
      quote_id: quote.id,
      deal_id: quote.deal_id,
      company_id: quote.company_id,
      source: "scheduled_task",
      task_id: input.task_id ?? null,
      prior_status: priorStatus,
      expired_at_ms: Date.now(),
      email_skipped: emailSkipped,
      email_skipped_reason: emailSkippedReason ?? null,
    },
  });

  return {
    expired: true,
    priorStatus,
    emailSkipped,
    emailSkippedReason,
  };
}
