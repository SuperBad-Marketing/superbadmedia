import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const braindumps = sqliteTable("braindumps", {
  id: text("id").primaryKey(),
  raw_text: text("raw_text").notNull(),
  surface_context: text("surface_context", { mode: "json" }),
  parsed_at_ms: integer("parsed_at_ms"),
  committed_at_ms: integer("committed_at_ms"),
  task_count: integer("task_count").notNull().default(0),
  created_by: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  created_at_ms: integer("created_at_ms").notNull(),
});

export type BraindumpRow = typeof braindumps.$inferSelect;
export type BraindumpInsert = typeof braindumps.$inferInsert;
