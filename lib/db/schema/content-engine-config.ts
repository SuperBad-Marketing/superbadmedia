import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";

/**
 * Content Engine — per-company config (CE-1). One row per owner (SuperBad
 * or subscriber company). Stores subscriber-specific settings: seed
 * keywords, newsletter send window, GSC OAuth token (encrypted via vault),
 * embeddable form token.
 *
 * `gsc_refresh_token` is encrypted at rest via `lib/crypto/vault.ts`.
 */
export const SEND_WINDOW_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type SendWindowDay = (typeof SEND_WINDOW_DAYS)[number];

export const contentEngineConfig = sqliteTable("content_engine_config", {
  id: text("id").primaryKey(),
  company_id: text("company_id")
    .notNull()
    .unique()
    .references(() => companies.id, { onDelete: "cascade" }),
  seed_keywords: text("seed_keywords", { mode: "json" }),
  send_window_day: text("send_window_day", { enum: SEND_WINDOW_DAYS })
    .notNull()
    .default("tuesday"),
  send_window_time: text("send_window_time").notNull().default("10:00"),
  send_window_tz: text("send_window_tz")
    .notNull()
    .default("Australia/Melbourne"),
  gsc_refresh_token: text("gsc_refresh_token"),
  gsc_property_url: text("gsc_property_url"),
  embed_form_token: text("embed_form_token").unique(),
  created_at_ms: integer("created_at_ms").notNull(),
  updated_at_ms: integer("updated_at_ms").notNull(),
});

export type ContentEngineConfigRow =
  typeof contentEngineConfig.$inferSelect;
export type ContentEngineConfigInsert =
  typeof contentEngineConfig.$inferInsert;
