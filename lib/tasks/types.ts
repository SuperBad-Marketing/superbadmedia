/**
 * Task type definitions — matches Task Manager spec schema.
 * Stub until TM-1 builds the `tasks` table + Drizzle schema.
 * Owner: TM-1. Consumer: CM-7b (portal deliverables).
 */

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

export type ChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
  checked_at: string | null;
};

export type PortalTask = {
  id: string;
  title: string;
  body: string | null;
  kind: TaskKind;
  status: TaskStatus;
  priority: "high" | "normal" | "low";
  due_at: string | null;
  checklist: ChecklistItem[] | null;
  approval_requested_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_feedback: string | null;
  created_at: string;
  completed_at: string | null;
};
