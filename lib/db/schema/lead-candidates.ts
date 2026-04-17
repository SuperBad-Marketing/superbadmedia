import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";

/**
 * Lead Generation candidate — a prospect sourced by the daily run, living
 * here until promotion to a Deal at first-send time via
 * `createDealFromLead()`. Append-only for audit trail purposes (rows are
 * never deleted, only promoted or skipped).
 *
 * Owner: Lead Generation spec §4.1 + §16.6 (reactive scoring columns).
 * Consumers: CE-13 outreach-match, Daily Cockpit, Sales Pipeline.
 */

export const CANDIDATE_EMAIL_CONFIDENCES = [
  "verified",
  "inferred",
  "unknown",
] as const;
export type CandidateEmailConfidence =
  (typeof CANDIDATE_EMAIL_CONFIDENCES)[number];

export const CANDIDATE_SOURCES = [
  "meta_ad_library",
  "google_maps",
  "google_ads_transparency",
  "manual_brief",
  "manual_entry",
] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

export const CANDIDATE_TRACKS = ["saas", "retainer"] as const;
export type CandidateTrack = (typeof CANDIDATE_TRACKS)[number];

export const leadCandidates = sqliteTable(
  "lead_candidates",
  {
    id: text("id").primaryKey(),

    // Identity
    company_name: text("company_name").notNull(),
    domain: text("domain"),
    contact_email: text("contact_email"),
    contact_name: text("contact_name"),
    contact_role: text("contact_role"),
    email_confidence: text("email_confidence", {
      enum: CANDIDATE_EMAIL_CONFIDENCES,
    }),

    // Viability profile (structured JSON — spec §5)
    viability_profile_json: text("viability_profile_json", {
      mode: "json",
    }).notNull(),

    // Scoring
    saas_score: integer("saas_score").notNull(),
    retainer_score: integer("retainer_score").notNull(),
    qualified_track: text("qualified_track", {
      enum: CANDIDATE_TRACKS,
    }).notNull(),
    scoring_debug_json: text("scoring_debug_json", { mode: "json" }),
    soft_adjustment: integer("soft_adjustment").notNull().default(0),
    soft_adjustment_rationale: text("soft_adjustment_rationale"),

    // Run provenance
    lead_run_id: text("lead_run_id").notNull(),
    sourced_from: text("sourced_from", {
      enum: CANDIDATE_SOURCES,
    }).notNull(),

    // Draft state
    pending_draft_id: text("pending_draft_id"),

    // Transition state
    promoted_to_deal_id: text("promoted_to_deal_id"),
    promoted_at: integer("promoted_at", { mode: "timestamp_ms" }),
    skipped_at: integer("skipped_at", { mode: "timestamp_ms" }),
    skipped_reason: text("skipped_reason"),

    // ── Reactive scoring (§16.6) ──
    reactive_adjustment: integer("reactive_adjustment").notNull().default(0),
    reactive_adjustment_json: text("reactive_adjustment_json", {
      mode: "json",
    }),
    rescored_at: integer("rescored_at", { mode: "timestamp_ms" }),
    rescore_count: integer("rescore_count").notNull().default(0),
    below_floor_after_rescore: integer("below_floor_after_rescore", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    track_change_used: integer("track_change_used", { mode: "boolean" })
      .notNull()
      .default(false),
    previous_track: text("previous_track", { enum: CANDIDATE_TRACKS }),
    track_changed_at: integer("track_changed_at", { mode: "timestamp_ms" }),

    created_at: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    by_run: index("lead_candidates_run_idx").on(t.lead_run_id),
    by_track: index("lead_candidates_track_idx").on(
      t.qualified_track,
      t.created_at,
    ),
    by_domain: index("lead_candidates_domain_idx").on(t.domain),
    by_promoted: index("lead_candidates_promoted_idx").on(
      t.promoted_to_deal_id,
    ),
  }),
);

export type LeadCandidateRow = typeof leadCandidates.$inferSelect;
export type LeadCandidateInsert = typeof leadCandidates.$inferInsert;
