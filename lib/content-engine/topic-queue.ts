/**
 * Content Engine — topic queue + outline generation (spec §2.1 Stage 2).
 *
 * Haiku generates a structured outline (sections, key points, word count,
 * featured snippet opportunity) for each topic entering the queue. Brand
 * DNA tags-only injection for Haiku tier per `brand-dna-assessment.md`.
 *
 * Owner: CE-2. Consumer: `runKeywordResearch()` in `research.ts`.
 */
import { eq, and, not, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentTopics } from "@/lib/db/schema/content-topics";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { companies } from "@/lib/db/schema/companies";
import { invokeLlmText } from "@/lib/ai/invoke";
import type { ContentGap } from "./rankability";

export interface TopicOutline {
  sections: OutlineSection[];
  targetWordCount: number;
  featuredSnippetOpportunity: boolean;
  featuredSnippetType?: string;
}

export interface OutlineSection {
  heading: string;
  keyPoints: string[];
  estimatedWords: number;
}

/**
 * Generate a structured outline for a topic via Haiku.
 *
 * Reads Brand DNA signal tags (Haiku-tier injection) for voice alignment.
 * Returns the parsed outline or a minimal fallback on failure.
 */
export async function generateTopicOutline(
  keyword: string,
  contentGaps: ContentGap[],
  companyId: string,
): Promise<TopicOutline> {
  const brandDnaTags = await loadBrandDnaTags(companyId);

  const prompt = buildOutlinePrompt(keyword, contentGaps, brandDnaTags);

  try {
    const raw = await invokeLlmText({
      job: "content-generate-topic-outline",
      prompt,
      maxTokens: 1500,
    });

    return parseOutlineResponse(raw);
  } catch {
    // Fallback: minimal outline so the topic still enters the queue
    return {
      sections: [
        {
          heading: keyword,
          keyPoints: ["Introduction and overview"],
          estimatedWords: 800,
        },
      ],
      targetWordCount: 800,
      featuredSnippetOpportunity: false,
    };
  }
}

/**
 * List queued topics for a company, ordered by rankability score desc.
 */
export async function listQueuedTopics(
  companyId: string,
): Promise<
  Array<{
    id: string;
    keyword: string;
    rankabilityScore: number | null;
    contentGaps: ContentGap[] | null;
    outline: TopicOutline | null;
    createdAtMs: number;
  }>
> {
  const rows = await db
    .select()
    .from(contentTopics)
    .where(
      and(
        eq(contentTopics.company_id, companyId),
        eq(contentTopics.status, "queued"),
      ),
    )
    .orderBy(desc(contentTopics.rankability_score));

  return rows.map((r) => ({
    id: r.id,
    keyword: r.keyword,
    rankabilityScore: r.rankability_score,
    contentGaps: r.content_gaps as ContentGap[] | null,
    outline: r.outline as TopicOutline | null,
    createdAtMs: r.created_at_ms,
  }));
}

/**
 * Veto a topic — one-click removal from the active queue.
 * Per spec §2.1 Stage 2: subscriber can see and veto, not reorder or add.
 */
export async function vetoTopic(topicId: string): Promise<boolean> {
  const result = await db
    .update(contentTopics)
    .set({
      status: "vetoed",
      vetoed_at_ms: Date.now(),
    })
    .where(
      and(
        eq(contentTopics.id, topicId),
        eq(contentTopics.status, "queued"),
      ),
    )
    .returning({ id: contentTopics.id });

  return result.length > 0;
}

/**
 * Pick the top un-vetoed topic from the queue for generation.
 * Per spec §2.1 Stage 3: engine selects the top un-vetoed topic.
 */
export async function pickNextTopic(
  companyId: string,
): Promise<{
  id: string;
  keyword: string;
  outline: TopicOutline | null;
  contentGaps: ContentGap[] | null;
  serpSnapshot: unknown;
} | null> {
  const row = await db
    .select()
    .from(contentTopics)
    .where(
      and(
        eq(contentTopics.company_id, companyId),
        eq(contentTopics.status, "queued"),
        not(inArray(contentTopics.status, ["vetoed", "skipped"])),
      ),
    )
    .orderBy(desc(contentTopics.rankability_score))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) return null;

  return {
    id: row.id,
    keyword: row.keyword,
    outline: row.outline as TopicOutline | null,
    contentGaps: row.content_gaps as ContentGap[] | null,
    serpSnapshot: row.serp_snapshot,
  };
}

/**
 * Load Brand DNA signal tags (Haiku-tier injection).
 * Returns an empty string if no Brand DNA profile exists.
 */
async function loadBrandDnaTags(companyId: string): Promise<string> {
  // Resolve the primary contact for this company to find their Brand DNA
  const company = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!company) return "";

  const profile = await db
    .select({ signal_tags: brand_dna_profiles.signal_tags })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.company_id, companyId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!profile?.signal_tags) return "";

  const tags = profile.signal_tags as unknown as Record<string, unknown>;
  return JSON.stringify(tags);
}

function buildOutlinePrompt(
  keyword: string,
  contentGaps: ContentGap[],
  brandDnaTags: string,
): string {
  const gapsSection =
    contentGaps.length > 0
      ? `\nCONTENT GAPS IDENTIFIED:\n${contentGaps.map((g) => `- ${g.angle}: ${g.reasoning}`).join("\n")}`
      : "";

  const brandSection = brandDnaTags
    ? `\nBRAND VOICE SIGNALS:\n${brandDnaTags}`
    : "";

  return `You are an SEO content strategist. Create a detailed blog post outline for the keyword "${keyword}".${gapsSection}${brandSection}

The outline should target content gaps where they exist, and aim for comprehensive coverage that would satisfy search intent.

Respond in this exact JSON format (no markdown fencing):
{
  "sections": [
    {
      "heading": "Section heading (H2 level)",
      "keyPoints": ["Point to cover", "Another point"],
      "estimatedWords": 300
    }
  ],
  "targetWordCount": 1500,
  "featuredSnippetOpportunity": true,
  "featuredSnippetType": "paragraph"
}

Featured snippet types: "paragraph", "list", "table", or null if no opportunity. Target 1000-2000 words total. Include 4-8 sections.`;
}

function parseOutlineResponse(raw: string): TopicOutline {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as {
    sections?: Array<{
      heading: string;
      keyPoints: string[];
      estimatedWords: number;
    }>;
    targetWordCount?: number;
    featuredSnippetOpportunity?: boolean;
    featuredSnippetType?: string;
  };

  if (
    !parsed.sections ||
    !Array.isArray(parsed.sections) ||
    parsed.sections.length === 0
  ) {
    throw new Error("Invalid outline: missing sections");
  }

  return {
    sections: parsed.sections.map((s) => ({
      heading: String(s.heading),
      keyPoints: Array.isArray(s.keyPoints)
        ? s.keyPoints.map(String)
        : [],
      estimatedWords: Number(s.estimatedWords) || 200,
    })),
    targetWordCount: Number(parsed.targetWordCount) || 1500,
    featuredSnippetOpportunity:
      parsed.featuredSnippetOpportunity === true,
    featuredSnippetType: parsed.featuredSnippetType ?? undefined,
  };
}
