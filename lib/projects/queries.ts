import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  projects,
  type ProjectRow,
  type ProjectInsert,
  type ProjectStatus,
  type ProjectBreakdown,
  type DraftTask,
} from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  title: string;
  brain_dump: string;
  created_by: string;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectRow> {
  const now = Date.now();
  const row: ProjectInsert = {
    id: randomUUID(),
    title: input.title,
    brain_dump: input.brain_dump,
    status: "idea",
    created_at_ms: now,
    updated_at_ms: now,
    created_by: input.created_by,
  };
  const [inserted] = await db.insert(projects).values(row).returning();
  return inserted;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getProjectById(
  id: string,
): Promise<ProjectRow | undefined> {
  return db.query.projects.findFirst({ where: eq(projects.id, id) });
}

export async function listProjects(
  filter?: { status?: ProjectStatus[] },
): Promise<ProjectRow[]> {
  const where =
    filter?.status?.length
      ? inArray(projects.status, filter.status)
      : undefined;

  return db.query.projects.findMany({
    where,
    orderBy: [desc(projects.updated_at_ms)],
  });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export interface UpdateProjectInput {
  title?: string;
  brain_dump?: string;
  status?: ProjectStatus;
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
): Promise<ProjectRow> {
  const [updated] = await db
    .update(projects)
    .set({ ...input, updated_at_ms: Date.now() })
    .where(eq(projects.id, id))
    .returning();
  if (!updated) throw new Error(`Project ${id} not found`);
  return updated;
}

export async function saveBreakdown(
  id: string,
  breakdown: ProjectBreakdown,
  draftTasks: DraftTask[],
): Promise<ProjectRow> {
  const now = Date.now();
  const [updated] = await db
    .update(projects)
    .set({
      breakdown_json: breakdown as unknown as null,
      breakdown_generated_at_ms: now,
      draft_tasks_json: draftTasks as unknown as null,
      status: "planning",
      updated_at_ms: now,
    })
    .where(eq(projects.id, id))
    .returning();
  if (!updated) throw new Error(`Project ${id} not found`);
  return updated;
}

export async function updateDraftTasks(
  id: string,
  draftTasks: DraftTask[],
): Promise<ProjectRow> {
  const [updated] = await db
    .update(projects)
    .set({
      draft_tasks_json: draftTasks as unknown as null,
      updated_at_ms: Date.now(),
    })
    .where(eq(projects.id, id))
    .returning();
  if (!updated) throw new Error(`Project ${id} not found`);
  return updated;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteProject(id: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, id));
}
