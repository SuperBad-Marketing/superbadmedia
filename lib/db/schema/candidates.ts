import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { role_briefs, RATE_UNITS } from "./role-briefs";

export const CANDIDATE_STAGES = [
  "sourced",
  "invited",
  "applied",
  "screened",
  "trial",
  "bench",
  "archived",
] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

export const HIRING_CANDIDATE_SOURCES = [
  "auto_discovered",
  "applied",
  "sourced",
  "referred",
] as const;
export type HiringCandidateSource =
  (typeof HIRING_CANDIDATE_SOURCES)[number];

export const CANDIDATE_ENGAGEMENT_TYPES = [
  "contractor",
  "employee",
] as const;
export type CandidateEngagementType =
  (typeof CANDIDATE_ENGAGEMENT_TYPES)[number];

export const CANDIDATE_BENCH_STATUSES = ["active", "paused"] as const;
export type CandidateBenchStatus =
  (typeof CANDIDATE_BENCH_STATUSES)[number];

export const CANDIDATE_FOLLOWUP_STATUSES = [
  "pending",
  "replied",
  "no_reply",
] as const;
export type CandidateFollowupStatus =
  (typeof CANDIDATE_FOLLOWUP_STATUSES)[number];

export const candidates = sqliteTable(
  "candidates",
  {
    id: text("id").primaryKey(),
    role_brief_id: text("role_brief_id").references(() => role_briefs.id),
    stage: text("stage", { enum: CANDIDATE_STAGES }).notNull(),
    stage_before_archive: text("stage_before_archive", {
      enum: CANDIDATE_STAGES,
    }),
    source: text("source", { enum: HIRING_CANDIDATE_SOURCES }).notNull(),
    discovery_source: text("discovery_source"),
    engagement_type: text("engagement_type", {
      enum: CANDIDATE_ENGAGEMENT_TYPES,
    })
      .notNull()
      .default("contractor"),

    name: text("name").notNull(),
    email: text("email"),
    location_city: text("location_city"),
    portfolio_urls_json: text("portfolio_urls_json", { mode: "json" }),
    rate_expectation_aud: integer("rate_expectation_aud"),
    rate_expectation_unit: text("rate_expectation_unit", {
      enum: RATE_UNITS,
    }),
    availability_hours_per_week: integer("availability_hours_per_week"),
    available_from_ms: integer("available_from_ms"),
    application_followup_question: text("application_followup_question"),
    application_followup_reply: text("application_followup_reply"),
    followup_status: text("followup_status", {
      enum: CANDIDATE_FOLLOWUP_STATUSES,
    }),

    portfolio_signal_json: text("portfolio_signal_json", { mode: "json" }),
    portfolio_signal_fetched_at_ms: integer("portfolio_signal_fetched_at_ms"),
    brief_match_score: real("brief_match_score"),

    bench_status: text("bench_status", { enum: CANDIDATE_BENCH_STATUSES }),
    paused_until_ms: integer("paused_until_ms"),
    hourly_rate_aud: integer("hourly_rate_aud"),
    weekly_capacity_hours: integer("weekly_capacity_hours"),
    onboarding_completed_at_ms: integer("onboarding_completed_at_ms"),

    abn: text("abn"),
    legal_name: text("legal_name"),
    agreement_signed_at_ms: integer("agreement_signed_at_ms"),
    bank_details: text("bank_details"),

    archived_at_ms: integer("archived_at_ms"),
    first_seen_at_ms: integer("first_seen_at_ms").notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_role_brief: index("candidates_role_brief_idx").on(t.role_brief_id),
    by_stage: index("candidates_stage_idx").on(t.stage, t.updated_at_ms),
    by_email: index("candidates_email_idx").on(t.email),
    by_bench: index("candidates_bench_idx").on(
      t.bench_status,
      t.paused_until_ms,
    ),
  }),
);

export type CandidateRow = typeof candidates.$inferSelect;
export type CandidateInsert = typeof candidates.$inferInsert;
