import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { deals } from "./deals";
import { user } from "./user";
import { contacts } from "./contacts";

export const PROPOSAL_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "withdrawn",
  "expired",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const proposals = sqliteTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    proposal_number: text("proposal_number").notNull(),

    company_id: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    deal_id: text("deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),
    primary_contact_id: text("primary_contact_id").references(
      () => contacts.id,
      { onDelete: "set null" },
    ),

    title: text("title").notNull(),
    subtitle: text("subtitle"),
    client_name: text("client_name").notNull(),

    sections_json: text("sections_json", { mode: "json" }).notNull(),

    status: text("status", { enum: PROPOSAL_STATUSES })
      .notNull()
      .default("draft"),

    created_by_user_id: text("created_by_user_id").references(() => user.id),
    last_edited_by_user_id: text("last_edited_by_user_id").references(
      () => user.id,
    ),

    pdf_cache_key: text("pdf_cache_key"),

    sent_at_ms: integer("sent_at_ms"),
    viewed_at_ms: integer("viewed_at_ms"),
    accepted_at_ms: integer("accepted_at_ms"),
    withdrawn_at_ms: integer("withdrawn_at_ms"),
    expires_at_ms: integer("expires_at_ms"),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("proposals_company_idx").on(table.company_id),
    index("proposals_deal_idx").on(table.deal_id),
    index("proposals_status_idx").on(table.status),
    index("proposals_token_idx").on(table.token),
  ],
);

export type ProposalRow = typeof proposals.$inferSelect;
export type ProposalInsert = typeof proposals.$inferInsert;
