import { db } from "@/lib/db";
import { contentStudioPosts } from "@/lib/db/schema/content-studio";
import { generateCopy, type SlideCopy } from "@/lib/content-studio/generate-copy";
import type { ContentType } from "@/lib/db/schema/content-studio";

export interface ContentIdeaInput {
  brief: string;
  content_type: ContentType;
  slide_count: number;
}

export interface CommittedContentPost {
  id: string;
  brief: string;
  content_type: string;
  slide_count: number;
  template_id: string;
}

export async function commitContentIdeas(
  ideas: ContentIdeaInput[],
  braindumpId: string,
): Promise<CommittedContentPost[]> {
  const results: CommittedContentPost[] = [];

  const settled = await Promise.allSettled(
    ideas.map((idea) => commitSingleContentIdea(idea, braindumpId)),
  );

  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    }
  }

  return results;
}

async function commitSingleContentIdea(
  idea: ContentIdeaInput,
  braindumpId: string,
): Promise<CommittedContentPost> {
  const copyResult = await generateCopy(idea.brief, idea.content_type, idea.slide_count);

  if (!copyResult.ok) {
    throw new Error(`Content generation failed: ${copyResult.error}`);
  }

  const now = Date.now();
  const id = crypto.randomUUID();

  await db.insert(contentStudioPosts).values({
    id,
    brief: idea.brief,
    content_type: idea.content_type,
    template_id: copyResult.templateId,
    slide_count: idea.slide_count,
    generated_copy_json: copyResult.slides as SlideCopy[],
    correction_history_json: [] as unknown[],
    status: "draft",
    source_braindump_id: braindumpId,
    created_at_ms: now,
    updated_at_ms: now,
  });

  return {
    id,
    brief: idea.brief,
    content_type: idea.content_type,
    slide_count: idea.slide_count,
    template_id: copyResult.templateId,
  };
}
