import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { six_week_plans } from "./six-week-plans";

export const six_week_plan_task_progress = sqliteTable(
  "six_week_plan_task_progress",
  {
    id: text("id").primaryKey(),
    plan_id: text("plan_id")
      .notNull()
      .references(() => six_week_plans.id, { onDelete: "cascade" }),
    week_number: integer("week_number").notNull(),
    task_index: integer("task_index").notNull(),
    completed_at_ms: integer("completed_at_ms"),
  },
  (t) => ({
    by_plan: index("swptp_plan_idx").on(t.plan_id),
    by_plan_week: index("swptp_plan_week_idx").on(t.plan_id, t.week_number),
  }),
);

export type SixWeekPlanTaskProgressRow =
  typeof six_week_plan_task_progress.$inferSelect;
export type SixWeekPlanTaskProgressInsert =
  typeof six_week_plan_task_progress.$inferInsert;
