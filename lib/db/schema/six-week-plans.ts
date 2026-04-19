import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { deals } from "./deals";
import { companies } from "./companies";
import { user } from "./user";

export const SIX_WEEK_PLAN_STATUSES = [
  "generating",
  "pending_strategy_review",
  "pending_detail_review",
  "approved",
  "superseded",
  "released",
  "archived",
] as const;
export type SixWeekPlanStatus = (typeof SIX_WEEK_PLAN_STATUSES)[number];

export const ACTIVATION_PATHS = ["self_run", "retainer_payment"] as const;
export type ActivationPath = (typeof ACTIVATION_PATHS)[number];

export const REVISION_RESOLUTIONS = [
  "regenerated",
  "explained",
  "hand_rejected",
] as const;
export type RevisionResolution = (typeof REVISION_RESOLUTIONS)[number];

export const six_week_plans = sqliteTable(
  "six_week_plans",
  {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    company_id: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: SIX_WEEK_PLAN_STATUSES })
      .notNull()
      .default("generating"),
    generation_version: integer("generation_version").notNull().default(1),
    parent_plan_id: text("parent_plan_id"),

    // Stage 1 output
    strategy_json: text("strategy_json", { mode: "json" }),
    strategy_generated_at_ms: integer("strategy_generated_at_ms"),
    strategy_approved_at_ms: integer("strategy_approved_at_ms"),

    // Stage 2 output
    weeks_json: text("weeks_json", { mode: "json" }),
    weeks_generated_at_ms: integer("weeks_generated_at_ms"),
    self_review_passed: integer("self_review_passed", { mode: "boolean" }),
    self_review_issues_json: text("self_review_issues_json", { mode: "json" }),

    // Andy review
    reviewed_by: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    approved_at_ms: integer("approved_at_ms"),
    regen_count: integer("regen_count").notNull().default(0),

    // Prospect activation (self-run path)
    released_at_ms: integer("released_at_ms"),
    activated_at_ms: integer("activated_at_ms"),
    activation_path: text("activation_path", { enum: ACTIVATION_PATHS }),

    // Revision
    revision_requested_at_ms: integer("revision_requested_at_ms"),
    revision_note: text("revision_note"),
    revision_resolution: text("revision_resolution", {
      enum: REVISION_RESOLUTIONS,
    }),
    revision_reply_sent_at_ms: integer("revision_reply_sent_at_ms"),
    revision_reply_body: text("revision_reply_body"),
    revision_reply_dismissed_at_ms: integer("revision_reply_dismissed_at_ms"),

    // Retainer migration
    migrated_to_client_context_at_ms: integer(
      "migrated_to_client_context_at_ms",
    ),
    refresh_reviewed_at_ms: integer("refresh_reviewed_at_ms"),
    retainer_payment_received_at_ms: integer(
      "retainer_payment_received_at_ms",
    ),

    // Non-converter expiry
    portal_expiry_email_sent_at_ms: integer("portal_expiry_email_sent_at_ms"),
    portal_archived_at_ms: integer("portal_archived_at_ms"),
    portal_extended_until_ms: integer("portal_extended_until_ms"),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_deal: index("swp_deal_idx").on(t.deal_id),
    by_company: index("swp_company_idx").on(t.company_id),
    by_status: index("swp_status_idx").on(t.status),
    by_parent: index("swp_parent_idx").on(t.parent_plan_id),
  }),
);

export type SixWeekPlanRow = typeof six_week_plans.$inferSelect;
export type SixWeekPlanInsert = typeof six_week_plans.$inferInsert;
