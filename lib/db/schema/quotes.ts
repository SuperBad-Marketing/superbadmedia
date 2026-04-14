import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { deals } from "./deals";
import { user } from "./user";

/**
 * Quote Builder — quote row. State machine enforced via
 * `lib/quote-builder/transitions.ts#transitionQuoteStatus()`; direct
 * mutation of `status` outside that helper is a bug. Snapshot rules
 * (`content_json`, `catalogue_snapshot_json`, `accepted_content_hash`)
 * per spec §5.1.
 *
 * Monetary columns are **GST-inclusive integer cents** throughout — the
 * canonical total the client sees is `total_cents_inc_gst`. GST
 * applicability is read from `companies.gst_applicable` at render time.
 */
export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "superseded",
  "withdrawn",
  "expired",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STRUCTURES = ["retainer", "project", "mixed"] as const;
export type QuoteStructure = (typeof QUOTE_STRUCTURES)[number];

export const quotes = sqliteTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    quote_number: text("quote_number").notNull().unique(),
    status: text("status", { enum: QUOTE_STATUSES })
      .notNull()
      .default("draft"),
    structure: text("structure", { enum: QUOTE_STRUCTURES }).notNull(),

    // content snapshot
    content_json: text("content_json", { mode: "json" }),
    catalogue_snapshot_json: text("catalogue_snapshot_json", { mode: "json" }),

    // pricing (inc-GST cents)
    total_cents_inc_gst: integer("total_cents_inc_gst").notNull(),
    retainer_monthly_cents_inc_gst: integer("retainer_monthly_cents_inc_gst"),
    one_off_cents_inc_gst: integer("one_off_cents_inc_gst"),

    // commitment
    term_length_months: integer("term_length_months"),
    committed_until_date_ms: integer("committed_until_date_ms"),
    buyout_percentage: integer("buyout_percentage").notNull().default(50),
    tier_rank: integer("tier_rank"),

    // lifecycle timestamps (ms)
    created_at_ms: integer("created_at_ms").notNull(),
    sent_at_ms: integer("sent_at_ms"),
    viewed_at_ms: integer("viewed_at_ms"),
    accepted_at_ms: integer("accepted_at_ms"),
    expires_at_ms: integer("expires_at_ms"),
    superseded_at_ms: integer("superseded_at_ms"),
    withdrawn_at_ms: integer("withdrawn_at_ms"),

    // supersede chain (self-ref; FK set via raw SQL in migration to avoid
    // Drizzle's forward-reference limitation)
    supersedes_quote_id: text("supersedes_quote_id"),
    superseded_by_quote_id: text("superseded_by_quote_id"),

    // proof of acceptance
    accepted_content_hash: text("accepted_content_hash"),
    accepted_ip: text("accepted_ip"),
    accepted_user_agent: text("accepted_user_agent"),

    // stripe
    stripe_payment_intent_id: text("stripe_payment_intent_id"),
    stripe_subscription_id: text("stripe_subscription_id"),

    // pdf
    pdf_cache_key: text("pdf_cache_key"),

    // email thread
    thread_message_id: text("thread_message_id"),

    // audit
    last_edited_by_user_id: text("last_edited_by_user_id").references(
      () => user.id,
      { onDelete: "set null" },
    ),
  },
  (t) => ({
    by_deal: index("quotes_deal_idx").on(t.deal_id),
    by_company: index("quotes_company_idx").on(t.company_id),
    by_status: index("quotes_status_idx").on(t.status),
    by_expires_at: index("quotes_expires_at_idx").on(t.expires_at_ms),
  }),
);

export type QuoteRow = typeof quotes.$inferSelect;
export type QuoteInsert = typeof quotes.$inferInsert;
