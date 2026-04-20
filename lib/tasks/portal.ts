import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import type { TaskRow } from "@/lib/db/schema/tasks";
import { eq, and, inArray } from "drizzle-orm";
import type { PortalTask } from "./types";

function toPortalTask(row: TaskRow): PortalTask {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind as PortalTask["kind"],
    status: row.status as PortalTask["status"],
    priority: row.priority as PortalTask["priority"],
    due_at: row.due_at_ms ? new Date(row.due_at_ms).toISOString() : null,
    checklist: row.checklist as PortalTask["checklist"],
    approval_requested_at: row.approval_requested_at_ms
      ? new Date(row.approval_requested_at_ms).toISOString()
      : null,
    approved_at: row.approved_at_ms
      ? new Date(row.approved_at_ms).toISOString()
      : null,
    rejected_at: row.rejected_at_ms
      ? new Date(row.rejected_at_ms).toISOString()
      : null,
    rejection_feedback: row.rejection_feedback,
    created_at: new Date(row.created_at_ms).toISOString(),
    completed_at: row.completed_at_ms
      ? new Date(row.completed_at_ms).toISOString()
      : null,
  };
}

export async function getTasksForClientPortal(
  companyId: string,
  _options?: { kind?: Array<"client_deliverable" | "client_task"> },
): Promise<PortalTask[]> {
  const kinds = _options?.kind ?? ["client_deliverable", "client_task"];
  const rows = await db.query.tasks.findMany({
    where: and(
      inArray(tasks.kind, kinds),
      eq(tasks.entity_type, "client"),
      eq(tasks.entity_id, companyId),
    ),
    orderBy: [tasks.status, tasks.due_at_ms],
  });
  return rows.map(toPortalTask);
}
