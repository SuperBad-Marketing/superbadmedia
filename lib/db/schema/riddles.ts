import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const riddles = sqliteTable(
  "riddles",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    salt: text("salt").notNull(),
    answer_hash: text("answer_hash").notNull(),
    public_reward_content: text("public_reward_content").notNull(),
    loggedin_reward_content: text("loggedin_reward_content").notNull(),
    common_wrong_answers: text("common_wrong_answers", { mode: "json" })
      .notNull()
      .default("[]"),
    catch_all_wrong_content: text("catch_all_wrong_content").notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
    retired_at_ms: integer("retired_at_ms"),
  },
  (t) => ({
    by_slug: index("riddles_slug_idx").on(t.slug),
  }),
);

export type RiddleRow = typeof riddles.$inferSelect;
export type RiddleInsert = typeof riddles.$inferInsert;

export const RIDDLE_OUTCOMES = [
  "correct",
  "common_wrong",
  "novel_wrong",
  "catch_all_wrong",
  "retired",
  "unknown_riddle",
] as const;

export type RiddleOutcome = (typeof RIDDLE_OUTCOMES)[number];

export const riddle_resolutions = sqliteTable(
  "riddle_resolutions",
  {
    id: text("id").primaryKey(),
    riddle_id: text("riddle_id")
      .notNull()
      .references(() => riddles.id, { onDelete: "cascade" }),
    actor_type: text("actor_type", {
      enum: ["public", "admin", "customer"],
    }).notNull(),
    user_id: text("user_id"),
    input_hash: text("input_hash").notNull(),
    resolved_at_ms: integer("resolved_at_ms").notNull(),
    outcome: text("outcome", { enum: RIDDLE_OUTCOMES }).notNull(),
  },
  (t) => ({
    by_riddle: index("rr_riddle_idx").on(t.riddle_id),
    by_user: index("rr_user_idx").on(t.user_id),
  }),
);

export type RiddleResolutionRow = typeof riddle_resolutions.$inferSelect;
export type RiddleResolutionInsert = typeof riddle_resolutions.$inferInsert;
