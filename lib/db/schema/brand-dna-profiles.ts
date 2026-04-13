import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Brand DNA profile store — minimal stub for the A8 gate check.
 *
 * The full schema (questionnaire answers, profile JSON, version history) lands
 * in BDA-1 (Wave 3). A8 ships only the columns the Brand DNA Gate middleware
 * needs to compile and query:
 *   SELECT 1 FROM brand_dna_profiles
 *   WHERE subject_type = 'superbad_self' AND status = 'complete'
 *   LIMIT 1
 *
 * BDA-1 will ADD columns to this table without a breaking migration.
 *
 * Spec: FOUNDATIONS.md §11.8. Owner: A8 (stub), BDA-1 (full schema).
 */
export const BRAND_DNA_SUBJECT_TYPES = ["superbad_self", "client"] as const;
export type BrandDnaSubjectType = (typeof BRAND_DNA_SUBJECT_TYPES)[number];

export const BRAND_DNA_STATUSES = ["draft", "complete"] as const;
export type BrandDnaStatus = (typeof BRAND_DNA_STATUSES)[number];

export const brand_dna_profiles = sqliteTable(
  "brand_dna_profiles",
  {
    id: text("id").primaryKey(),
    /** 'superbad_self' — the perpetual SuperBad brand context (null subject_id).
     *  'client'        — a client's brand DNA (subject_id = contact_id). */
    subject_type: text("subject_type", {
      enum: BRAND_DNA_SUBJECT_TYPES,
    }).notNull(),
    /** Null for subject_type='superbad_self', contact_id for 'client' */
    subject_id: text("subject_id"),
    status: text("status", {
      enum: BRAND_DNA_STATUSES,
    })
      .notNull()
      .default("draft"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_subject: index("brand_dna_profiles_subject_idx").on(
      t.subject_type,
      t.status,
    ),
  }),
);

export type BrandDnaProfileRow = typeof brand_dna_profiles.$inferSelect;
export type BrandDnaProfileInsert = typeof brand_dna_profiles.$inferInsert;
