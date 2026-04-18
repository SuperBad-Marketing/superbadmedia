import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { contacts } from "./contacts";

/**
 * AI bartender chat messages in the client portal.
 * Each row is one exchange: client message or assistant response.
 *
 * Owner: CM-1. Consumers: CM-5 (chat UI), CM-10 (admin Portal Chat tab).
 */
export const PORTAL_CHAT_ROLES = ["client", "assistant"] as const;
export type PortalChatRole = (typeof PORTAL_CHAT_ROLES)[number];

export const portal_chat_messages = sqliteTable(
  "portal_chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contact_id: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    role: text("role", { enum: PORTAL_CHAT_ROLES }).notNull(),
    content: text("content").notNull(),
    escalated_to_inbox: integer("escalated_to_inbox", { mode: "boolean" })
      .notNull()
      .default(false),
    tool_action: text("tool_action"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_contact: index("portal_chat_messages_contact_idx").on(
      t.contact_id,
      t.created_at_ms,
    ),
  }),
);

export type PortalChatMessageRow =
  typeof portal_chat_messages.$inferSelect;
export type PortalChatMessageInsert =
  typeof portal_chat_messages.$inferInsert;
