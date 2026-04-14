import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * In-flight wizard state. One row per (user, wizard_key) in-flight.
 * A partial unique index on (user_id, wizard_key) WHERE abandoned_at_ms IS NULL
 * enforces the "only one live attempt per user per wizard" rule from
 * setup-wizards.md §6.1. Abandoned rows remain for audit.
 *
 * Owner: SW-1. Consumers: SW-2 (step-type runtime), SW-3 (registration
 * contract), SW-4 (critical-flight detection), SW-6 (resume/expiry worker).
 *
 * `user_id` is not FK-constrained here — admin and client users both land
 * in `user`, but client portal sessions reference contacts, not users. The
 * admin-onboarding path uses `user.id`; client-facing wizards populate this
 * via the contact-owned session after magic-link auth resolves to a user row.
 */
export const wizard_progress = sqliteTable(
  "wizard_progress",
  {
    id: text("id").primaryKey(),
    wizard_key: text("wizard_key").notNull(),
    user_id: text("user_id").notNull(),
    audience: text("audience", { enum: ["admin", "client"] as const }).notNull(),
    current_step: integer("current_step").notNull().default(0),
    step_state: text("step_state", { mode: "json" }),
    started_at_ms: integer("started_at_ms").notNull(),
    last_active_at_ms: integer("last_active_at_ms").notNull(),
    abandoned_at_ms: integer("abandoned_at_ms"),
    expires_at_ms: integer("expires_at_ms").notNull(),
    resumed_count: integer("resumed_count").notNull().default(0),
  },
  (t) => ({
    by_user: index("wizard_progress_user_idx").on(t.user_id, t.last_active_at_ms),
    by_wizard: index("wizard_progress_wizard_idx").on(t.wizard_key, t.last_active_at_ms),
    unique_inflight: uniqueIndex("wizard_progress_live_unique_idx")
      .on(t.user_id, t.wizard_key)
      .where(sql`abandoned_at_ms IS NULL`),
  }),
);

export type WizardProgressRow = typeof wizard_progress.$inferSelect;
export type WizardProgressInsert = typeof wizard_progress.$inferInsert;
