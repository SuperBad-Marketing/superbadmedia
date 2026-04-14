import { randomUUID, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import {
  invoices,
  type InvoiceInsert,
  type InvoiceLineItem,
  type InvoiceRow,
} from "@/lib/db/schema/invoices";
import { deals, type DealRow } from "@/lib/db/schema/deals";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { quotes, type QuoteRow } from "@/lib/db/schema/quotes";
import { allocateInvoiceNumber } from "@/lib/invoicing/sequences";
import { deriveInvoiceTotals, sumLineItems } from "@/lib/invoicing/totals";
import { logActivity } from "@/lib/activity-log";
import settings from "@/lib/settings";
import type { QuoteContent, QuoteLineItem } from "@/lib/quote-builder/content-shape";

type DatabaseLike = typeof defaultDb;

export type GenerateInvoiceInput = {
  deal_id: string;
  cycle_index?: number | null;
  cycle_start_ms?: number | null;
  cycle_end_ms?: number | null;
  source?: "auto" | "manual";
  nowMs?: number;
};

export type GenerateInvoiceResult =
  | { ok: true; invoice: InvoiceRow }
  | { ok: false; error: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Project a quote's `content_json` line items onto an invoice cycle.
 * Cycle 0 carries both retainer (one month) and one-off items (first-
 * cycle only). Subsequent cycles carry only retainer items.
 */
export function projectCycleLineItems(
  content: QuoteContent | null,
  cycle_index: number,
): InvoiceLineItem[] {
  if (!content) return [];
  const src: QuoteLineItem[] = content.sections?.whatWellDo?.line_items ?? [];
  return src
    .filter((li) => (cycle_index === 0 ? true : li.kind === "retainer"))
    .map((li) => ({
      description: li.snapshot.name,
      quantity: li.qty,
      unit_price_cents_inc_gst: li.unit_price_cents_inc_gst,
      line_total_cents_inc_gst: li.qty * li.unit_price_cents_inc_gst,
      is_recurring: li.kind === "retainer",
    }));
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function generateInvoice(
  input: GenerateInvoiceInput,
  dbOverride?: DatabaseLike,
): Promise<GenerateInvoiceResult> {
  const database = dbOverride ?? defaultDb;
  const now = input.nowMs ?? Date.now();
  const source = input.source ?? "auto";

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, input.deal_id))
    .get();
  if (!deal) return { ok: false, error: "deal_not_found" };

  const company = await database
    .select()
    .from(companies)
    .where(eq(companies.id, deal.company_id))
    .get();
  if (!company) return { ok: false, error: "company_not_found" };

  // Accepted quote for this deal (optional — manual invoices may pre-date a quote).
  const quoteRows: QuoteRow[] = await database
    .select()
    .from(quotes)
    .where(eq(quotes.deal_id, deal.id))
    .all();
  const acceptedQuote: QuoteRow | undefined =
    quoteRows.find((q) => q.status === "accepted") ??
    quoteRows.sort((a, b) => (b.created_at_ms ?? 0) - (a.created_at_ms ?? 0))[0];

  const cycle_index = input.cycle_index ?? null;
  const content = (acceptedQuote?.content_json ?? null) as QuoteContent | null;
  const line_items = projectCycleLineItems(content, cycle_index ?? 0);
  const total_cents_inc_gst = sumLineItems(line_items);

  const totals = deriveInvoiceTotals(total_cents_inc_gst, company.gst_applicable);

  const year = new Date(now).getUTCFullYear();
  const invoice_number = await allocateInvoiceNumber({ year, db: database });

  const due_at_ms = now + company.payment_terms_days * DAY_MS;

  const review_window_days = await settings.get("invoice.review_window_days");
  const auto_send_at_ms =
    source === "auto" ? now + review_window_days * DAY_MS : null;

  const row: InvoiceInsert = {
    id: randomUUID(),
    invoice_number,
    deal_id: deal.id,
    company_id: company.id,
    quote_id: acceptedQuote?.id ?? null,
    token: newToken(),
    status: "draft",
    cycle_index,
    cycle_start_ms: input.cycle_start_ms ?? null,
    cycle_end_ms: input.cycle_end_ms ?? null,
    issue_date_ms: now,
    due_at_ms,
    paid_at_ms: null,
    paid_via: null,
    stripe_payment_intent_id: null,
    total_cents_inc_gst: totals.total_cents_inc_gst,
    total_cents_ex_gst: totals.total_cents_ex_gst,
    gst_cents: totals.gst_cents,
    gst_applicable: company.gst_applicable,
    line_items_json: line_items as unknown as string,
    scope_summary: null,
    supersedes_invoice_id: null,
    thread_message_id: null,
    reminder_count: 0,
    last_reminder_at_ms: null,
    auto_send_at_ms,
    created_at_ms: now,
    updated_at_ms: now,
  };

  const inserted = await database.insert(invoices).values(row).returning();
  const invoice = inserted[0];

  await logActivity({
    companyId: company.id,
    dealId: deal.id,
    kind: "invoice_generated",
    body: `Invoice ${invoice_number} generated (${source}, cycle ${cycle_index ?? "manual"}).`,
    meta: {
      invoice_id: invoice.id,
      cycle_index,
      total_cents_inc_gst: totals.total_cents_inc_gst,
      source,
    },
    createdAtMs: now,
  });

  return { ok: true, invoice };
}

// Re-export for callers that want the row type handy.
export type { DealRow, CompanyRow };
