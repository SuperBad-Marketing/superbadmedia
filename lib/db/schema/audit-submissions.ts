import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { contacts } from "./contacts";
import { deals } from "./deals";

export const auditSubmissions = sqliteTable(
  "audit_submissions",
  {
    id: text("id").primaryKey(),
    business_name: text("business_name").notNull(),
    website_url: text("website_url").notNull(),
    domain: text("domain").notNull(),
    contact_name: text("contact_name").notNull(),
    contact_email: text("contact_email").notNull(),
    instagram_handle: text("instagram_handle"),
    facebook_page_url: text("facebook_page_url"),
    youtube_channel: text("youtube_channel"),
    google_maps_url: text("google_maps_url"),

    viability_profile_json: text("viability_profile_json", {
      mode: "json",
    }).notNull(),

    overall_score: integer("overall_score").notNull(),
    overall_grade: text("overall_grade").notNull(),
    category_scores_json: text("category_scores_json", {
      mode: "json",
    }).notNull(),

    explanations_json: text("explanations_json", { mode: "json" }),

    pdf_generated_at: integer("pdf_generated_at", { mode: "timestamp_ms" }),
    pdf_emailed_at: integer("pdf_emailed_at", { mode: "timestamp_ms" }),

    deal_id: text("deal_id").references(() => deals.id),
    company_id: text("company_id").references(() => companies.id),
    contact_id: text("contact_id").references(() => contacts.id),
    followup_draft_id: text("followup_draft_id"),

    ip_hash: text("ip_hash").notNull(),

    retry_pending: integer("retry_pending", { mode: "boolean" })
      .notNull()
      .default(false),
    retry_signals_json: text("retry_signals_json", { mode: "json" }),

    created_at: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    by_domain: index("audit_submissions_domain_idx").on(
      t.domain,
      t.created_at,
    ),
    by_email: index("audit_submissions_email_idx").on(
      t.contact_email,
      t.created_at,
    ),
    by_company: index("audit_submissions_company_idx").on(t.company_id),
  }),
);

export type AuditSubmissionRow = typeof auditSubmissions.$inferSelect;
export type AuditSubmissionInsert = typeof auditSubmissions.$inferInsert;

export const auditRateLimits = sqliteTable("audit_rate_limits", {
  ip_hash: text("ip_hash").primaryKey(),
  submission_count: integer("submission_count").notNull().default(1),
  window_start: integer("window_start", { mode: "timestamp_ms" }).notNull(),
});

export type AuditRateLimitRow = typeof auditRateLimits.$inferSelect;
