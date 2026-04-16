import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./user";
import { threads } from "./messages";
import { contacts } from "./contacts";
import { companies } from "./companies";

/**
 * Outbound compose drafts — backs the "Save to drafts" action from spec
 * §4.4 (Compose-new actions row: "Send / Save to drafts / Discard"). Rows
 * exist only while Andy is mid-compose; on `Send` they are deleted, and
 * the authoritative outbound message lands in `messages` via
 * `sendViaGraph`. Distinct from `threads.cached_draft_*` which hold the
 * auto-generated reply drafts owned by UI-5.
 *
 * `thread_id` is nullable — Compose-new from scratch doesn't create a
 * thread until send time; replying-to-an-existing-thread populates it.
 * `contact_id` + `company_id` are resolved at compose time via
 * `resolveRecipientContact(email)` and populated when a match is found;
 * walk-in recipients (unknown email) leave them null. All three FKs use
 * `ON DELETE set null` rather than cascade so deleting a contact mid-draft
 * doesn't silently wipe Andy's half-written email.
 *
 * UI-6 implements explicit-Save-button persistence only; autosave on a
 * timer is deferred to a later compose-polish session (PATCHES_OWED).
 */
export const compose_drafts = sqliteTable(
  "compose_drafts",
  {
    id: text("id").primaryKey(),
    author_user_id: text("author_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    thread_id: text("thread_id").references(() => threads.id, {
      onDelete: "set null",
    }),
    contact_id: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    company_id: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    to_addresses: text("to_addresses", { mode: "json" }).$type<string[]>(),
    cc_addresses: text("cc_addresses", { mode: "json" }).$type<string[]>(),
    bcc_addresses: text("bcc_addresses", { mode: "json" }).$type<string[]>(),
    subject: text("subject"),
    body_text: text("body_text").notNull().default(""),
    sending_address: text("sending_address").notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_author: index("compose_drafts_author_idx").on(
      t.author_user_id,
      t.updated_at_ms,
    ),
    by_thread: index("compose_drafts_thread_idx").on(t.thread_id),
    by_contact: index("compose_drafts_contact_idx").on(t.contact_id),
  }),
);

export type ComposeDraftRow = typeof compose_drafts.$inferSelect;
export type ComposeDraftInsert = typeof compose_drafts.$inferInsert;
