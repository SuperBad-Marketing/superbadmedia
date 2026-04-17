import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./user";

/**
 * Do Not Contact lists — email and domain blocklists (spec §4.6).
 * Company-level DNC lives on `companies.do_not_contact`.
 *
 * Owner: Lead Generation spec §12.
 * Read path: `isBlockedFromOutreach()` in `lib/lead-gen/dnc.ts` is
 * the ONLY function that reads these tables (§12.J).
 */

export const DNC_EMAIL_SOURCES = [
  "unsubscribe_link",
  "manual",
  "csv_import",
  "complaint",
] as const;
export type DncEmailSource = (typeof DNC_EMAIL_SOURCES)[number];

export const dncEmails = sqliteTable(
  "dnc_emails",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    reason: text("reason"),
    source: text("source", { enum: DNC_EMAIL_SOURCES }).notNull(),
    added_at: integer("added_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    added_by: text("added_by").references(() => user.id),
  },
  (t) => ({
    by_email: index("dnc_emails_email_idx").on(t.email),
  }),
);

export type DncEmailRow = typeof dncEmails.$inferSelect;
export type DncEmailInsert = typeof dncEmails.$inferInsert;

export const dncDomains = sqliteTable(
  "dnc_domains",
  {
    id: text("id").primaryKey(),
    domain: text("domain").notNull().unique(),
    reason: text("reason"),
    added_at: integer("added_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    added_by: text("added_by")
      .notNull()
      .references(() => user.id),
  },
  (t) => ({
    by_domain: index("dnc_domains_domain_idx").on(t.domain),
  }),
);

export type DncDomainRow = typeof dncDomains.$inferSelect;
export type DncDomainInsert = typeof dncDomains.$inferInsert;
