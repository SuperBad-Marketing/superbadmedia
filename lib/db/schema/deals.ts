import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { contacts } from "./contacts";

/**
 * Opportunity, attached to a Company and (optionally) a primary Contact.
 * Subscription-state columns (`subscription_state`,
 * `committed_until_date_ms`, `pause_used_this_commitment`,
 * `billing_cadence`, `stripe_subscription_id`, `stripe_customer_id`) are
 * owned here per BUILD_PLAN.md §Wave 5 SP-1. Quote Builder + SaaS
 * Subscription Billing are consumers.
 */
export const DEAL_STAGES = [
  "lead",
  "contacted",
  "conversation",
  "trial_shoot",
  "quoted",
  "negotiating",
  "won",
  "lost",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_WON_OUTCOMES = ["retainer", "saas", "project"] as const;
export type DealWonOutcome = (typeof DEAL_WON_OUTCOMES)[number];

export const DEAL_LOSS_REASONS = [
  "price",
  "timing",
  "went_with_someone_else",
  "not_a_fit",
  "ghosted",
  "internal_change",
  "other",
] as const;
export type DealLossReason = (typeof DEAL_LOSS_REASONS)[number];

export const DEAL_SUBSCRIPTION_STATES = [
  "active",
  "past_due",
  "paused",
  "pending_early_exit",
  "cancelled_paid_remainder",
  "cancelled_buyout",
  "cancelled_post_term",
  "ended_gracefully",
] as const;
export type DealSubscriptionState = (typeof DEAL_SUBSCRIPTION_STATES)[number];

export const DEAL_BILLING_CADENCES = [
  "monthly",
  "annual_monthly",
  "annual_upfront",
] as const;
export type DealBillingCadence = (typeof DEAL_BILLING_CADENCES)[number];

export const deals = sqliteTable(
  "deals",
  {
    id: text("id").primaryKey(),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    primary_contact_id: text("primary_contact_id").references(
      () => contacts.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull(),
    stage: text("stage", { enum: DEAL_STAGES }).notNull().default("lead"),
    value_cents: integer("value_cents"),
    value_estimated: integer("value_estimated", { mode: "boolean" })
      .notNull()
      .default(true),
    won_outcome: text("won_outcome", { enum: DEAL_WON_OUTCOMES }),
    loss_reason: text("loss_reason", { enum: DEAL_LOSS_REASONS }),
    loss_notes: text("loss_notes"),
    next_action_text: text("next_action_text"),
    next_action_overridden_at_ms: integer("next_action_overridden_at_ms"),
    snoozed_until_ms: integer("snoozed_until_ms"),
    last_stage_change_at_ms: integer("last_stage_change_at_ms").notNull(),
    source: text("source"),
    // Subscription columns (consumed by QB + SB; owned here).
    subscription_state: text("subscription_state", {
      enum: DEAL_SUBSCRIPTION_STATES,
    }),
    committed_until_date_ms: integer("committed_until_date_ms"),
    pause_used_this_commitment: integer("pause_used_this_commitment", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    billing_cadence: text("billing_cadence", { enum: DEAL_BILLING_CADENCES }),
    stripe_subscription_id: text("stripe_subscription_id"),
    stripe_customer_id: text("stripe_customer_id"),
    // SaaS linkage (SB-1) — null for retainer/project deals.
    saas_product_id: text("saas_product_id"),
    saas_tier_id: text("saas_tier_id"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_company: index("deals_company_idx").on(t.company_id),
    by_contact: index("deals_contact_idx").on(t.primary_contact_id),
    by_stage: index("deals_stage_idx").on(t.stage, t.last_stage_change_at_ms),
    by_stripe_sub: index("deals_stripe_subscription_idx").on(
      t.stripe_subscription_id,
    ),
  }),
);

export type DealRow = typeof deals.$inferSelect;
export type DealInsert = typeof deals.$inferInsert;
