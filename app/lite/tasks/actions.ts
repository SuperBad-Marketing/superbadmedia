"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import {
  createTask,
  updateTask,
  deleteTask,
  deleteTasks,
  transitionTaskStatus,
  updateChecklist,
  markTaskDone,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/lib/tasks/queries";
import type { TaskStatus } from "@/lib/db/schema/tasks";
import type { ChecklistItem } from "@/lib/tasks/types";
import { logActivity } from "@/lib/activity-log";
import { issueApprovalToken } from "@/lib/tasks/approve";
import { getTaskById } from "@/lib/tasks/queries";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { instagram_content_plans } from "@/lib/db/schema/instagram";
import type { EnhancedContentPlanSlot } from "@/lib/db/schema/instagram-competitive";
import { like, or, eq, and } from "drizzle-orm";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function adminActorTag(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return `user:${session.user.id ?? "admin"}`;
}

export async function createTaskAction(
  input: Omit<CreateTaskInput, "created_by">,
): Promise<ActionResult<{ id: string }>> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };
  try {
    const task = await createTask({ ...input, created_by: by.replace("user:", "") });
    await logActivity({
      kind: "task_created",
      body: `Task created: ${task.title}`,
      meta: { task_id: task.id, kind: task.kind },
      createdBy: by,
    });
    revalidatePath("/lite/tasks");
    return { ok: true, data: { id: task.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create task.",
    };
  }
}

export async function updateTaskAction(
  id: string,
  input: UpdateTaskInput,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };
  try {
    await updateTask(id, input);
    await logActivity({
      kind: "task_updated",
      body: `Task updated`,
      meta: { task_id: id, fields: Object.keys(input) },
      createdBy: by,
    });
    revalidatePath("/lite/tasks");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update task.",
    };
  }
}

export async function transitionTaskAction(
  id: string,
  to: TaskStatus,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };
  try {
    if (to === "done" || to === "delivered") {
      await markTaskDone(id, to);
    } else {
      await transitionTaskStatus(id, to);
    }
    await logActivity({
      kind: "task_status_changed",
      body: `Task status → ${to}`,
      meta: { task_id: id, to },
      createdBy: by,
    });

    if (to === "done" || to === "delivered") {
      await syncTaskDoneToInstagramSlot(id);
      revalidatePath("/lite/content/instagram");
    }

    if (to === "awaiting_approval") {
      const task = await getTaskById(id);
      if (task?.entity_type === "client" && task.entity_id) {
        const primaryContact = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(
              eq(contacts.company_id, task.entity_id),
              eq(contacts.is_primary, true),
            ),
          )
          .limit(1);
        if (primaryContact[0]) {
          await issueApprovalToken(id, primaryContact[0].id);
        }
      }
    }

    revalidatePath("/lite/tasks");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Transition failed.",
    };
  }
}

export async function updateChecklistAction(
  id: string,
  checklist: ChecklistItem[],
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };
  try {
    const updated = await updateChecklist(id, checklist);
    if (updated.status === "done" || updated.status === "delivered") {
      await logActivity({
        kind: "task_checklist_auto_completed",
        body: `Checklist auto-completed → ${updated.status}`,
        meta: { task_id: id },
        createdBy: by,
      });
    }
    revalidatePath("/lite/tasks");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update checklist.",
    };
  }
}

export async function deleteTaskAction(
  id: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };
  try {
    await deleteTask(id);
    await logActivity({
      kind: "task_deleted",
      body: "Task deleted",
      meta: { task_id: id },
      createdBy: by,
    });
    revalidatePath("/lite/tasks");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete task.",
    };
  }
}

export async function bulkDeleteTasksAction(
  ids: string[],
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };
  if (ids.length === 0) return { ok: true, data: undefined };
  try {
    await deleteTasks(ids);
    await logActivity({
      kind: "task_bulk_deleted",
      body: `${ids.length} task${ids.length === 1 ? "" : "s"} deleted`,
      meta: { task_ids: ids },
      createdBy: by,
    });
    revalidatePath("/lite/tasks");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete tasks.",
    };
  }
}

export async function searchEntitiesAction(
  query: string,
): Promise<{ contacts: { id: string; name: string; company_id: string | null }[]; companies: { id: string; name: string }[] }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { contacts: [], companies: [] };
  }
  const term = `%${query}%`;
  const [contactRows, companyRows] = await Promise.all([
    db
      .select({ id: contacts.id, name: contacts.name, company_id: contacts.company_id })
      .from(contacts)
      .where(like(contacts.name, term))
      .limit(10),
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(like(companies.name, term))
      .limit(10),
  ]);
  return { contacts: contactRows, companies: companyRows };
}

async function syncTaskDoneToInstagramSlot(taskId: string): Promise<void> {
  const allPlans = await db
    .select()
    .from(instagram_content_plans)
    .all();

  for (const plan of allPlans) {
    const slots = plan.slots_json as EnhancedContentPlanSlot[];
    if (!Array.isArray(slots)) continue;
    const slotIndex = slots.findIndex((s) => s.task_id === taskId);
    if (slotIndex === -1) continue;

    const slot = slots[slotIndex];
    if (slot.status === "pending" || slot.status === "approved") {
      slot.status = "created";
      const updated = [...slots];
      updated[slotIndex] = slot;

      await db
        .update(instagram_content_plans)
        .set({ slots_json: updated, updated_at_ms: Date.now() })
        .where(eq(instagram_content_plans.id, plan.id));
    }
    break;
  }
}
