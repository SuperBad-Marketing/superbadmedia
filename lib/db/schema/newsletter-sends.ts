import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";

/**
 * Content Engine — newsletter send record (CE-1). One email per send
 * window maximum. Hybrid format: single post → standalone rewrite,
 * multiple posts → editorial digest. `blog_post_ids` is a JSON array
 * of post IDs included in this send.
 */
export const NEWSLETTER_FORMATS = ["single", "digest"] as const;
export type NewsletterFormat = (typeof NEWSLETTER_FORMATS)[number];

export const newsletterSends = sqliteTable(
  "newsletter_sends",
  {
    id: text("id").primaryKey(),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    blog_post_ids: text("blog_post_ids", { mode: "json" }).notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    format: text("format", { enum: NEWSLETTER_FORMATS }).notNull(),
    scheduled_for_ms: integer("scheduled_for_ms"),
    sent_at_ms: integer("sent_at_ms"),
    recipient_count: integer("recipient_count"),
    open_count: integer("open_count").notNull().default(0),
    click_count: integer("click_count").notNull().default(0),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_company: index("newsletter_sends_company_idx").on(t.company_id),
    by_scheduled: index("newsletter_sends_scheduled_idx").on(
      t.scheduled_for_ms,
    ),
  }),
);

export type NewsletterSendRow = typeof newsletterSends.$inferSelect;
export type NewsletterSendInsert = typeof newsletterSends.$inferInsert;
