import type { TaskKind, TaskStatus } from "@/lib/db/schema/tasks";

export {
  TASK_KINDS,
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_RECURRENCES,
  type TaskKind,
  type TaskStatus,
  type TaskPriority,
  type TaskRecurrence,
  type TaskRow,
} from "@/lib/db/schema/tasks";

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
