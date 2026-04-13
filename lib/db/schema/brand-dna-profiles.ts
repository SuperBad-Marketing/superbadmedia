import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Minimal stub for the Brand DNA Assessment profile. A8 ships only the
 * columns required by the First-Login Brand DNA Gate middleware
 * (FOUNDATIONS §11.8) — specifically the
 * `subject_type = 'superbad_self' AND status = 'complete'` query.
 *
 * The full schema (assessment sections, signal tags, voice scores,
 * generated artefacts) lands in BDA-1 (Wave 3). BDA-1 is expected to
 * extend this table in-place; the two columns below are stable and will
 * not be renamed or removed.
 *
 * Ownership note (FOUNDATIONS §11.8 / Phase 4 PATCHES_OWED F2.b):
 *   The gate middleware (middleware.ts) reads this table. Until BDA-3
 *   ships and completes the SuperBad-self profile, the gate will always
 *   redirect to /lite/onboarding. Set BRAND_DNA_GATE_BYPASS=true in
 *   .env.local during development to skip the redirect.
 *
 * Owner: A8 (stub). Full schema owner: BDA-1.
 */
export const BRAND_DNA_SUBJECT_TYPES = ["superbad_self", "client"] as const;
export type BrandDnaSubjectType = (typeof BRAND_DNA_SUBJECT_TYPES)[number];

export const BRAND_DNA_STATUSES = ["pending", "in_progress", "complete"] as const;
export type BrandDnaStatus = (typeof BRAND_DNA_STATUSES)[number];

export const brand_dna_profiles = sqliteTable(
  "brand_dna_profiles",
  {
    id: text("id").primaryKey(),
    /** 'superbad_self' — the one profile the gate cares about. */
    subject_type: text("subject_type", {
      enum: BRAND_DNA_SUBJECT_TYPES,
    }).notNull(),
    /** null for superbad_self; client row id for client-type profiles. */
    subject_id: text("subject_id"),
    status: text("status", { enum: BRAND_DNA_STATUSES })
      .notNull()
      .default("pending"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_subject: index("brand_dna_profiles_subject_idx").on(
      t.subject_type,
      t.subject_id,
    ),
  }),
);

export type BrandDnaProfileRow = typeof brand_dna_profiles.$inferSelect;
export type BrandDnaProfileInsert = typeof brand_dna_profiles.$inferInsert;
