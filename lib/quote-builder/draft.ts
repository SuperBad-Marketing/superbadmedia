import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import { quotes, type QuoteRow } from "@/lib/db/schema/quotes";
import settings from "@/lib/settings";
import { allocateQuoteNumber } from "./sequences";
import {
  computeTotals,
  emptyQuoteContent,
  inferStructure,
  type QuoteContent,
} from "./content-shape";

type DatabaseLike = typeof defaultDb;

/**
 * Draft-row lifecycle for QB-2. The editor (QB-2a) never touches `quotes`
 * directly — it goes through `createDraftQuote` / `updateDraftQuote`.
 *
 * Status guard: `updateDraftQuote` only accepts rows in `draft`. The
 * edit-after-send fork (§3.1.7) ships in QB-7 and will create a fresh
 * draft row pointing at the sent one via `supersedes_quote_id` — that
 * path does not mutate the sent row's content.
 */

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function findOpenDraftForDeal(
  dealId: string,
  dbOverride?: DatabaseLike,
): Promise<QuoteRow | null> {
  const database = dbOverride ?? defaultDb;
  const row = await database
    .select()
    .from(quotes)
    .where(and(eq(quotes.deal_id, dealId), eq(quotes.status, "draft")))
    .get();
  return row ?? null;
}

export type CreateDraftQuoteInput = {
  deal_id: string;
  company_id: string;
  user_id: string;
};

export async function createDraftQuote(
  input: CreateDraftQuoteInput,
  dbOverride?: DatabaseLike,
): Promise<QuoteRow> {
  const database = dbOverride ?? defaultDb;
  const existing = await findOpenDraftForDeal(input.deal_id, database);
  if (existing) return existing;

  const expiryDays = await settings.get("quote.default_expiry_days");
  const content = emptyQuoteContent(expiryDays);
  const totals = computeTotals(content);
  const structure = inferStructure(content);
  const quoteNumber = await allocateQuoteNumber({ db: database });
  const now = Date.now();

  const id = randomUUID();
  await database.insert(quotes).values({
    id,
    deal_id: input.deal_id,
    company_id: input.company_id,
    token: generateToken(),
    quote_number: quoteNumber,
    status: "draft",
    structure,
    content_json: content,
    catalogue_snapshot_json: null,
    total_cents_inc_gst: totals.total_cents_inc_gst,
    retainer_monthly_cents_inc_gst: totals.retainer_monthly_cents_inc_gst,
    one_off_cents_inc_gst: totals.one_off_cents_inc_gst,
    term_length_months: null,
    buyout_percentage: 50,
    created_at_ms: now,
    last_edited_by_user_id: input.user_id,
  });

  const row = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, id))
    .get();
  if (!row) throw new Error("createDraftQuote: insert returned no row");
  return row;
}

export class QuoteNotDraftError extends Error {
  constructor(
    public readonly quote_id: string,
    public readonly status: string,
  ) {
    super(`quote ${quote_id} is not a draft (status=${status})`);
    this.name = "QuoteNotDraftError";
  }
}

export type UpdateDraftQuoteInput = {
  quote_id: string;
  content: QuoteContent;
  user_id: string;
};

export async function updateDraftQuote(
  input: UpdateDraftQuoteInput,
  dbOverride?: DatabaseLike,
): Promise<QuoteRow> {
  const database = dbOverride ?? defaultDb;
  const existing = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, input.quote_id))
    .get();
  if (!existing) throw new Error(`quote ${input.quote_id} not found`);
  if (existing.status !== "draft") {
    throw new QuoteNotDraftError(input.quote_id, existing.status);
  }

  const totals = computeTotals(input.content);
  const structure = inferStructure(input.content);

  await database
    .update(quotes)
    .set({
      content_json: input.content,
      structure,
      total_cents_inc_gst: totals.total_cents_inc_gst,
      retainer_monthly_cents_inc_gst: totals.retainer_monthly_cents_inc_gst,
      one_off_cents_inc_gst: totals.one_off_cents_inc_gst,
      term_length_months: input.content.term_length_months,
      last_edited_by_user_id: input.user_id,
    })
    .where(eq(quotes.id, input.quote_id));

  const row = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, input.quote_id))
    .get();
  if (!row) throw new Error("updateDraftQuote: read-back missing");
  return row;
}
