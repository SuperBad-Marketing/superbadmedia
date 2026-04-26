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
import { commitContentIdeas, type ContentIdeaInput } from "@/lib/braindump/commit-content";
import { commitScriptIdeas, type ScriptIdeaInput } from "@/lib/braindump/commit-scripts";
import { logActivity } from "@/lib/activity-log";
import type { TaskKind, TaskPriority, ChecklistItem } from "@/lib/tasks/types";
import type { ContentType } from "@/lib/db/schema/content-studio";
import type { PillarSlug, ScriptFormat } from "@/lib/db/schema/talking-head";

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

export type CommitContentIdea = {
  brief: string;
  content_type: ContentType;
  slide_count: number;
};

export type CommitScriptIdea = {
  topic: string;
  pillar: PillarSlug;
  format: ScriptFormat;
  angle: string;
};

export type CommitResult = {
  braindumpId: string;
  taskIds: string[];
  contentPostIds: string[];
  scriptPackId: string | null;
  scriptIds: string[];
};

export async function commitBraindumpAction(
  rawText: string,
  surfaceContext: SurfaceContext | null,
  commitTasks: CommitTask[],
  commitContent: CommitContentIdea[] = [],
  commitScripts: CommitScriptIdea[] = [],
): Promise<ActionResult<CommitResult>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  const totalItems = commitTasks.length + commitContent.length + commitScripts.length;
  if (totalItems === 0) {
    return { ok: false, error: "No items to commit." };
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

    let contentPostIds: string[] = [];
    if (commitContent.length > 0) {
      const contentResults = await commitContentIdeas(commitContent, braindump.id);
      contentPostIds = contentResults.map((r) => r.id);
    }

    let scriptPackId: string | null = null;
    const scriptIds: string[] = [];
    if (commitScripts.length > 0) {
      const scriptResult = await commitScriptIdeas(commitScripts, braindump.id);
      scriptPackId = scriptResult.packId;
      for (const s of scriptResult.scripts) {
        scriptIds.push(s.id);
      }
    }

    await markBraindumpCommitted(
      braindump.id,
      taskIds.length,
      contentPostIds.length,
      scriptIds.length,
    );

    await logActivity({
      kind: "braindump_committed",
      body: `Braindump committed — ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}, ${contentPostIds.length} post${contentPostIds.length === 1 ? "" : "s"}, ${scriptIds.length} script${scriptIds.length === 1 ? "" : "s"}`,
      meta: {
        braindump_id: braindump.id,
        task_ids: taskIds,
        content_post_ids: contentPostIds,
        script_pack_id: scriptPackId,
        script_ids: scriptIds,
      },
      createdBy: `user:${userId}`,
    });

    revalidatePath("/lite/tasks");
    revalidatePath("/lite/content/studio");
    revalidatePath("/lite/content/script-studio");
    revalidatePath("/lite/cockpit");

    return {
      ok: true,
      data: {
        braindumpId: braindump.id,
        taskIds,
        contentPostIds,
        scriptPackId,
        scriptIds,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Commit failed.",
    };
  }
}
