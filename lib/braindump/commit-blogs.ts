import { db } from "@/lib/db";
import { contentTopics } from "@/lib/db/schema/content-topics";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { companies } from "@/lib/db/schema/companies";
import { eq, sql } from "drizzle-orm";
import type { ParsedBlogIdea } from "@/lib/ai/parse-braindump-content";

export interface CommittedBlog {
  id: string;
  topic_id: string;
  title: string;
  slug: string;
  keyword: string;
}

async function getSuperbadCompanyId(): Promise<string> {
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(sql`LOWER(${companies.name}) LIKE '%superbad%'`)
    .limit(1);

  if (row) return row.id;

  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(companies).values({
    id,
    name: "SuperBad Marketing",
    name_normalised: "superbad marketing",
    first_seen_at_ms: now,
    created_at_ms: now,
    updated_at_ms: now,
  });
  return id;
}

export async function commitBlogIdeas(
  blogIdeas: ParsedBlogIdea[],
  braindumpId: string,
): Promise<CommittedBlog[]> {
  const companyId = await getSuperbadCompanyId();
  const results: CommittedBlog[] = [];
  const now = Date.now();

  for (const idea of blogIdeas) {
    if (!idea.enabled) continue;

    const topicId = crypto.randomUUID();
    await db.insert(contentTopics).values({
      id: topicId,
      company_id: companyId,
      keyword: idea.keyword,
      outline: idea.outline as unknown as Record<string, unknown>,
      status: "generated",
      source_braindump_id: braindumpId,
      created_at_ms: now,
    });

    const postId = crypto.randomUUID();
    await db.insert(blogPosts).values({
      id: postId,
      company_id: companyId,
      topic_id: topicId,
      title: idea.title,
      slug: idea.slug,
      body: idea.body_markdown,
      meta_description: idea.meta_description,
      snippet_target_section: idea.snippet_target_section,
      status: "in_review",
      source_braindump_id: braindumpId,
      created_at_ms: now,
      updated_at_ms: now,
    });

    results.push({
      id: postId,
      topic_id: topicId,
      title: idea.title,
      slug: idea.slug,
      keyword: idea.keyword,
    });
  }

  return results;
}
