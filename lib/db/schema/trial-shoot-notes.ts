import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { deals } from "./deals";
import { user } from "./user";

export const INFRA_EMAIL_LIST_VALUES = [
  "none",
  "exists_small",
  "exists_moderate",
  "exists_large",
] as const;
export type InfraEmailListValue = (typeof INFRA_EMAIL_LIST_VALUES)[number];

export const INFRA_AD_EXPERIENCE_VALUES = [
  "none",
  "tried_and_stopped",
  "currently_running_low",
  "currently_running_substantial",
] as const;
export type InfraAdExperienceValue =
  (typeof INFRA_AD_EXPERIENCE_VALUES)[number];

export const INFRA_LEAD_MAGNET_VALUES = ["none", "one", "multiple"] as const;
export type InfraLeadMagnetValue = (typeof INFRA_LEAD_MAGNET_VALUES)[number];

export const INFRA_WEBSITE_STATUS_VALUES = [
  "none",
  "diy_builder",
  "custom",
  "pro_built",
] as const;
export type InfraWebsiteStatusValue =
  (typeof INFRA_WEBSITE_STATUS_VALUES)[number];

export const INFRA_SOCIAL_CADENCE_VALUES = [
  "none",
  "sporadic",
  "weekly",
  "multi_weekly",
] as const;
export type InfraSocialCadenceValue =
  (typeof INFRA_SOCIAL_CADENCE_VALUES)[number];

export const trial_shoot_notes = sqliteTable(
  "trial_shoot_notes",
  {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
      .notNull()
      .unique()
      .references(() => deals.id, { onDelete: "cascade" }),

    // Marketing Infrastructure (6 fields — enrichment-prefilled)
    infra_email_list: text("infra_email_list", {
      enum: INFRA_EMAIL_LIST_VALUES,
    }),
    infra_email_list_note: text("infra_email_list_note"),
    infra_ad_experience: text("infra_ad_experience", {
      enum: INFRA_AD_EXPERIENCE_VALUES,
    }),
    infra_ad_experience_note: text("infra_ad_experience_note"),
    infra_lead_magnet: text("infra_lead_magnet", {
      enum: INFRA_LEAD_MAGNET_VALUES,
    }),
    infra_lead_magnet_note: text("infra_lead_magnet_note"),
    infra_website_status: text("infra_website_status", {
      enum: INFRA_WEBSITE_STATUS_VALUES,
    }),
    infra_website_cms: text("infra_website_cms"),
    infra_social_cadence: text("infra_social_cadence", {
      enum: INFRA_SOCIAL_CADENCE_VALUES,
    }),
    infra_social_primary_platform: text("infra_social_primary_platform"),
    infra_competitors: text("infra_competitors"),

    // Goals (ordered 1–3)
    goals_json: text("goals_json", { mode: "json" }),

    // Shoot-Day Signals (4 × 1–5 scale)
    signal_energy: integer("signal_energy"),
    signal_fluency: integer("signal_fluency"),
    signal_icp_clarity: integer("signal_icp_clarity"),
    signal_conversion_ready: integer("signal_conversion_ready"),

    // Observations
    observations: text("observations"),

    // Enrichment audit trail
    enrichment_prefill_json: text("enrichment_prefill_json", { mode: "json" }),

    filled_at_ms: integer("filled_at_ms"),
    filled_by: text("filled_by").references(() => user.id, {
      onDelete: "set null",
    }),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_deal: index("tsn_deal_idx").on(t.deal_id),
  }),
);

export type TrialShootNotesRow = typeof trial_shoot_notes.$inferSelect;
export type TrialShootNotesInsert = typeof trial_shoot_notes.$inferInsert;
