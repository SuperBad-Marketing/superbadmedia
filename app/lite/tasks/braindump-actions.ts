"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import {
  parseBraindump,
  type ParsedBraindump,
  type SurfaceContext,
  type ParsedContentIdea,
} from "@/lib/ai/parse-braindump";
import { parseTodoBraindump, type TodoParsedBraindump } from "@/lib/ai/parse-braindump-todo";
import { parseIdeasBraindump, type IdeasParsedBraindump } from "@/lib/ai/parse-braindump-ideas";
import {
  analyzeContentIdeas,
  inferKeywords,
  generateBlogOutlines,
  generateBlogDrafts,
  deriveSocialPosts,
  extractContentMoodSignal,
  type AnalyzedContent,
  type KeywordResult,
  type OutlineResult,
  type BlogDraftResult,
  type DerivedSocialPost,
  type ContentIdeaSummary,
  type ParsedBlogIdea,
} from "@/lib/ai/parse-braindump-content";
import {
  createBraindump,
  markBraindumpCommitted,
  createTask,
} from "@/lib/tasks/queries";
import { commitContentIdeas, type ContentIdeaInput } from "@/lib/braindump/commit-content";
import { commitScriptIdeas, type ScriptIdeaInput } from "@/lib/braindump/commit-scripts";
import { commitBlogIdeas } from "@/lib/braindump/commit-blogs";
import { commitProjectIdeas } from "@/lib/braindump/commit-projects";
import { logActivity } from "@/lib/activity-log";
import type { BraindumpType } from "@/lib/db/schema/braindumps";
import type { TaskKind, TaskPriority, ChecklistItem } from "@/lib/tasks/types";
import type { ContentType } from "@/lib/db/schema/content-studio";
import type { PillarSlug, ScriptFormat } from "@/lib/db/schema/talking-head";
import type { MoodSignal } from "@/lib/db/schema/instagram-competitive";
import type { ParsedProjectIdea } from "@/lib/ai/parse-braindump-ideas";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function adminGuard(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session.user.id ?? "admin";
}

// ---------------------------------------------------------------------------
// General parse (unchanged v1 behaviour)
// ---------------------------------------------------------------------------

export async function parseBraindumpAction(
  rawText: string,
  surfaceContext?: SurfaceContext | null,
): Promise<ActionResult<ParsedBraindump>> {
  if (!(await adminGuard())) {
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

// ---------------------------------------------------------------------------
// To-do parse
// ---------------------------------------------------------------------------

export async function parseTodoBraindumpAction(
  rawText: string,
  surfaceContext?: SurfaceContext | null,
): Promise<ActionResult<TodoParsedBraindump>> {
  if (!(await adminGuard())) {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const result = await parseTodoBraindump(rawText, surfaceContext);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Parse failed.",
    };
  }
}

// ---------------------------------------------------------------------------
// Ideas parse
// ---------------------------------------------------------------------------

export async function parseIdeasBraindumpAction(
  rawText: string,
): Promise<ActionResult<IdeasParsedBraindump>> {
  if (!(await adminGuard())) {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const result = await parseIdeasBraindump(rawText);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Parse failed.",
    };
  }
}

// ---------------------------------------------------------------------------
// Content parse — staged actions for progressive reveal
// ---------------------------------------------------------------------------

export async function analyzeContentAction(
  rawText: string,
): Promise<ActionResult<AnalyzedContent>> {
  if (!(await adminGuard())) {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const result = await analyzeContentIdeas(rawText);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Analysis failed.",
    };
  }
}

export async function inferKeywordsAction(
  ideas: ContentIdeaSummary[],
): Promise<ActionResult<KeywordResult[]>> {
  if (!(await adminGuard())) {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const result = await inferKeywords(ideas);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Keyword inference failed.",
    };
  }
}

export async function generateOutlinesAction(
  ideas: ContentIdeaSummary[],
  keywords: KeywordResult[],
): Promise<ActionResult<OutlineResult[]>> {
  if (!(await adminGuard())) {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const result = await generateBlogOutlines(ideas, keywords);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Outline generation failed.",
    };
  }
}

export async function generateDraftsAction(
  ideas: ContentIdeaSummary[],
  keywords: KeywordResult[],
  outlines: OutlineResult[],
): Promise<ActionResult<BlogDraftResult[]>> {
  if (!(await adminGuard())) {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const result = await generateBlogDrafts(ideas, keywords, outlines);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Draft generation failed.",
    };
  }
}

export async function deriveSocialPostsAction(
  blogDrafts: BlogDraftResult[],
): Promise<ActionResult<DerivedSocialPost[]>> {
  if (!(await adminGuard())) {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const result = await deriveSocialPosts(blogDrafts);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Social derivation failed.",
    };
  }
}

// ---------------------------------------------------------------------------
// Mood signal extraction (shared across content flows)
// ---------------------------------------------------------------------------

export async function extractMoodSignalAction(
  rawText: string,
): Promise<ActionResult<MoodSignal | null>> {
  if (!(await adminGuard())) {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const result = await extractContentMoodSignal(rawText);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Mood signal extraction failed.",
    };
  }
}

// ---------------------------------------------------------------------------
// Commit types (shared)
// ---------------------------------------------------------------------------

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
  blogPostIds: string[];
  projectIds: string[];
};

// ---------------------------------------------------------------------------
// General / To-do commit (same flow, different type tag)
// ---------------------------------------------------------------------------

export async function commitBraindumpAction(
  rawText: string,
  surfaceContext: SurfaceContext | null,
  commitTasks: CommitTask[],
  commitContent: CommitContentIdea[] = [],
  commitScripts: CommitScriptIdea[] = [],
  moodSignal: MoodSignal | null = null,
  braindumpType: BraindumpType = "general",
): Promise<ActionResult<CommitResult>> {
  const userId = await adminGuard();
  if (!userId) {
    return { ok: false, error: "Not authorised." };
  }

  const totalItems = commitTasks.length + commitContent.length + commitScripts.length;
  if (totalItems === 0) {
    return { ok: false, error: "No items to commit." };
  }

  try {
    const braindump = await createBraindump({
      raw_text: rawText,
      surface_context: surfaceContext as Record<string, unknown> | null,
      mood_signal: moodSignal as Record<string, unknown> | null,
      created_by: userId,
      type: braindumpType,
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
      body: `Braindump committed (${braindumpType}), ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}, ${contentPostIds.length} post${contentPostIds.length === 1 ? "" : "s"}, ${scriptIds.length} script${scriptIds.length === 1 ? "" : "s"}`,
      meta: {
        braindump_id: braindump.id,
        type: braindumpType,
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
        blogPostIds: [],
        projectIds: [],
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Commit failed.",
    };
  }
}

// ---------------------------------------------------------------------------
// Content commit
// ---------------------------------------------------------------------------

export async function commitContentBraindumpAction(
  rawText: string,
  blogIdeas: ParsedBlogIdea[],
  moodSignal: MoodSignal | null = null,
): Promise<ActionResult<CommitResult>> {
  const userId = await adminGuard();
  if (!userId) {
    return { ok: false, error: "Not authorised." };
  }

  const enabledBlogs = blogIdeas.filter((b) => b.enabled);
  const enabledSocial = blogIdeas.flatMap((b) =>
    b.social_posts.filter((s) => (s as ParsedContentIdea & { enabled?: boolean }).enabled !== false),
  );
  const totalItems = enabledBlogs.length + enabledSocial.length;
  if (totalItems === 0) {
    return { ok: false, error: "No items to commit." };
  }

  try {
    const braindump = await createBraindump({
      raw_text: rawText,
      surface_context: null,
      mood_signal: moodSignal as Record<string, unknown> | null,
      created_by: userId,
      type: "content",
    });

    const blogResults = await commitBlogIdeas(enabledBlogs, braindump.id);
    const blogPostIds = blogResults.map((r) => r.id);

    const socialInputs: CommitContentIdea[] = enabledSocial.map((s) => ({
      brief: s.brief,
      content_type: s.content_type,
      slide_count: s.slide_count,
    }));
    let contentPostIds: string[] = [];
    if (socialInputs.length > 0) {
      const contentResults = await commitContentIdeas(socialInputs, braindump.id);
      contentPostIds = contentResults.map((r) => r.id);
    }

    await markBraindumpCommitted(
      braindump.id,
      0,
      contentPostIds.length,
      0,
      blogPostIds.length,
    );

    await logActivity({
      kind: "braindump_committed",
      body: `Content braindump committed, ${blogPostIds.length} blog${blogPostIds.length === 1 ? "" : "s"}, ${contentPostIds.length} social post${contentPostIds.length === 1 ? "" : "s"}`,
      meta: {
        braindump_id: braindump.id,
        type: "content",
        blog_post_ids: blogPostIds,
        content_post_ids: contentPostIds,
      },
      createdBy: `user:${userId}`,
    });

    revalidatePath("/lite/content/studio");
    revalidatePath("/lite/content/engine");
    revalidatePath("/lite/cockpit");

    return {
      ok: true,
      data: {
        braindumpId: braindump.id,
        taskIds: [],
        contentPostIds,
        scriptPackId: null,
        scriptIds: [],
        blogPostIds,
        projectIds: [],
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Commit failed.",
    };
  }
}

// ---------------------------------------------------------------------------
// Ideas commit
// ---------------------------------------------------------------------------

export async function commitIdeasBraindumpAction(
  rawText: string,
  projectIdeas: ParsedProjectIdea[],
  moodSignal: MoodSignal | null = null,
): Promise<ActionResult<CommitResult>> {
  const userId = await adminGuard();
  if (!userId) {
    return { ok: false, error: "Not authorised." };
  }

  if (projectIdeas.length === 0) {
    return { ok: false, error: "No ideas to commit." };
  }

  try {
    const braindump = await createBraindump({
      raw_text: rawText,
      surface_context: null,
      mood_signal: moodSignal as Record<string, unknown> | null,
      created_by: userId,
      type: "ideas",
    });

    const projectResults = await commitProjectIdeas(projectIdeas, userId);
    const projectIds = projectResults.map((r) => r.id);

    await markBraindumpCommitted(
      braindump.id,
      0,
      0,
      0,
      0,
      projectIds.length,
    );

    await logActivity({
      kind: "braindump_committed",
      body: `Ideas braindump committed, ${projectIds.length} project${projectIds.length === 1 ? "" : "s"}`,
      meta: {
        braindump_id: braindump.id,
        type: "ideas",
        project_ids: projectIds,
      },
      createdBy: `user:${userId}`,
    });

    revalidatePath("/lite/projects");
    revalidatePath("/lite/cockpit");

    return {
      ok: true,
      data: {
        braindumpId: braindump.id,
        taskIds: [],
        contentPostIds: [],
        scriptPackId: null,
        scriptIds: [],
        blogPostIds: [],
        projectIds,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Commit failed.",
    };
  }
}
