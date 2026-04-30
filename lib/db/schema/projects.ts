import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const PROJECT_STATUSES = [
  "idea",
  "planning",
  "active",
  "paused",
  "completed",
  "archived",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    brain_dump: text("brain_dump").notNull(),
    status: text("status", { enum: PROJECT_STATUSES })
      .notNull()
      .default("idea"),
    breakdown_json: text("breakdown_json", { mode: "json" }),
    breakdown_generated_at_ms: integer("breakdown_generated_at_ms"),
    draft_tasks_json: text("draft_tasks_json", { mode: "json" }),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
    created_by: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => ({
    by_status: index("projects_status_idx").on(t.status),
    by_created: index("projects_created_idx").on(t.created_at_ms),
  }),
);

export type ProjectRow = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;

export interface ProjectBreakdown {
  summary: string;
  goals: string[];
  phases: {
    name: string;
    description: string;
    tasks: string[];
  }[];
  risks: string[];
  estimated_effort: string;
}

export interface DraftTask {
  temp_id: string;
  title: string;
  body: string | null;
  priority: "high" | "normal" | "low";
  phase: string;
  approved: boolean;
}
