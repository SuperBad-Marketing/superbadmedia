import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { candidates } from "./candidates";

export const DISPOSITION_DIRECTIONS = [
  "we_archived",
  "they_withdrew",
  "mutual",
] as const;
export type DispositionDirection = (typeof DISPOSITION_DIRECTIONS)[number];

export const candidate_archives = sqliteTable(
  "candidate_archives",
  {
    id: text("id").primaryKey(),
    candidate_id: text("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    archived_at_ms: integer("archived_at_ms").notNull(),
    stage_when_archived: text("stage_when_archived").notNull(),
    reason_code: text("reason_code").notNull(),
    reason_free_text: text("reason_free_text"),
    reflection_text: text("reflection_text"),
    disposition_direction: text("disposition_direction", {
      enum: DISPOSITION_DIRECTIONS,
    }).notNull(),
    un_archived_at_ms: integer("un_archived_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_candidate: index("candidate_archives_candidate_idx").on(
      t.candidate_id,
      t.archived_at_ms,
    ),
  }),
);

export type CandidateArchiveRow = typeof candidate_archives.$inferSelect;
export type CandidateArchiveInsert = typeof candidate_archives.$inferInsert;
