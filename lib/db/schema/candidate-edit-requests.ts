import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { candidates } from "./candidates";

export const CANDIDATE_EDIT_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type CandidateEditStatus = (typeof CANDIDATE_EDIT_STATUSES)[number];

export const candidate_edit_requests = sqliteTable(
  "candidate_edit_requests",
  {
    id: text("id").primaryKey(),
    candidate_id: text("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    field_name: text("field_name").notNull(),
    old_value: text("old_value"),
    new_value: text("new_value").notNull(),
    status: text("status", { enum: CANDIDATE_EDIT_STATUSES })
      .notNull()
      .default("pending"),
    created_at_ms: integer("created_at_ms").notNull(),
    reviewed_at_ms: integer("reviewed_at_ms"),
  },
  (t) => ({
    by_candidate: index("candidate_edit_requests_candidate_idx").on(
      t.candidate_id,
    ),
    by_status: index("candidate_edit_requests_status_idx").on(t.status),
  }),
);

export type CandidateEditRequestRow =
  typeof candidate_edit_requests.$inferSelect;
export type CandidateEditRequestInsert =
  typeof candidate_edit_requests.$inferInsert;
