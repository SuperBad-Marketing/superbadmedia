import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";

/**
 * Individual human, attached to a Company.
 * `stripe_customer_id` is the canonical Stripe identity — created lazily
 * on first payment via `ensureStripeCustomer(contactId)` (FOUNDATIONS
 * §11.7). `deals.stripe_customer_id` is a denormalised mirror.
 */
export const CONTACT_EMAIL_STATUSES = [
  "unknown",
  "valid",
  "soft_bounce",
  "invalid",
  "complained",
] as const;
export type ContactEmailStatus = (typeof CONTACT_EMAIL_STATUSES)[number];

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role"),
    email: text("email"),
    email_normalised: text("email_normalised"),
    email_status: text("email_status", { enum: CONTACT_EMAIL_STATUSES })
      .notNull()
      .default("unknown"),
    phone: text("phone"),
    phone_normalised: text("phone_normalised"),
    is_primary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    notes: text("notes"),
    stripe_customer_id: text("stripe_customer_id").unique(),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_company: index("contacts_company_idx").on(t.company_id),
    by_email_norm: index("contacts_email_norm_idx").on(t.email_normalised),
    by_phone_norm: index("contacts_phone_norm_idx").on(t.phone_normalised),
  }),
);

export type ContactRow = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;
