import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { contacts } from "./contacts";
import { user } from "./user";

export const private_notes = sqliteTable(
  "private_notes",
  {
    id: text("id").primaryKey(),
    contact_id: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    created_by: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_contact: index("private_notes_contact_idx").on(
      t.contact_id,
      t.created_at_ms,
    ),
  }),
);

export type PrivateNoteRow = typeof private_notes.$inferSelect;
export type PrivateNoteInsert = typeof private_notes.$inferInsert;
