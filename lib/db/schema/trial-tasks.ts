import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { candidates } from "./candidates";
import { role_briefs, RATE_UNITS } from "./role-briefs";

export const TRIAL_TASK_DISPOSITIONS = [
  "pending",
  "shipped",
  "archived",
  "redelivered",
] as const;
export type TrialTaskDisposition = (typeof TRIAL_TASK_DISPOSITIONS)[number];

export const trial_tasks = sqliteTable(
  "trial_tasks",
  {
    id: text("id").primaryKey(),
    candidate_id: text("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    role_brief_id: text("role_brief_id")
      .notNull()
      .references(() => role_briefs.id),
    internal_content_ref: text("internal_content_ref"),
    task_description: text("task_description").notNull(),
    budget_cap_aud: integer("budget_cap_aud").notNull(),
    rate_per_unit_aud: integer("rate_per_unit_aud").notNull(),
    rate_unit: text("rate_unit", { enum: RATE_UNITS }).notNull(),
    sent_at_ms: integer("sent_at_ms").notNull(),
    due_at_ms: integer("due_at_ms").notNull(),
    delivered_at_ms: integer("delivered_at_ms"),
    delivery_url_or_asset: text("delivery_url_or_asset"),
    andy_review_notes: text("andy_review_notes"),
    rating: integer("rating"),
    disposition: text("disposition", { enum: TRIAL_TASK_DISPOSITIONS })
      .notNull()
      .default("pending"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_candidate: index("trial_tasks_candidate_idx").on(t.candidate_id),
    by_role_brief: index("trial_tasks_role_brief_idx").on(t.role_brief_id),
    by_disposition: index("trial_tasks_disposition_idx").on(t.disposition),
  }),
);

export type TrialTaskRow = typeof trial_tasks.$inferSelect;
export type TrialTaskInsert = typeof trial_tasks.$inferInsert;
