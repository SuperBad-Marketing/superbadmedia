import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { quotes, type QuoteRow } from "@/lib/db/schema/quotes";
import { deals, type DealRow } from "@/lib/db/schema/deals";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import {
  transitionQuoteStatus,
  type QuoteTransitionPatch,
} from "@/lib/quote-builder/transitions";
import { finaliseDealAsWon } from "@/lib/crm/finalise-deal";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { getCurrentQuoteLegalVersions } from "@/lib/quote-builder/legal";

type DatabaseLike = typeof defaultDb;

export type AcceptQuoteInput = {
  quote_id: string;
  ip: string | null;
  userAgent: string | null;
};

export type AcceptQuoteResult =
  | {
      ok: true;
      quote: QuoteRow;
      deal: DealRow;
      company: CompanyRow;
      primaryContact: ContactRow | null;
      paymentMode: "stripe" | "manual";
    }
  | {
      ok: false;
      error: string;
    };

function hashContent(content: unknown): string {
  return createHash("sha256").update(JSON.stringify(content ?? null)).digest("hex");
}

/**
 * Capture proof-of-acceptance and flip the quote into `accepted`.
 *
 * Runs for BOTH billing modes. For `manual` companies this also fires
 * the full post-accept side effects (deal → won, manual_invoice_generate
 * enqueue, activity_log entries). For `stripe` companies the follow-on
 * side effects (subscription create, settle email) run from
 * `payment_intent.succeeded` — this function only captures proof and
 * transitions the quote so the Payment Element can confirm next.
 *
 * Idempotent: if the quote is already `accepted`, returns `ok: true`
 * with the existing row so a double-click doesn't surface an error.
 */
export async function acceptQuote(
  input: AcceptQuoteInput,
  dbOverride?: DatabaseLike,
): Promise<AcceptQuoteResult> {
  const database = dbOverride ?? defaultDb;

  const quote = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, input.quote_id))
    .get();
  if (!quote) return { ok: false, error: "quote_not_found" };

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, quote.deal_id))
    .get();
  if (!deal) return { ok: false, error: "deal_not_found" };

  const company = await database
    .select()
    .from(companies)
    .where(eq(companies.id, quote.company_id))
    .get();
  if (!company) return { ok: false, error: "company_not_found" };

  const primaryContact = deal.primary_contact_id
    ? (await database
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) ?? null
    : null;

  const paymentMode: "stripe" | "manual" = company.billing_mode;

  // Already accepted — idempotent return.
  if (quote.status === "accepted") {
    return {
      ok: true,
      quote,
      deal,
      company,
      primaryContact,
      paymentMode,
    };
  }

  if (quote.status !== "sent" && quote.status !== "viewed") {
    return { ok: false, error: `quote_not_acceptable:${quote.status}` };
  }

  const now = Date.now();
  const legal = await getCurrentQuoteLegalVersions({ nowMs: now, db: database });

  // committed_until_date for retainer / mixed — derived at accept time.
  // For project structure (one-off only), no commitment window.
  let committed_until_ms: number | null = null;
  if (
    quote.term_length_months &&
    (quote.structure === "retainer" || quote.structure === "mixed")
  ) {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() + quote.term_length_months);
    committed_until_ms = d.getTime();
  }

  const patch: QuoteTransitionPatch = {
    accepted_at_ms: now,
    accepted_ip: input.ip,
    accepted_user_agent: input.userAgent,
    accepted_content_hash: hashContent(quote.content_json),
    committed_until_date_ms: committed_until_ms,
  };
  // Stamp the legal version IDs via a trailing UPDATE — not in the
  // transition patch because the patch type is tight to lifecycle cols.
  const updatedQuote = await transitionQuoteStatus(
    {
      quote_id: quote.id,
      from: quote.status,
      to: "accepted",
      patch,
    },
    database,
  );
  await database
    .update(quotes)
    .set({
      accepted_tos_version_id: legal.tos?.id ?? null,
      accepted_privacy_version_id: legal.privacy?.id ?? null,
    })
    .where(eq(quotes.id, quote.id));

  await logActivity({
    companyId: quote.company_id,
    dealId: quote.deal_id,
    contactId: primaryContact?.id ?? null,
    kind: "quote_accepted",
    body: `Client accepted quote ${quote.quote_number}.`,
    meta: {
      quote_id: quote.id,
      structure: quote.structure,
      total_cents_inc_gst: quote.total_cents_inc_gst,
      billing_mode: paymentMode,
      accepted_tos_version_id: legal.tos?.id ?? null,
      accepted_privacy_version_id: legal.privacy?.id ?? null,
    },
  });

  // Manual-billed: full side effects run inline (no Stripe handshake).
  if (paymentMode === "manual") {
    const won_outcome =
      quote.structure === "retainer"
        ? "retainer"
        : quote.structure === "mixed"
          ? "project" // mixed: stamp the one-off character; retainer tracking via subscription_state
          : "project";
    try {
      finaliseDealAsWon(
        deal.id,
        { won_outcome, value_cents: quote.total_cents_inc_gst },
        {
          by: "quote_accept",
          meta: { quote_id: quote.id, source: "quote_accept_manual" },
          nowMs: now,
        },
        database,
      );
    } catch (err) {
      // Deal may already be `won` from an earlier quote — log + continue.
      const message = err instanceof Error ? err.message : String(err);
      await logActivity({
        companyId: quote.company_id,
        dealId: quote.deal_id,
        kind: "note",
        body: `quote_accept: finaliseDealAsWon skipped — ${message}`,
        meta: { quote_id: quote.id, kind: "quote_accept_won_skipped" },
      });
    }

    // First manual invoice: 3-day pre-send review window.
    // Cycle 0 starts now; send at `now + quote.reminder_days? — not reused`.
    // Spec §3.2.7: first invoice anchor = today (retainer/mixed) or
    // today (project). Enqueue `manual_invoice_generate` at
    // `first_invoice_date - 3 days`. For v1 we take `first_invoice_date = now`
    // so generate runs immediately (run_at = now).
    await enqueueTask({
      task_type: "manual_invoice_generate",
      runAt: now,
      payload: {
        deal_id: deal.id,
        cycle_index: 0,
        cycle_start: now,
        cycle_end: committed_until_ms ?? now,
        send_at: now,
      },
      idempotencyKey: `manual_invoice_generate:${deal.id}:0`,
    });

    // Settle email — transactional, fire via quote_email_send handler.
    await enqueueManualSettleEmail({
      quote,
      company,
      primaryContact,
      database,
    });
  }

  // Re-read to return the post-update row (with legal version IDs).
  const refreshed =
    (await database
      .select()
      .from(quotes)
      .where(eq(quotes.id, quote.id))
      .get()) ?? updatedQuote;

  return {
    ok: true,
    quote: refreshed,
    deal,
    company,
    primaryContact,
    paymentMode,
  };
}

async function enqueueManualSettleEmail(args: {
  quote: QuoteRow;
  company: CompanyRow;
  primaryContact: ContactRow | null;
  database: DatabaseLike;
}) {
  const to = args.primaryContact?.email;
  if (!to) return;
  const subject = `Locked in — ${args.quote.quote_number}`;
  const quoteUrl = `https://superbadmedia.com.au/lite/quotes/${args.quote.token}`;
  const bodyHtml = `
    <p>Accepted. Thanks.</p>
    <p>First invoice lands shortly — I'll send it from the same address.</p>
    <p><a href="${quoteUrl}">Your quote (for your records)</a></p>
    <p>— Andy</p>
  `.trim();
  await enqueueTask({
    task_type: "quote_email_send",
    runAt: Date.now(),
    payload: {
      quote_id: args.quote.id,
      to,
      subject,
      bodyHtml,
      purpose: `quote-settle:${args.quote.id}`,
    },
    idempotencyKey: `quote_settle_email:${args.quote.id}`,
  });
}

export async function enqueueStripeSettleEmail(args: {
  quote: QuoteRow;
  company: CompanyRow;
  primaryContact: ContactRow | null;
}) {
  // Shared with payment_intent.succeeded handler so Stripe-billed quotes
  // also get a settle email.
  const to = args.primaryContact?.email;
  if (!to) return;
  const subject = `Payment received — ${args.quote.quote_number}`;
  const quoteUrl = `https://superbadmedia.com.au/lite/quotes/${args.quote.token}`;
  const bodyHtml = `
    <p>Payment received. Receipt is in Stripe's email — this is just the handshake from my side.</p>
    <p><a href="${quoteUrl}">Your quote (for your records)</a></p>
    <p>— Andy</p>
  `.trim();
  await enqueueTask({
    task_type: "quote_email_send",
    runAt: Date.now(),
    payload: {
      quote_id: args.quote.id,
      to,
      subject,
      bodyHtml,
      purpose: `quote-settle:${args.quote.id}`,
    },
    idempotencyKey: `quote_settle_email:${args.quote.id}`,
  });
}

// Suppress unused import warning — randomUUID retained for future use.
void randomUUID;
