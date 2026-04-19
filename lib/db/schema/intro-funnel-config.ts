import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const intro_funnel_config = sqliteTable("intro_funnel_config", {
  id: text("id").primaryKey().default("singleton"),

  price_cents: integer("price_cents").notNull().default(29700),
  currency: text("currency").notNull().default("aud"),

  landing_hero_copy: text("landing_hero_copy"),
  landing_commitment_copy: text("landing_commitment_copy"),
  confirmation_email_subject: text("confirmation_email_subject"),
  confirmation_email_body: text("confirmation_email_body"),

  updated_at_ms: integer("updated_at_ms").notNull(),
});

export type IntroFunnelConfigRow = typeof intro_funnel_config.$inferSelect;
