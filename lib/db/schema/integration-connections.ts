import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Shared primitive for every integration wizard's completion. Feature code
 * reads this table (not `wizard_completions`) to check whether a given
 * integration is available. Kill-switch flips `status='disabled-kill-switch'`
 * without destroying the credentials row.
 *
 * `credentials` is an encrypted blob written via `lib/crypto/vault.ts` (B2).
 * `metadata` holds vendor-specific non-secrets (account id, webhook id, etc.)
 * as plain JSON.
 *
 * `band_registration_hash` ties this row to the Observatory band registry
 * entries created by `registerIntegration()` (SW-3). `connected_via_wizard_completion_id`
 * is a soft reference to the `wizard_completions` row that produced it — not
 * FK-constrained because wizard_completions may be rewritten on retake; the
 * soft link keeps audit trails clean without cascading surprises.
 *
 * Owner: SW-1. Consumers: every feature that reads vendor connection state.
 */
export const integration_connections = sqliteTable(
  "integration_connections",
  {
    id: text("id").primaryKey(),
    vendor_key: text("vendor_key").notNull(),
    owner_type: text("owner_type", { enum: ["admin", "client"] as const }).notNull(),
    owner_id: text("owner_id").notNull(),
    credentials: text("credentials").notNull(),
    metadata: text("metadata", { mode: "json" }),
    connection_verified_at_ms: integer("connection_verified_at_ms").notNull(),
    band_registration_hash: text("band_registration_hash").notNull(),
    status: text("status", {
      enum: ["active", "revoked", "lapsed", "disabled-kill-switch"] as const,
    })
      .notNull()
      .default("active"),
    connected_via_wizard_completion_id: text("connected_via_wizard_completion_id"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_owner_vendor: index("integration_connections_owner_vendor_idx").on(
      t.owner_type,
      t.owner_id,
      t.vendor_key,
    ),
    by_vendor_status: index("integration_connections_vendor_status_idx").on(
      t.vendor_key,
      t.status,
    ),
  }),
);

export type IntegrationConnectionRow = typeof integration_connections.$inferSelect;
export type IntegrationConnectionInsert = typeof integration_connections.$inferInsert;
