import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const BRAINDUMP_TYPES = ["general", "content", "todo", "ideas"] as const;
export type BraindumpType = (typeof BRAINDUMP_TYPES)[number];

export const braindumps = sqliteTable("braindumps", {
  id: text("id").primaryKey(),
  type: text("type", { enum: BRAINDUMP_TYPES }).notNull().default("general"),
  raw_text: text("raw_text").notNull(),
  surface_context: text("surface_context", { mode: "json" }),
  parsed_at_ms: integer("parsed_at_ms"),
  committed_at_ms: integer("committed_at_ms"),
  task_count: integer("task_count").notNull().default(0),
  content_count: integer("content_count").notNull().default(0),
  script_count: integer("script_count").notNull().default(0),
  blog_count: integer("blog_count").notNull().default(0),
  project_count: integer("project_count").notNull().default(0),
  mood_signal_json: text("mood_signal_json", { mode: "json" }),
  created_by: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  created_at_ms: integer("created_at_ms").notNull(),
});

export type BraindumpRow = typeof braindumps.$inferSelect;
export type BraindumpInsert = typeof braindumps.$inferInsert;
