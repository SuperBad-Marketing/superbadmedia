import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const RUNDOWN_STATUSES = [
  "entry_submitted",
  "assessment_started",
  "section_1_complete",
  "section_2_complete",
  "section_3_complete",
  "section_4_complete",
  "section_5_complete",
  "reveal_reached",
  "complete",
] as const;
export type RundownStatus = (typeof RUNDOWN_STATUSES)[number];

export const RUNDOWN_SOURCE_TYPES = ["public", "tokenised_outreach"] as const;
export type RundownSourceType = (typeof RUNDOWN_SOURCE_TYPES)[number];

export const rundownSessions = sqliteTable(
  "rundown_sessions",
  {
    id: text("id").primaryKey(),
    /** URL-safe token for public access to this session. */
    session_token: text("session_token").notNull().unique(),
    /** Resume token sent via email, distinct from session token. */
    resume_token: text("resume_token"),

    // ── Identity (captured at entry screen) ──
    name: text("name").notNull(),
    email: text("email").notNull(),
    email_normalised: text("email_normalised").notNull(),
    business_name: text("business_name").notNull(),
    website: text("website"),
    instagram_handle: text("instagram_handle"),

    /** Optional city/suburb — captured at entry form. */
    city: text("city"),
    /** Whether this lead is in Melbourne metro + Geelong service area. */
    is_melbourne_area: integer("is_melbourne_area", { mode: "boolean" }),

    // ── Linked records ──
    candidate_id: text("candidate_id"),
    profile_id: text("profile_id"),
    /** If this session originated from a tokenised outreach link. */
    outreach_candidate_id: text("outreach_candidate_id"),

    // ── State ──
    status: text("status", { enum: RUNDOWN_STATUSES })
      .notNull()
      .default("entry_submitted"),
    source_type: text("source_type", { enum: RUNDOWN_SOURCE_TYPES })
      .notNull()
      .default("public"),

    // ── Trial shoot CTA ──
    tier_preference: text("tier_preference"),
    cta_clicked_at_ms: integer("cta_clicked_at_ms"),
    booking_token: text("booking_token"),

    // ── Brand Pack ──
    pack_downloaded_at_ms: integer("pack_downloaded_at_ms"),

    // ── Follow-up ──
    followup_email_sent_at_ms: integer("followup_email_sent_at_ms"),
    /** Token for read-only reveal re-access. */
    reveal_access_token: text("reveal_access_token"),
    reveal_access_expires_at_ms: integer("reveal_access_expires_at_ms"),

    // ── Analytics milestone timestamps ──
    entry_submitted_at_ms: integer("entry_submitted_at_ms").notNull(),
    assessment_started_at_ms: integer("assessment_started_at_ms"),
    section_1_completed_at_ms: integer("section_1_completed_at_ms"),
    section_2_completed_at_ms: integer("section_2_completed_at_ms"),
    section_3_completed_at_ms: integer("section_3_completed_at_ms"),
    section_4_completed_at_ms: integer("section_4_completed_at_ms"),
    section_5_completed_at_ms: integer("section_5_completed_at_ms"),
    reveal_reached_at_ms: integer("reveal_reached_at_ms"),
    completed_at_ms: integer("completed_at_ms"),

    // ── UTM / referral tracking ──
    utm_source: text("utm_source"),
    utm_medium: text("utm_medium"),
    utm_campaign: text("utm_campaign"),
    referrer: text("referrer"),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_email: index("rundown_sessions_email_idx").on(t.email_normalised),
    by_candidate: index("rundown_sessions_candidate_idx").on(t.candidate_id),
    by_session_token: index("rundown_sessions_token_idx").on(t.session_token),
    by_status: index("rundown_sessions_status_idx").on(t.status, t.created_at_ms),
  }),
);

export type RundownSessionRow = typeof rundownSessions.$inferSelect;
export type RundownSessionInsert = typeof rundownSessions.$inferInsert;
