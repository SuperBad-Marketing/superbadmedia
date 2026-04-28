import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const BUSINESS_PROFILE_SECTION_KEYS = [
  "identity",
  "services",
  "audience",
  "positioning",
  "current_focus",
  "social_proof",
  "origin_story",
  "external_design_rules",
  "internal_design_rules",
  "voice_rules",
] as const;

export type BusinessProfileSectionKey =
  (typeof BUSINESS_PROFILE_SECTION_KEYS)[number];

export const business_profile_sections = sqliteTable(
  "business_profile_sections",
  {
    id: text("id").primaryKey(),
    section_key: text("section_key").notNull(),
    structured_data: text("structured_data", { mode: "json" }).notNull(),
    prose_summary: text("prose_summary"),
    prose_generated_at_ms: integer("prose_generated_at_ms"),
    prose_manually_edited: integer("prose_manually_edited", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    version: integer("version").notNull().default(1),
    is_current: integer("is_current", { mode: "boolean" })
      .notNull()
      .default(true),
    updated_by: text("updated_by", {
      enum: ["manual", "braindump", "automated_detection", "brand_dna_sync"],
    }).notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_section_current: index("bps_section_current_idx").on(
      t.section_key,
      t.is_current,
    ),
    by_section_version: index("bps_section_version_idx").on(
      t.section_key,
      t.version,
    ),
  }),
);

export type BusinessProfileSectionRow =
  typeof business_profile_sections.$inferSelect;
