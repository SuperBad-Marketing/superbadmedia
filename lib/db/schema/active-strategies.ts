import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";

export const ACTIVE_STRATEGY_STATUSES = [
  "pending_refresh_review",
  "live",
  "archived",
] as const;
export type ActiveStrategyStatus =
  (typeof ACTIVE_STRATEGY_STATUSES)[number];

export const ACTIVE_STRATEGY_ORIGINS = ["six_week_plan"] as const;
export type ActiveStrategyOrigin =
  (typeof ACTIVE_STRATEGY_ORIGINS)[number];

export const active_strategies = sqliteTable(
  "active_strategies",
  {
    id: text("id").primaryKey(),
    client_id: text("client_id")
      .notNull()
      .unique()
      .references(() => companies.id, { onDelete: "cascade" }),
    origin: text("origin", { enum: ACTIVE_STRATEGY_ORIGINS }).notNull(),
    source_id: text("source_id"),
    status: text("status", { enum: ACTIVE_STRATEGY_STATUSES })
      .notNull()
      .default("pending_refresh_review"),
    payload_json: text("payload_json", { mode: "json" }),
    pending_refresh_review: integer("pending_refresh_review", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
    reviewed_at_ms: integer("reviewed_at_ms"),
  },
  (t) => ({
    by_client: index("as_client_idx").on(t.client_id),
    by_status: index("as_status_idx").on(t.status),
  }),
);

export type ActiveStrategyRow = typeof active_strategies.$inferSelect;
export type ActiveStrategyInsert = typeof active_strategies.$inferInsert;
