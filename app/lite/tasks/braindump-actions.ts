"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import {
  parseBraindump,
  type ParsedBraindump,
  type SurfaceContext,
} from "@/lib/ai/parse-braindump";
import {
  createBraindump,
  markBraindumpCommitted,
  createTask,
} from "@/lib/tasks/queries";
import { logActivity } from "@/lib/activity-log";
import type { TaskKind, TaskPriority, ChecklistItem } from "@/lib/tasks/types";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function parseBraindumpAction(
  rawText: string,
  surfaceContext?: SurfaceContext | null,
): Promise<ActionResult<ParsedBraindump>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const result = await parseBraindump(rawText, surfaceContext);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Parse failed.",
    };
  }
}

export type CommitTask = {
  title: string;
  kind: TaskKind;
  priority: TaskPriority;
  due_at_ms: number | null;
  entity_type: string | null;
  entity_id: string | null;
  checklist: ChecklistItem[] | null;
};

export async function commitBraindumpAction(
  rawText: string,
  surfaceContext: SurfaceContext | null,
  commitTasks: CommitTask[],
): Promise<ActionResult<{ braindumpId: string; taskIds: string[] }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  if (commitTasks.length === 0) {
    return { ok: false, error: "No tasks to commit." };
  }
  const userId = session.user.id ?? "admin";
  try {
    const braindump = await createBraindump({
      raw_text: rawText,
      surface_context: surfaceContext as Record<string, unknown> | null,
      created_by: userId,
    });

    const taskIds: string[] = [];
    for (const t of commitTasks) {
      const created = await createTask({
        title: t.title,
        kind: t.kind,
        priority: t.priority,
        due_at_ms: t.due_at_ms,
        entity_type: t.entity_type,
        entity_id: t.entity_id,
        checklist: t.checklist,
        source_braindump_id: braindump.id,
        created_by: userId,
      });
      taskIds.push(created.id);
    }

    await markBraindumpCommitted(braindump.id, taskIds.length);

    await logActivity({
      kind: "braindump_committed",
      body: `Braindump committed — ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}`,
      meta: { braindump_id: braindump.id, task_ids: taskIds },
      createdBy: `user:${userId}`,
    });

    revalidatePath("/lite/tasks");
    return { ok: true, data: { braindumpId: braindump.id, taskIds } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Commit failed.",
    };
  }
}
