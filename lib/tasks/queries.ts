import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  tasks,
  braindumps,
  type TaskRow,
  type TaskInsert,
  type TaskStatus,
  type TaskKind,
  type TaskPriority,
  type TaskRecurrence,
  type BraindumpRow,
} from "@/lib/db/schema";
import { eq, and, inArray, like, or, lte, gte, isNull, isNotNull, sql } from "drizzle-orm";
import { validateTransition, isTerminal } from "./transitions";
import type { ChecklistItem } from "./types";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  title: string;
  body?: string | null;
  kind: TaskKind;
  priority?: TaskPriority;
  due_at_ms?: number | null;
  entity_type?: string | null;
  entity_id?: string | null;
  checklist?: ChecklistItem[] | null;
  checklist_auto_complete?: boolean;
  recurrence?: TaskRecurrence | null;
  recurrence_day?: number | null;
  parent_recurrence_id?: string | null;
  source_braindump_id?: string | null;
  created_by: string;
}

export async function createTask(input: CreateTaskInput): Promise<TaskRow> {
  const now = Date.now();
  const row: TaskInsert = {
    id: randomUUID(),
    title: input.title,
    body: input.body ?? null,
    kind: input.kind,
    status: "todo",
    priority: input.priority ?? "normal",
    due_at_ms: input.due_at_ms ?? null,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    checklist: input.checklist ?? null,
    checklist_auto_complete: input.checklist_auto_complete ?? true,
    recurrence: input.recurrence ?? null,
    recurrence_day: input.recurrence_day ?? null,
    parent_recurrence_id: input.parent_recurrence_id ?? null,
    source_braindump_id: input.source_braindump_id ?? null,
    created_at_ms: now,
    updated_at_ms: now,
    created_by: input.created_by,
  };
  const [inserted] = await db.insert(tasks).values(row).returning();
  return inserted;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getTaskById(id: string): Promise<TaskRow | undefined> {
  return db.query.tasks.findFirst({ where: eq(tasks.id, id) });
}

export interface ListTasksFilter {
  status?: TaskStatus[];
  kind?: TaskKind[];
  priority?: TaskPriority[];
  entity_type?: string;
  entity_id?: string;
  due_before_ms?: number;
  due_after_ms?: number;
  overdue_as_of_ms?: number;
  has_braindump_source?: boolean;
  search?: string;
}

export async function listTasks(
  filter: ListTasksFilter = {},
): Promise<TaskRow[]> {
  const conditions = [];

  if (filter.status?.length) {
    conditions.push(inArray(tasks.status, filter.status));
  }
  if (filter.kind?.length) {
    conditions.push(inArray(tasks.kind, filter.kind));
  }
  if (filter.priority?.length) {
    conditions.push(inArray(tasks.priority, filter.priority));
  }
  if (filter.entity_type && filter.entity_id) {
    conditions.push(
      and(
        eq(tasks.entity_type, filter.entity_type),
        eq(tasks.entity_id, filter.entity_id),
      )!,
    );
  }
  if (filter.due_before_ms != null) {
    conditions.push(lte(tasks.due_at_ms, filter.due_before_ms));
  }
  if (filter.due_after_ms != null) {
    conditions.push(gte(tasks.due_at_ms, filter.due_after_ms));
  }
  if (filter.overdue_as_of_ms != null) {
    conditions.push(
      and(
        isNotNull(tasks.due_at_ms),
        lte(tasks.due_at_ms, filter.overdue_as_of_ms),
        inArray(tasks.status, ["todo", "in_progress"]),
      )!,
    );
  }
  if (filter.has_braindump_source === true) {
    conditions.push(isNotNull(tasks.source_braindump_id));
  } else if (filter.has_braindump_source === false) {
    conditions.push(isNull(tasks.source_braindump_id));
  }
  if (filter.search) {
    const term = `%${filter.search}%`;
    conditions.push(
      or(like(tasks.title, term), like(tasks.body, term))!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db.query.tasks.findMany({
    where,
    orderBy: [tasks.due_at_ms, sql`${tasks.priority} = 'high' DESC`],
  });
}

export async function getTasksByEntity(
  entityType: string,
  entityId: string,
): Promise<TaskRow[]> {
  return listTasks({ entity_type: entityType, entity_id: entityId });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export interface UpdateTaskInput {
  title?: string;
  body?: string | null;
  kind?: TaskKind;
  priority?: TaskPriority;
  due_at_ms?: number | null;
  entity_type?: string | null;
  entity_id?: string | null;
  checklist?: ChecklistItem[] | null;
  checklist_auto_complete?: boolean;
  recurrence?: TaskRecurrence | null;
  recurrence_day?: number | null;
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
): Promise<TaskRow> {
  const [updated] = await db
    .update(tasks)
    .set({ ...input, updated_at_ms: Date.now() })
    .where(eq(tasks.id, id))
    .returning();
  if (!updated) throw new Error(`Task ${id} not found`);
  return updated;
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export async function transitionTaskStatus(
  id: string,
  to: TaskStatus,
): Promise<TaskRow> {
  const task = await getTaskById(id);
  if (!task) throw new Error(`Task ${id} not found`);

  validateTransition(task.status as TaskStatus, to, task.kind as TaskKind);

  const now = Date.now();
  const patch: Partial<TaskInsert> = {
    status: to,
    updated_at_ms: now,
  };

  if (isTerminal(to)) {
    patch.completed_at_ms = now;
  }

  const [updated] = await db
    .update(tasks)
    .set(patch)
    .where(eq(tasks.id, id))
    .returning();
  return updated;
}

// ---------------------------------------------------------------------------
// Checklist operations
// ---------------------------------------------------------------------------

export async function updateChecklist(
  id: string,
  checklist: ChecklistItem[],
): Promise<TaskRow> {
  const task = await getTaskById(id);
  if (!task) throw new Error(`Task ${id} not found`);

  const allChecked =
    checklist.length > 0 && checklist.every((item) => item.checked);
  const shouldAutoComplete = allChecked && task.checklist_auto_complete;

  const now = Date.now();
  const patch: Partial<TaskInsert> = {
    checklist: checklist as unknown as null,
    updated_at_ms: now,
  };

  if (shouldAutoComplete) {
    const targetStatus: TaskStatus =
      task.kind === "client_deliverable" ? "delivered" : "done";
    validateTransition(
      task.status as TaskStatus,
      targetStatus,
      task.kind as TaskKind,
    );
    patch.status = targetStatus;
    patch.completed_at_ms = now;
  }

  const [updated] = await db
    .update(tasks)
    .set(patch)
    .where(eq(tasks.id, id))
    .returning();
  return updated;
}

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

function computeNextDueMs(
  recurrence: string,
  recurrenceDay: number | null,
  fromMs: number,
): number {
  const d = new Date(fromMs);

  switch (recurrence) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      if (recurrenceDay != null) d.setDate(recurrenceDay);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      if (recurrenceDay != null) d.setDate(recurrenceDay);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      if (recurrenceDay != null) d.setDate(recurrenceDay);
      break;
  }

  return d.getTime();
}

export async function spawnNextRecurrence(
  completedTask: TaskRow,
): Promise<TaskRow | null> {
  if (!completedTask.recurrence) return null;

  const baseMs = completedTask.due_at_ms ?? completedTask.completed_at_ms ?? Date.now();
  const nextDueMs = computeNextDueMs(
    completedTask.recurrence,
    completedTask.recurrence_day,
    baseMs,
  );

  return createTask({
    title: completedTask.title,
    body: completedTask.body,
    kind: completedTask.kind as TaskKind,
    priority: completedTask.priority as TaskPriority,
    due_at_ms: nextDueMs,
    entity_type: completedTask.entity_type,
    entity_id: completedTask.entity_id,
    checklist: completedTask.checklist
      ? (completedTask.checklist as ChecklistItem[]).map((item) => ({
          ...item,
          checked: false,
          checked_at: null,
        }))
      : null,
    checklist_auto_complete: completedTask.checklist_auto_complete ?? true,
    recurrence: completedTask.recurrence as TaskRecurrence,
    recurrence_day: completedTask.recurrence_day,
    parent_recurrence_id:
      completedTask.parent_recurrence_id ?? completedTask.id,
    created_by: completedTask.created_by,
  });
}

/**
 * Transition to done/delivered AND spawn next recurrence if applicable.
 * This is the canonical "mark task done" path — all callers should use
 * this rather than transitionTaskStatus + spawnNextRecurrence separately.
 */
export async function markTaskDone(
  id: string,
  targetStatus?: TaskStatus,
): Promise<{ task: TaskRow; spawned: TaskRow | null }> {
  const task = await getTaskById(id);
  if (!task) throw new Error(`Task ${id} not found`);

  const to =
    targetStatus ??
    (task.kind === "client_deliverable" ? "delivered" : "done");

  const updated = await transitionTaskStatus(id, to);
  const spawned = await spawnNextRecurrence(updated);

  return { task: updated, spawned };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteTask(id: string): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function deleteTasks(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(tasks).where(inArray(tasks.id, ids));
}

// ---------------------------------------------------------------------------
// Braindumps
// ---------------------------------------------------------------------------

export async function createBraindump(input: {
  raw_text: string;
  surface_context?: Record<string, unknown> | null;
  mood_signal?: Record<string, unknown> | null;
  created_by: string;
  type?: "general" | "content" | "todo" | "ideas";
}): Promise<BraindumpRow> {
  const now = Date.now();
  const row = {
    id: randomUUID(),
    type: input.type ?? ("general" as const),
    raw_text: input.raw_text,
    surface_context: input.surface_context ?? null,
    mood_signal_json: input.mood_signal ?? null,
    task_count: 0,
    created_by: input.created_by,
    created_at_ms: now,
  };
  const [inserted] = await db.insert(braindumps).values(row).returning();
  return inserted;
}

export async function markBraindumpCommitted(
  id: string,
  taskCount: number,
  contentCount = 0,
  scriptCount = 0,
  blogCount = 0,
  projectCount = 0,
): Promise<void> {
  await db
    .update(braindumps)
    .set({
      committed_at_ms: Date.now(),
      parsed_at_ms: Date.now(),
      task_count: taskCount,
      content_count: contentCount,
      script_count: scriptCount,
      blog_count: blogCount,
      project_count: projectCount,
    })
    .where(eq(braindumps.id, id));
}

export async function getBraindumpById(
  id: string,
): Promise<BraindumpRow | undefined> {
  return db.query.braindumps.findFirst({ where: eq(braindumps.id, id) });
}

// ---------------------------------------------------------------------------
// Portal queries
// ---------------------------------------------------------------------------

export async function getTasksForClientPortal(
  companyId: string,
  options?: { kind?: Array<"client_deliverable" | "client_task"> },
): Promise<TaskRow[]> {
  const kinds = options?.kind ?? ["client_deliverable", "client_task"];
  return db.query.tasks.findMany({
    where: and(
      inArray(tasks.kind, kinds),
      eq(tasks.entity_type, "client"),
      eq(tasks.entity_id, companyId),
    ),
    orderBy: [tasks.status, tasks.due_at_ms],
  });
}

