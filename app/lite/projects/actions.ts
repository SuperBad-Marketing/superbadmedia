"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import {
  createProject,
  updateProject,
  deleteProject,
  saveBreakdown,
  updateDraftTasks,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/projects/queries";
import { createTask } from "@/lib/tasks/queries";
import { generateProjectBreakdown } from "@/lib/projects/generate-breakdown";
import type { DraftTask, ProjectStatus } from "@/lib/db/schema/projects";
import { logActivity } from "@/lib/activity-log";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function adminGuard(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session.user.id ?? "admin";
}

export async function createProjectAction(
  input: { title: string; brain_dump: string },
): Promise<ActionResult<{ id: string }>> {
  const userId = await adminGuard();
  if (!userId) return { ok: false, error: "Not authorised." };
  try {
    const project = await createProject({ ...input, created_by: userId });
    await logActivity({
      kind: "project_created",
      body: `Project created: ${project.title}`,
      meta: { project_id: project.id },
      createdBy: `user:${userId}`,
    });
    revalidatePath("/lite/projects");
    return { ok: true, data: { id: project.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create project.",
    };
  }
}

export async function updateProjectAction(
  id: string,
  input: UpdateProjectInput,
): Promise<ActionResult> {
  const userId = await adminGuard();
  if (!userId) return { ok: false, error: "Not authorised." };
  try {
    await updateProject(id, input);
    revalidatePath("/lite/projects");
    revalidatePath(`/lite/projects/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update project.",
    };
  }
}

export async function deleteProjectAction(
  id: string,
): Promise<ActionResult> {
  const userId = await adminGuard();
  if (!userId) return { ok: false, error: "Not authorised." };
  try {
    await deleteProject(id);
    await logActivity({
      kind: "project_deleted",
      body: "Project deleted",
      meta: { project_id: id },
      createdBy: `user:${userId}`,
    });
    revalidatePath("/lite/projects");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete project.",
    };
  }
}

export async function generateBreakdownAction(
  projectId: string,
): Promise<ActionResult> {
  const userId = await adminGuard();
  if (!userId) return { ok: false, error: "Not authorised." };
  try {
    const { getProjectById } = await import("@/lib/projects/queries");
    const project = await getProjectById(projectId);
    if (!project) return { ok: false, error: "Project not found." };

    const { breakdown, draftTasks } = await generateProjectBreakdown(
      project.title,
      project.brain_dump,
    );

    await saveBreakdown(projectId, breakdown, draftTasks);

    await logActivity({
      kind: "project_breakdown_generated",
      body: `Breakdown generated for: ${project.title}`,
      meta: { project_id: projectId, task_count: draftTasks.length },
      createdBy: `user:${userId}`,
    });

    revalidatePath(`/lite/projects/${projectId}`);
    revalidatePath("/lite/projects");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to generate breakdown.",
    };
  }
}

export async function approveDraftTasksAction(
  projectId: string,
  tempIds: string[],
): Promise<ActionResult<{ created: number }>> {
  const userId = await adminGuard();
  if (!userId) return { ok: false, error: "Not authorised." };
  try {
    const { getProjectById } = await import("@/lib/projects/queries");
    const project = await getProjectById(projectId);
    if (!project) return { ok: false, error: "Project not found." };

    const drafts = (project.draft_tasks_json as DraftTask[] | null) ?? [];
    let created = 0;

    for (const draft of drafts) {
      if (!tempIds.includes(draft.temp_id)) continue;
      if (draft.approved) continue;

      await createTask({
        title: draft.title,
        body: draft.body,
        kind: "personal",
        priority: draft.priority,
        entity_type: "project",
        entity_id: projectId,
        created_by: userId,
      });
      draft.approved = true;
      created++;
    }

    await updateDraftTasks(projectId, drafts);

    await logActivity({
      kind: "project_tasks_approved",
      body: `${created} task${created === 1 ? "" : "s"} approved from project: ${project.title}`,
      meta: { project_id: projectId, count: created },
      createdBy: `user:${userId}`,
    });

    revalidatePath(`/lite/projects/${projectId}`);
    revalidatePath("/lite/tasks");
    return { ok: true, data: { created } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to approve tasks.",
    };
  }
}

export async function removeDraftTaskAction(
  projectId: string,
  tempId: string,
): Promise<ActionResult> {
  const userId = await adminGuard();
  if (!userId) return { ok: false, error: "Not authorised." };
  try {
    const { getProjectById } = await import("@/lib/projects/queries");
    const project = await getProjectById(projectId);
    if (!project) return { ok: false, error: "Project not found." };

    const drafts = (project.draft_tasks_json as DraftTask[] | null) ?? [];
    const filtered = drafts.filter((d) => d.temp_id !== tempId);

    await updateDraftTasks(projectId, filtered);
    revalidatePath(`/lite/projects/${projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to remove task.",
    };
  }
}
