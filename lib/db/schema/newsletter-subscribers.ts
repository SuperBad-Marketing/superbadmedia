import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";

/**
 * Content Engine — newsletter subscriber list per owner (CE-1).
 * Multi-tenant: each company_id has its own isolated list. Consent
 * source tracked for Spam Act compliance. Automated hygiene: hard
 * bounces remove immediately, soft bounces 3x then remove, 90-day
 * inactive removed, unsubscribes permanent.
 */
export const NEWSLETTER_CONSENT_SOURCES = [
  "csv_import",
  "embed_form",
  "blog_cta",
  "outreach_reply",
  "permission_pass",
] as const;
export type NewsletterConsentSource =
  (typeof NEWSLETTER_CONSENT_SOURCES)[number];

export const NEWSLETTER_SUBSCRIBER_STATUSES = [
  "pending_confirmation",
  "active",
  "bounced",
  "unsubscribed",
  "inactive_removed",
] as const;
export type NewsletterSubscriberStatus =
  (typeof NEWSLETTER_SUBSCRIBER_STATUSES)[number];

export const newsletterSubscribers = sqliteTable(
  "newsletter_subscribers",
  {
    id: text("id").primaryKey(),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    consent_source: text("consent_source", {
      enum: NEWSLETTER_CONSENT_SOURCES,
    }).notNull(),
    consented_at_ms: integer("consented_at_ms").notNull(),
    status: text("status", { enum: NEWSLETTER_SUBSCRIBER_STATUSES })
      .notNull()
      .default("pending_confirmation"),
    bounce_count: integer("bounce_count").notNull().default(0),
    last_opened_at_ms: integer("last_opened_at_ms"),
    unsubscribed_at_ms: integer("unsubscribed_at_ms"),
    removed_at_ms: integer("removed_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_company_status: index("newsletter_subs_company_status_idx").on(
      t.company_id,
      t.status,
    ),
    by_email: index("newsletter_subs_email_idx").on(t.company_id, t.email),
  }),
);

export type NewsletterSubscriberRow =
  typeof newsletterSubscribers.$inferSelect;
export type NewsletterSubscriberInsert =
  typeof newsletterSubscribers.$inferInsert;
