import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";

export const SYNDICATION_PLATFORMS = [
  "medium",
  "linkedin_articles",
  "ghost",
  "beehiiv",
  "wordpress",
] as const;
export type SyndicationPlatform = (typeof SYNDICATION_PLATFORMS)[number];

export const syndicationTargets = sqliteTable(
  "syndication_targets",
  {
    id: text("id").primaryKey(),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: SYNDICATION_PLATFORMS }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    credentials: text("credentials"),
    platform_config: text("platform_config", { mode: "json" }),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_company: index("syndication_targets_company_idx").on(t.company_id),
    unique_company_platform: index(
      "syndication_targets_company_platform_idx",
    ).on(t.company_id, t.platform),
  }),
);

export type SyndicationTargetRow = typeof syndicationTargets.$inferSelect;
export type SyndicationTargetInsert = typeof syndicationTargets.$inferInsert;
