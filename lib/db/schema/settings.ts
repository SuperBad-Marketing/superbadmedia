import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Autonomy-threshold store. Every feature reads via `settings.get(key)`;
 * literals in autonomy-sensitive code are rejected by the ESLint rule.
 * Source of truth for seeded values: `docs/settings-registry.md`.
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  type: text("type", {
    enum: ["integer", "decimal", "string", "boolean", "json", "enum"],
  }).notNull(),
  description: text("description").notNull(),
  updated_at_ms: integer("updated_at_ms").notNull(),
});

export type SettingRow = typeof settings.$inferSelect;
