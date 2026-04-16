import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Graph API sync state per mailbox connection. Credentials (tokens) live in
 * `integration_connections` via the vault; this table holds sync-specific
 * state that doesn't fit the generic integration model.
 *
 * One row per connected mailbox. For v1 that's Andy's single M365 tenant.
 *
 * Owner: UI-1. Consumer: lib/graph/ sync + subscription renewal.
 */
export const graph_api_state = sqliteTable(
  "graph_api_state",
  {
    id: text("id").primaryKey(),
    integration_connection_id: text("integration_connection_id").notNull(),
    user_id: text("user_id").notNull(),
    tenant_id: text("tenant_id").notNull(),
    client_id: text("client_id").notNull(),
    subscription_id: text("subscription_id"),
    subscription_expires_at_ms: integer("subscription_expires_at_ms"),
    last_delta_token: text("last_delta_token"),
    last_full_sync_at_ms: integer("last_full_sync_at_ms"),
    initial_import_status: text("initial_import_status", {
      enum: ["not_started", "in_progress", "complete", "failed"] as const,
    })
      .notNull()
      .default("not_started"),
    initial_import_progress_json: text("initial_import_progress_json", {
      mode: "json",
    }),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_user: index("graph_api_state_user_idx").on(t.user_id),
    by_integration: index("graph_api_state_integration_idx").on(
      t.integration_connection_id,
    ),
    by_subscription_expiry: index("graph_api_state_sub_expiry_idx").on(
      t.subscription_expires_at_ms,
    ),
  }),
);

export type GraphApiStateRow = typeof graph_api_state.$inferSelect;
export type GraphApiStateInsert = typeof graph_api_state.$inferInsert;
