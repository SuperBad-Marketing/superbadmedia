import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { contacts } from "./contacts";
import { user } from "./user";

export const TASK_KINDS = [
  "personal",
  "admin",
  "prospect_followup",
  "client_deliverable",
  "client_task",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "awaiting_approval",
  "delivered",
  "done",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["high", "normal", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_RECURRENCES = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;
export type TaskRecurrence = (typeof TASK_RECURRENCES)[number];

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body"),
    kind: text("kind", { enum: TASK_KINDS }).notNull(),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("todo"),
    priority: text("priority", { enum: TASK_PRIORITIES })
      .notNull()
      .default("normal"),
    due_at_ms: integer("due_at_ms"),

    entity_type: text("entity_type"),
    entity_id: text("entity_id"),

    checklist: text("checklist", { mode: "json" }),
    checklist_auto_complete: integer("checklist_auto_complete", {
      mode: "boolean",
    })
      .notNull()
      .default(true),

    recurrence: text("recurrence", { enum: TASK_RECURRENCES }),
    recurrence_day: integer("recurrence_day"),
    parent_recurrence_id: text("parent_recurrence_id"),

    source_braindump_id: text("source_braindump_id"),

    approval_requested_at_ms: integer("approval_requested_at_ms"),
    approval_viewed_at_ms: integer("approval_viewed_at_ms"),
    approved_at_ms: integer("approved_at_ms"),
    approved_by_contact_id: text("approved_by_contact_id").references(
      () => contacts.id,
      { onDelete: "set null" },
    ),
    rejected_at_ms: integer("rejected_at_ms"),
    rejection_feedback: text("rejection_feedback"),
    approval_token: text("approval_token"),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
    created_by: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    completed_at_ms: integer("completed_at_ms"),
  },
  (t) => ({
    by_status_due: index("tasks_status_due_idx").on(t.status, t.due_at_ms),
    by_entity: index("tasks_entity_idx").on(t.entity_type, t.entity_id),
    by_kind_status: index("tasks_kind_status_idx").on(t.kind, t.status),
    by_approval_token: index("tasks_approval_token_idx").on(t.approval_token),
    by_parent_recurrence: index("tasks_parent_recurrence_idx").on(
      t.parent_recurrence_id,
    ),
    by_source_braindump: index("tasks_source_braindump_idx").on(
      t.source_braindump_id,
    ),
  }),
);

export type TaskRow = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
