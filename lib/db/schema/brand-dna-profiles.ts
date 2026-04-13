import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Brand DNA Assessment profile — full schema (BDA-1 extension of A8 stub).
 *
 * A8 shipped only the columns required by the First-Login Brand DNA Gate
 * middleware (FOUNDATIONS §11.8). BDA-1 extends the table in-place with the
 * full assessment output columns, invite-chain helpers, and multi-stakeholder
 * support.
 *
 * The A8 gate middleware queries `subject_type = 'superbad_self' AND status = 'complete'`.
 * Those columns are preserved and stable.
 *
 * Owner: BDA-1. Stub owner: A8.
 */

// ── Subject / status enums (A8 stable) ─────────────────────────────────────
export const BRAND_DNA_SUBJECT_TYPES = ["superbad_self", "client"] as const;
export type BrandDnaSubjectType = (typeof BRAND_DNA_SUBJECT_TYPES)[number];

export const BRAND_DNA_STATUSES = ["pending", "in_progress", "complete"] as const;
export type BrandDnaStatus = (typeof BRAND_DNA_STATUSES)[number];

// ── BDA-1 enums ─────────────────────────────────────────────────────────────
/** Alignment gate answer — routes the assessment to one of three tracks. */
export const BRAND_DNA_TRACKS = [
  "founder",
  "business",
  "founder_supplement",
] as const;
export type BrandDnaTrack = (typeof BRAND_DNA_TRACKS)[number];

/** Company shape snapshot at profile-generation time (spec §8.1). */
export const BRAND_DNA_SHAPES = [
  "solo_founder",
  "founder_led_team",
  "multi_stakeholder_company",
] as const;
export type BrandDnaShape = (typeof BRAND_DNA_SHAPES)[number];

export const brand_dna_profiles = sqliteTable(
  "brand_dna_profiles",
  {
    // ── A8 stable columns ─────────────────────────────────────────────────
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

    // ── BDA-1 extensions ──────────────────────────────────────────────────
    /** Human-readable name for the assessment subject. */
    subject_display_name: text("subject_display_name"),
    /** FK to contacts. Null for superbad_self profiles. */
    contact_id: text("contact_id"),
    /** FK to companies. */
    company_id: text("company_id"),
    /**
     * Auto-incremented per contact. Starts at 1. Enables retake versioning:
     * previous versions have is_current = 0.
     */
    version: integer("version").notNull().default(1),
    /** Only one current profile per contact. Previous versions archived. */
    is_current: integer("is_current", { mode: "boolean" }).notNull().default(true),
    /**
     * Convenience flag: true when subject_type = 'superbad_self'.
     * Allows efficient queries without the string comparison.
     */
    is_superbad_self: integer("is_superbad_self", { mode: "boolean" })
      .notNull()
      .default(false),
    /**
     * Alignment gate answer — routes to one of three assessment tracks.
     * Stored as the track enum value for downstream prompt injection.
     */
    track: text("track", { enum: BRAND_DNA_TRACKS }),
    /**
     * Historical shape snapshot at profile-generation time (spec §8.1).
     * Canonical source is companies.shape. If this disagrees at completion,
     * write activity_log.kind = 'shape_mismatch_flagged'.
     */
    shape: text("shape", { enum: BRAND_DNA_SHAPES }),
    /**
     * Set true by the company_shape_updated activity hook when shape changes
     * while is_current = true. Surfaces a "retake recommended" banner.
     */
    needs_regeneration: integer("needs_regeneration", { mode: "boolean" })
      .notNull()
      .default(false),
    /** Per-section tag frequency maps. JSON: { section_1: { tag: freq }, … } */
    section_scores: text("section_scores"),
    /** Aggregated domain → tag → frequency map across all sections. */
    signal_tags: text("signal_tags"),
    /** 500–800 word Opus-generated narrative portrait. */
    prose_portrait: text("prose_portrait"),
    /** 2–3 sentence Opus "first impression" reveal lead-in. */
    first_impression: text("first_impression"),
    /** Optional free-form reflection submitted before the reveal. */
    reflection_text: text("reflection_text"),
    /**
     * Array of 4 between-section Opus insights (one per sections 1–4).
     * JSON: string[]. Used for retake comparison.
     */
    section_insights: text("section_insights"),
    /**
     * True when Founder + Supplement track and supplement questions were
     * completed. Controls whether brand_override tags are present.
     */
    supplement_completed: integer("supplement_completed", { mode: "boolean" })
      .notNull()
      .default(false),
    /** Current section for save/resume (1–5, or 6 for supplement). */
    current_section: integer("current_section").notNull().default(1),
    /** UTC epoch ms when assessment reached status = 'complete'. */
    completed_at_ms: integer("completed_at_ms"),
  },
  (t) => ({
    by_subject: index("brand_dna_profiles_subject_idx").on(
      t.subject_type,
      t.subject_id,
    ),
    by_contact: index("brand_dna_profiles_contact_idx").on(
      t.contact_id,
      t.is_current,
    ),
  }),
);

export type BrandDnaProfileRow = typeof brand_dna_profiles.$inferSelect;
export type BrandDnaProfileInsert = typeof brand_dna_profiles.$inferInsert;
