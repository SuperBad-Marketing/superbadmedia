import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Idempotency table for Stripe + Resend webhook processing. Per
 * sales-pipeline.md §12.1: every handler writes here **before**
 * processing. `id` is the provider's event id — PRIMARY KEY guarantees
 * we never process the same event twice.
 */
export const WEBHOOK_PROVIDERS = ["stripe", "resend"] as const;
export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number];

export const WEBHOOK_RESULTS = ["ok", "error", "skipped"] as const;
export type WebhookResult = (typeof WEBHOOK_RESULTS)[number];

export const webhook_events = sqliteTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider", { enum: WEBHOOK_PROVIDERS }).notNull(),
    event_type: text("event_type").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    processed_at_ms: integer("processed_at_ms").notNull(),
    result: text("result", { enum: WEBHOOK_RESULTS }).notNull(),
    error: text("error"),
  },
  (t) => ({
    by_provider_type: index("webhook_events_provider_type_idx").on(
      t.provider,
      t.event_type,
      t.processed_at_ms,
    ),
  }),
);

export type WebhookEventRow = typeof webhook_events.$inferSelect;
export type WebhookEventInsert = typeof webhook_events.$inferInsert;
