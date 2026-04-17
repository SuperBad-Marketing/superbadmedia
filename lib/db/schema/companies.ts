import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Top-level CRM entity. Canonical source for `shape` (§4.1A staleness
 * cascade — downstream consumers read this column first, falling back
 * to `intro_funnel_submissions.shape` only if null).
 */
export const COMPANY_SHAPES = [
  "solo_founder",
  "founder_led_team",
  "multi_stakeholder_company",
] as const;
export type CompanyShape = (typeof COMPANY_SHAPES)[number];

export const COMPANY_SIZE_BANDS = ["small", "medium", "large"] as const;
export type CompanySizeBand = (typeof COMPANY_SIZE_BANDS)[number];

export const COMPANY_BILLING_MODES = ["stripe", "manual"] as const;
export type CompanyBillingMode = (typeof COMPANY_BILLING_MODES)[number];

// ── Revenue Segmentation enums (OS-1) ────────────────────────────────────
export const REVENUE_RANGES = [
  "under_250k",
  "250k_500k",
  "500k_1m",
  "1m_3m",
  "3m_plus",
] as const;
export type RevenueRange = (typeof REVENUE_RANGES)[number];

export const TEAM_SIZES = [
  "solo",
  "2_5",
  "6_15",
  "16_50",
  "50_plus",
] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export const BIGGEST_CONSTRAINTS = [
  "not_enough_right_customers",
  "no_time_marketing",
  "dont_know_whats_working",
  "brand_doesnt_reflect",
  "burned_before",
  "growing_not_kept_up",
] as const;
export type BiggestConstraint = (typeof BIGGEST_CONSTRAINTS)[number];

export const TWELVE_MONTH_GOALS = [
  "steady",
  "grow",
  "scale",
  "launch_new",
  "figure_out",
] as const;
export type TwelveMonthGoal = (typeof TWELVE_MONTH_GOALS)[number];

export const INDUSTRY_VERTICALS = [
  "health_wellness",
  "professional_services",
  "trades_construction",
  "hospitality_food",
  "education",
  "retail",
  "creative_media",
  "other",
] as const;
export type IndustryVertical = (typeof INDUSTRY_VERTICALS)[number];

export const TRIAL_SHOOT_STATUSES = [
  "none",
  "booked",
  "planned",
  "in_progress",
  "completed_awaiting_feedback",
  "completed_feedback_provided",
] as const;
export type TrialShootStatus = (typeof TRIAL_SHOOT_STATUSES)[number];

export const companies = sqliteTable(
  "companies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    name_normalised: text("name_normalised").notNull(),
    domain: text("domain"),
    industry: text("industry"),
    size_band: text("size_band", { enum: COMPANY_SIZE_BANDS }),
    billing_mode: text("billing_mode", { enum: COMPANY_BILLING_MODES })
      .notNull()
      .default("stripe"),
    do_not_contact: integer("do_not_contact", { mode: "boolean" })
      .notNull()
      .default(false),
    notes: text("notes"),
    trial_shoot_status: text("trial_shoot_status", {
      enum: TRIAL_SHOOT_STATUSES,
    })
      .notNull()
      .default("none"),
    trial_shoot_completed_at_ms: integer("trial_shoot_completed_at_ms"),
    trial_shoot_plan: text("trial_shoot_plan"),
    trial_shoot_feedback: text("trial_shoot_feedback"),
    shape: text("shape", { enum: COMPANY_SHAPES }),
    // Invoicing — consumed by Quote Builder + Branded Invoicing (QB-1).
    gst_applicable: integer("gst_applicable", { mode: "boolean" })
      .notNull()
      .default(true),
    abn: text("abn"),
    // Branded Invoicing — default payment terms inherited by every invoice
    // issued to this company (spec Q4). BI-1.
    payment_terms_days: integer("payment_terms_days").notNull().default(14),
    // ── Revenue Segmentation (SaaS-only, nullable for retainer) — OS-1 ──
    revenue_range: text("revenue_range", { enum: REVENUE_RANGES }),
    team_size: text("team_size", { enum: TEAM_SIZES }),
    biggest_constraint: text("biggest_constraint", {
      enum: BIGGEST_CONSTRAINTS,
    }),
    twelve_month_goal: text("twelve_month_goal", {
      enum: TWELVE_MONTH_GOALS,
    }),
    industry_vertical: text("industry_vertical", {
      enum: INDUSTRY_VERTICALS,
    }),
    /** Free-text qualifier when industry_vertical = 'other'. */
    industry_vertical_other: text("industry_vertical_other"),
    /** Geography — captured at SaaS signup or from pipeline for retainer. */
    location: text("location"),
    /** When the customer finished Revenue Segmentation. */
    revenue_segmentation_completed_at_ms: integer(
      "revenue_segmentation_completed_at_ms",
    ),
    first_seen_at_ms: integer("first_seen_at_ms").notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_name_norm: index("companies_name_norm_idx").on(t.name_normalised),
    by_domain: index("companies_domain_idx").on(t.domain),
    by_billing_mode: index("companies_billing_mode_idx").on(t.billing_mode),
  }),
);

export type CompanyRow = typeof companies.$inferSelect;
export type CompanyInsert = typeof companies.$inferInsert;
