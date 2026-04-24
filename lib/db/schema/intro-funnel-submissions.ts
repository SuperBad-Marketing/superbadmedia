import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { deals } from "./deals";
import { contacts } from "./contacts";

export const FUNNEL_STATES = [
  "contact_submitted",
  "questionnaire_in_progress",
  "questionnaire_complete",
  "paid",
  "shoot_booked",
  "shoot_approaching",
  "shoot_morning_of",
  "shoot_completed_awaiting_deliverables",
  "deliverables_ready",
  "reflection_complete",
  "portal_dormant",
  "portal_archived_migrated",
] as const;
export type FunnelState = (typeof FUNNEL_STATES)[number];

export const FUNNEL_SHAPES = [
  "solo_founder",
  "founder_led_team",
  "multi_stakeholder_company",
] as const;
export type FunnelShape = (typeof FUNNEL_SHAPES)[number];

export const TRIAL_SHOOT_TIERS = ["session", "production"] as const;
export type TrialShootTier = (typeof TRIAL_SHOOT_TIERS)[number];

export const ABANDON_SEQUENCE_STATES = [
  "pending",
  "t_15m_sent",
  "t_24h_sent",
  "t_3d_sent",
  "demoted",
  "not_applicable",
] as const;
export type AbandonSequenceState = (typeof ABANDON_SEQUENCE_STATES)[number];

export const intro_funnel_submissions = sqliteTable(
  "intro_funnel_submissions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    deal_id: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    contact_id: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),

    submitted_name: text("submitted_name").notNull(),
    submitted_business_name: text("submitted_business_name").notNull(),
    submitted_email: text("submitted_email").notNull(),
    submitted_phone: text("submitted_phone").notNull(),
    sms_opt_in: integer("sms_opt_in", { mode: "boolean" })
      .notNull()
      .default(true),
    sms_consent_at_ms: integer("sms_consent_at_ms"),

    shape: text("shape", { enum: FUNNEL_SHAPES }).notNull(),

    selected_tier: text("selected_tier", { enum: TRIAL_SHOOT_TIERS })
      .notNull()
      .default("session"),
    submitted_website_url: text("submitted_website_url"),
    submitted_intent: text("submitted_intent"),

    funnel_state: text("funnel_state", { enum: FUNNEL_STATES })
      .notNull()
      .default("contact_submitted"),

    questionnaire_answers_json: text("questionnaire_answers_json", {
      mode: "json",
    }),
    questionnaire_sections_completed: integer(
      "questionnaire_sections_completed",
    )
      .notNull()
      .default(0),
    signal_tags_json: text("signal_tags_json", { mode: "json" }),

    abandon_sequence_state: text("abandon_sequence_state", {
      enum: ABANDON_SEQUENCE_STATES,
    })
      .notNull()
      .default("pending"),
    last_activity_at_ms: integer("last_activity_at_ms").notNull(),

    gallery_ready_at_ms: integer("gallery_ready_at_ms"),
    plan_ready_at_ms: integer("plan_ready_at_ms"),
    deliverables_ready_at_ms: integer("deliverables_ready_at_ms"),
    bundled_hub_seen_at_ms: integer("bundled_hub_seen_at_ms"),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_deal: index("ifs_deal_idx").on(t.deal_id),
    by_contact: index("ifs_contact_idx").on(t.contact_id),
    by_token: index("ifs_token_idx").on(t.token),
    by_state: index("ifs_state_idx").on(t.funnel_state),
  }),
);

export type IntroFunnelSubmissionRow =
  typeof intro_funnel_submissions.$inferSelect;
export type IntroFunnelSubmissionInsert =
  typeof intro_funnel_submissions.$inferInsert;
