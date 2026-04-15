import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { saas_tiers } from "./saas-tiers";
import { saas_usage_dimensions } from "./saas-usage-dimensions";

/**
 * Per-tier cap on a usage dimension. `limit_value = null` means
 * unlimited (top-tier power users per
 * `project_tier_limits_protect_margin`); finite values protect margin
 * at small/medium.
 */
export const saas_tier_limits = sqliteTable(
  "saas_tier_limits",
  {
    id: text("id").primaryKey(),
    tier_id: text("tier_id")
      .notNull()
      .references(() => saas_tiers.id, { onDelete: "cascade" }),
    dimension_id: text("dimension_id")
      .notNull()
      .references(() => saas_usage_dimensions.id, { onDelete: "cascade" }),
    limit_value: integer("limit_value"),
  },
  (t) => ({
    by_tier_dim: uniqueIndex("saas_tier_limits_tier_dim_idx").on(
      t.tier_id,
      t.dimension_id,
    ),
  }),
);

export type SaasTierLimitRow = typeof saas_tier_limits.$inferSelect;
export type SaasTierLimitInsert = typeof saas_tier_limits.$inferInsert;
