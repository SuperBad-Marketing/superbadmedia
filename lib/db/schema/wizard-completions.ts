import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Ledger of completed wizards. Per setup-wizards.md §6.1, no uniqueness on
 * (user_id, wizard_key) — some wizards (e.g. graph-api-client) can be
 * completed repeatedly (one per connected mailbox).
 *
 * `contract_version` is a hash/version tag of the CompletionContract shape
 * at the time of completion. Older rows stay verifiable against the contract
 * they were written under even if the shape evolves.
 *
 * Owner: SW-1. Consumers: every wizard's onComplete, critical-flight
 * detection (SW-4), Observatory celebration summary (SW-3).
 */
export const wizard_completions = sqliteTable(
  "wizard_completions",
  {
    id: text("id").primaryKey(),
    wizard_key: text("wizard_key").notNull(),
    user_id: text("user_id").notNull(),
    audience: text("audience", { enum: ["admin", "client"] as const }).notNull(),
    completion_payload: text("completion_payload", { mode: "json" }).notNull(),
    contract_version: text("contract_version").notNull(),
    completed_at_ms: integer("completed_at_ms").notNull(),
  },
  (t) => ({
    by_user_wizard: index("wizard_completions_user_wizard_idx").on(
      t.user_id,
      t.wizard_key,
      t.completed_at_ms,
    ),
    by_wizard: index("wizard_completions_wizard_idx").on(
      t.wizard_key,
      t.completed_at_ms,
    ),
  }),
);

export type WizardCompletionRow = typeof wizard_completions.$inferSelect;
export type WizardCompletionInsert = typeof wizard_completions.$inferInsert;
