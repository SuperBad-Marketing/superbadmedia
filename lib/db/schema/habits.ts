import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const HABIT_CADENCES = [
  "daily",
  "weekdays",
  "3x_week",
  "2x_week",
  "custom",
] as const;
export type HabitCadence = (typeof HABIT_CADENCES)[number];

export const habits = sqliteTable(
  "habits",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    cadence: text("cadence", { enum: HABIT_CADENCES }).notNull().default("daily"),
    cadence_days: text("cadence_days"),
    sort_order: integer("sort_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_active_sort: index("habits_active_sort_idx").on(t.active, t.sort_order),
  }),
);

export const habit_completions = sqliteTable(
  "habit_completions",
  {
    id: text("id").primaryKey(),
    habit_id: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    completed_date: text("completed_date").notNull(),
    completed_at_ms: integer("completed_at_ms").notNull(),
  },
  (t) => ({
    unique_habit_date: uniqueIndex("habit_completions_habit_date_uniq").on(
      t.habit_id,
      t.completed_date,
    ),
    by_habit_date: index("habit_completions_by_date_idx").on(
      t.habit_id,
      t.completed_date,
    ),
  }),
);

export type HabitRow = typeof habits.$inferSelect;
export type HabitInsert = typeof habits.$inferInsert;
export type HabitCompletionRow = typeof habit_completions.$inferSelect;
