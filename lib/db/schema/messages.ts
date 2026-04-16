import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Unified Inbox producer-slice schema (threads + messages). Land here in
 * A6 because 4+ specs (Client Context, Portal Chat, Task Feedback, Lead
 * Gen replies) write to these tables before the full Unified Inbox UI
 * ships in Wave 9. See `docs/specs/unified-inbox.md` §5.1.
 *
 * `contact_id` / `company_id` are left un-FK-constrained because those
 * tables land in a later session; PATCHES_OWED row tracks the wiring.
 */
export const MESSAGE_CHANNELS = [
  "email",
  "portal_chat",
  "task_feedback",
  "outreach_reply",
  "newsletter_reply",
  "sms",
  "instagram_dm",
  "facebook_messenger",
  "whatsapp",
] as const;

export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const TICKET_STATUSES = [
  "open",
  "waiting_on_customer",
  "resolved",
] as const;

export const PRIORITY_CLASSES = ["signal", "noise", "spam"] as const;
export type PriorityClass = (typeof PRIORITY_CLASSES)[number];

export const NOTIFICATION_PRIORITIES = ["urgent", "push", "silent"] as const;
export const NOISE_SUBCLASSES = [
  "transactional",
  "marketing",
  "automated",
  "update",
  "other",
] as const;
export const ROUTER_CLASSIFICATIONS = [
  "match_existing",
  "new_lead",
  "non_client",
  "spam",
] as const;
export const IMPORT_SOURCES = [
  "live",
  "backfill_12mo",
  "backfill_on_demand",
] as const;

export const threads = sqliteTable(
  "threads",
  {
    id: text("id").primaryKey(),
    contact_id: text("contact_id"),
    company_id: text("company_id"),
    channel_of_origin: text("channel_of_origin", { enum: MESSAGE_CHANNELS }).notNull(),
    sending_address: text("sending_address"),
    subject: text("subject"),
    ticket_status: text("ticket_status", { enum: TICKET_STATUSES }),
    ticket_type: text("ticket_type"),
    priority_class: text("priority_class", { enum: PRIORITY_CLASSES })
      .notNull()
      .default("signal"),
    keep_until_ms: integer("keep_until_ms"),
    keep_pinned: integer("keep_pinned", { mode: "boolean" }).notNull().default(false),
    last_message_at_ms: integer("last_message_at_ms").notNull(),
    last_inbound_at_ms: integer("last_inbound_at_ms"),
    last_outbound_at_ms: integer("last_outbound_at_ms"),
    has_cached_draft: integer("has_cached_draft", { mode: "boolean" })
      .notNull()
      .default(false),
    cached_draft_body: text("cached_draft_body"),
    cached_draft_generated_at_ms: integer("cached_draft_generated_at_ms"),
    cached_draft_stale: integer("cached_draft_stale", { mode: "boolean" })
      .notNull()
      .default(false),
    snoozed_until_ms: integer("snoozed_until_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_contact: index("threads_contact_idx").on(t.contact_id, t.last_message_at_ms),
    by_company: index("threads_company_idx").on(t.company_id, t.last_message_at_ms),
    by_priority: index("threads_priority_idx").on(
      t.priority_class,
      t.last_message_at_ms,
    ),
  }),
);

export type ThreadRow = typeof threads.$inferSelect;
export type ThreadInsert = typeof threads.$inferInsert;

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    thread_id: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
    channel: text("channel", { enum: MESSAGE_CHANNELS }).notNull(),
    from_address: text("from_address").notNull(),
    to_addresses: text("to_addresses", { mode: "json" }).notNull(),
    cc_addresses: text("cc_addresses", { mode: "json" }),
    bcc_addresses: text("bcc_addresses", { mode: "json" }),
    subject: text("subject"),
    body_text: text("body_text").notNull(),
    body_html: text("body_html"),
    headers: text("headers", { mode: "json" }),
    message_id_header: text("message_id_header"),
    in_reply_to_header: text("in_reply_to_header"),
    references_header: text("references_header"),
    sent_at_ms: integer("sent_at_ms"),
    received_at_ms: integer("received_at_ms"),
    priority_class: text("priority_class", { enum: PRIORITY_CLASSES })
      .notNull()
      .default("signal"),
    noise_subclass: text("noise_subclass", { enum: NOISE_SUBCLASSES }),
    notification_priority: text("notification_priority", {
      enum: NOTIFICATION_PRIORITIES,
    }),
    router_classification: text("router_classification", {
      enum: ROUTER_CLASSIFICATIONS,
    }),
    router_reason: text("router_reason"),
    is_engaged: integer("is_engaged", { mode: "boolean" }).notNull().default(false),
    engagement_signals: text("engagement_signals", { mode: "json" }),
    import_source: text("import_source", { enum: IMPORT_SOURCES })
      .notNull()
      .default("live"),
    has_attachments: integer("has_attachments", { mode: "boolean" })
      .notNull()
      .default(false),
    has_calendar_invite: integer("has_calendar_invite", { mode: "boolean" })
      .notNull()
      .default(false),
    graph_message_id: text("graph_message_id"),
    keep_until_ms: integer("keep_until_ms"),
    deleted_at_ms: integer("deleted_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_thread: index("messages_thread_idx").on(t.thread_id, t.created_at_ms),
    by_message_id_header: index("messages_mid_header_idx").on(t.message_id_header),
    by_in_reply_to: index("messages_in_reply_to_idx").on(t.in_reply_to_header),
    by_keep_until: index("messages_keep_until_idx").on(
      t.keep_until_ms,
      t.deleted_at_ms,
    ),
    by_deleted_at: index("messages_deleted_at_idx").on(t.deleted_at_ms),
  }),
);

export type MessageRow = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;
