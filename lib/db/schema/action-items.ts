import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { contacts } from "./contacts";
import { messages } from "./messages";

export const ACTION_ITEM_OWNERS = ["you", "them"] as const;
export type ActionItemOwner = (typeof ACTION_ITEM_OWNERS)[number];

export const ACTION_ITEM_SOURCES = ["claude_extract", "manual"] as const;
export type ActionItemSource = (typeof ACTION_ITEM_SOURCES)[number];

export const ACTION_ITEM_STATUSES = ["open", "done", "dismissed"] as const;
export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

export const action_items = sqliteTable(
  "action_items",
  {
    id: text("id").primaryKey(),
    contact_id: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    owner: text("owner", { enum: ACTION_ITEM_OWNERS }).notNull(),
    due_date_ms: integer("due_date_ms"),
    source: text("source", { enum: ACTION_ITEM_SOURCES }).notNull(),
    source_message_id: text("source_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: ACTION_ITEM_STATUSES })
      .notNull()
      .default("open"),
    created_at_ms: integer("created_at_ms").notNull(),
    completed_at_ms: integer("completed_at_ms"),
  },
  (t) => ({
    by_contact_status: index("action_items_contact_status_idx").on(
      t.contact_id,
      t.status,
    ),
    by_owner_status: index("action_items_owner_status_idx").on(
      t.owner,
      t.status,
      t.due_date_ms,
    ),
  }),
);

export type ActionItemRow = typeof action_items.$inferSelect;
export type ActionItemInsert = typeof action_items.$inferInsert;
