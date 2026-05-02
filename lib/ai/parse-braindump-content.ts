import { invokeLlmText } from "@/lib/ai/invoke";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { extractMoodSignal } from "@/lib/ai/extract-mood-signal";
import type { MoodSignal } from "@/lib/db/schema/instagram-competitive";
import type { ParsedContentIdea } from "./parse-braindump";
import { CONTENT_TYPES, type ContentType } from "@/lib/db/schema/content-studio";

export type {
  ContentIdeaSummary,
  AnalyzedContent,
  KeywordResult,
  OutlineSection,
  OutlineResult,
  BlogDraftResult,
  DerivedSocialPost,
  ParsedBlogIdea,
  ContentParsedBraindump,
} from "./parse-braindump-content-types";

import type {
  ContentIdeaSummary,
  AnalyzedContent,
  KeywordResult,
  OutlineSection,
  OutlineResult,
  BlogDraftResult,
  DerivedSocialPost,
  ParsedBlogIdea,
  ContentParsedBraindump,
} from "./parse-braindump-content-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(n: unknown): number {
  const v = typeof n === "number" ? n : 0;
  return Math.max(0, Math.min(1, v));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Stage 1: Analyze and segment ideas
// ---------------------------------------------------------------------------

export async function analyzeContentIdeas(
  rawText: string,
): Promise<AnalyzedContent> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls are disabled (kill switch).");
  }

  const prompt = `You are a content strategist for SuperBad Marketing. Analyze this braindump and decide how to split it into blog post ideas.

RULES:
- If the text contains multiple DISTINCT topics targeting different keywords, split them into separate ideas.
- If the topics are thematically related and would make a stronger single post, bundle them.
- Each idea should be a viable standalone blog post topic.
- Include a one-line rationale for your split/bundle decision.

Respond with ONLY valid JSON, no markdown fencing:
{
  "ideas": [
    {
      "summary": "one-line summary of the blog post idea",
      "raw_fragment": "the relevant portion of the original text for this idea"
    }
  ],
  "split_rationale": "why you split or bundled these ideas"
}

BRAINDUMP TEXT:
${rawText}`;

  const responseText = await invokeLlmText({
    job: "braindump-content-analyze",
    prompt,
    maxTokens: 2048,
  });

  let parsed: { ideas: { summary: string; raw_fragment: string }[]; split_rationale: string };
  try {
    const cleaned = responseText.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to analyze content ideas.");
  }

  if (!Array.isArray(parsed.ideas)) {
    parsed.ideas = [];
  }

  const ideas: ContentIdeaSummary[] = parsed.ideas.map((idea, i) => ({
    id: `blog-${i}-${Date.now()}`,
    summary: idea.summary || `Idea ${i + 1}`,
    raw_fragment: idea.raw_fragment || rawText,
  }));

  return {
    ideas,
    split_rationale: parsed.split_rationale || "",
  };
}

// ---------------------------------------------------------------------------
// Stage 2: Infer keywords
// ---------------------------------------------------------------------------

export async function inferKeywords(
  ideas: ContentIdeaSummary[],
): Promise<KeywordResult[]> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls are disabled (kill switch).");
  }

  const ideaList = ideas
    .map((idea, i) => `[${i}] "${idea.summary}" — ${idea.raw_fragment.slice(0, 200)}`)
    .join("\n");

  const prompt = `You are an SEO strategist for SuperBad Marketing, a Melbourne-based performance marketing and media agency. For each blog post idea below, suggest the single best keyword target.

Pick keywords that:
- Have realistic search volume for a marketing agency blog
- Are specific enough to rank (not "marketing" or "advertising")
- Match the idea's angle and audience (small business owners in Australia)

Ideas:
${ideaList}

Respond with ONLY valid JSON, no markdown fencing:
{
  "keywords": [
    { "index": 0, "keyword": "facebook ads small business australia" }
  ]
}`;

  const responseText = await invokeLlmText({
    job: "braindump-content-keywords",
    prompt,
    maxTokens: 1024,
  });

  let parsed: { keywords: { index: number; keyword: string }[] };
  try {
    const cleaned = responseText.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to infer keywords.");
  }

  return (parsed.keywords ?? []).map((kw) => ({
    idea_id: ideas[kw.index]?.id ?? ideas[0].id,
    keyword: kw.keyword || "marketing",
  }));
}

// ---------------------------------------------------------------------------
// Stage 3: Generate outlines (Haiku)
// ---------------------------------------------------------------------------

export async function generateBlogOutlines(
  ideas: ContentIdeaSummary[],
  keywords: KeywordResult[],
): Promise<OutlineResult[]> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls are disabled (kill switch).");
  }

  const results: OutlineResult[] = [];

  for (const idea of ideas) {
    const keyword = keywords.find((k) => k.idea_id === idea.id)?.keyword ?? "marketing";

    const prompt = `You are a blog outline generator for SuperBad Marketing. Create a structured outline for a blog post.

TOPIC: ${idea.summary}
KEYWORD TARGET: ${keyword}
RAW NOTES: ${idea.raw_fragment}

RULES:
- 4-7 sections, each with 2-4 key points
- Lead with a direct answer to the search query (AI search citation tuning)
- Estimate total word count (aim for 800-1500 words)
- Flag if there's a featured snippet opportunity

Respond with ONLY valid JSON, no markdown fencing:
{
  "outline": [
    { "section": "section heading", "key_points": ["point 1", "point 2"] }
  ],
  "word_count": 1200,
  "snippet_opportunity": true
}`;

    const responseText = await invokeLlmText({
      job: "braindump-content-outline",
      prompt,
      maxTokens: 2048,
    });

    let parsed: { outline: OutlineSection[]; word_count: number; snippet_opportunity: boolean };
    try {
      const cleaned = responseText.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        outline: [{ section: idea.summary, key_points: [idea.raw_fragment.slice(0, 100)] }],
        word_count: 1000,
        snippet_opportunity: false,
      };
    }

    results.push({
      idea_id: idea.id,
      outline: Array.isArray(parsed.outline) ? parsed.outline : [],
      word_count: typeof parsed.word_count === "number" ? parsed.word_count : 1000,
      snippet_opportunity: !!parsed.snippet_opportunity,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Stage 4: Generate full blog drafts (Opus)
// ---------------------------------------------------------------------------

export async function generateBlogDrafts(
  ideas: ContentIdeaSummary[],
  keywords: KeywordResult[],
  outlines: OutlineResult[],
): Promise<BlogDraftResult[]> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls are disabled (kill switch).");
  }

  const results: BlogDraftResult[] = [];

  for (const idea of ideas) {
    const keyword = keywords.find((k) => k.idea_id === idea.id)?.keyword ?? "marketing";
    const outline = outlines.find((o) => o.idea_id === idea.id);

    const outlineText = outline
      ? outline.outline
          .map((s) => `## ${s.section}\n${s.key_points.map((p) => `- ${p}`).join("\n")}`)
          .join("\n\n")
      : idea.raw_fragment;

    const prompt = `You are a blog writer for SuperBad Marketing, a Melbourne-based performance marketing and media agency run by Andy Robinson.

VOICE: Dry, observational, self-deprecating, slow burn. Never explain the joke. Short sentences. No jargon. Ban: synergy, leverage, solutions, elevate, game-changer. No em dashes — use commas, full stops, or restructure.

TOPIC: ${idea.summary}
KEYWORD TARGET: ${keyword}
TARGET WORD COUNT: ${outline?.word_count ?? 1200}

OUTLINE:
${outlineText}

RAW NOTES FROM ANDY:
${idea.raw_fragment}

RULES:
1. Lead the opening paragraph with a direct, factual answer to the search query. "X is Y because Z" structure. This maximises AI search citation.
2. Write in markdown. Use ## for section headings matching the outline.
3. Write naturally — this should read like Andy wrote it, not an AI.
4. Include a meta description (under 160 chars, keyword included).
5. Suggest a URL slug (lowercase, hyphens, under 60 chars).
6. If there's a featured snippet opportunity, write that section as a concise answer block.

Respond with ONLY valid JSON, no markdown fencing:
{
  "title": "blog post title with keyword",
  "body_markdown": "full markdown blog post",
  "meta_description": "under 160 chars",
  "slug": "url-slug",
  "snippet_target_section": "the section heading that targets the snippet, or null"
}`;

    const responseText = await invokeLlmText({
      job: "braindump-content-draft",
      prompt,
      maxTokens: 8192,
    });

    let parsed: {
      title: string;
      body_markdown: string;
      meta_description: string;
      slug: string;
      snippet_target_section: string | null;
    };
    try {
      const cleaned = responseText.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`Failed to generate blog draft for: ${idea.summary}`);
    }

    results.push({
      idea_id: idea.id,
      title: parsed.title || idea.summary,
      body_markdown: parsed.body_markdown || "",
      meta_description: parsed.meta_description || "",
      slug: parsed.slug || slugify(idea.summary),
      snippet_target_section: parsed.snippet_target_section ?? null,
    });
  }

  await logActivity({
    kind: "braindump_parsed",
    body: `Content braindump drafted — ${results.length} blog post${results.length === 1 ? "" : "s"}`,
    meta: { blog_count: results.length, type: "content" },
    createdBy: "system",
  });

  return results;
}

// ---------------------------------------------------------------------------
// Stage 5: Derive social posts from blog drafts (Haiku)
// ---------------------------------------------------------------------------

export async function deriveSocialPosts(
  blogDrafts: BlogDraftResult[],
): Promise<DerivedSocialPost[]> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls are disabled (kill switch).");
  }

  const results: DerivedSocialPost[] = [];

  for (const draft of blogDrafts) {
    const bodyPreview = draft.body_markdown.slice(0, 2000);

    const prompt = `You are a social media content strategist for SuperBad Marketing. Create Instagram post ideas derived from this blog post. Static posts and carousels only — no video, no motion.

BLOG TITLE: ${draft.title}
BLOG CONTENT (excerpt):
${bodyPreview}

CONTENT TYPES (pick best fit per post):
- "anti_motivation" — dry, typography-forward posts that reframe grind as proof of progress
- "tips" — practical marketing advice or observations
- "portfolio" — showcasing work, behind-the-camera perspective
- "behind_the_scenes" — process, setup, studio, day-in-the-life
- "announcement" — business news, launches, offers
- "testimonial" — client results or social proof

RULES:
- Create 1-3 social posts that promote or repurpose the blog content.
- Each post should stand alone (someone who hasn't read the blog should still get value).
- Suggest slide_count: 1 for single posts, 3-10 for carousels.

Respond with ONLY valid JSON, no markdown fencing:
{
  "posts": [
    { "brief": "1-2 sentence creative brief", "content_type": "tips", "slide_count": 1, "confidence": 0.85 }
  ]
}`;

    const responseText = await invokeLlmText({
      job: "braindump-content-social",
      prompt,
      maxTokens: 2048,
    });

    let parsed: { posts: { brief: string; content_type: string; slide_count: number; confidence: number }[] };
    try {
      const cleaned = responseText.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { posts: [] };
    }

    for (const post of parsed.posts ?? []) {
      const validType = (CONTENT_TYPES as readonly string[]).includes(post.content_type)
        ? (post.content_type as ContentType)
        : "tips";
      const slideCount = typeof post.slide_count === "number" && post.slide_count >= 1
        ? Math.min(post.slide_count, 10)
        : 1;

      results.push({
        blog_idea_id: draft.idea_id,
        brief: post.brief || "Untitled social post",
        content_type: validType,
        slide_count: slideCount,
        confidence: clamp01(post.confidence),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Mood signal extraction (shared)
// ---------------------------------------------------------------------------

export async function extractContentMoodSignal(
  rawText: string,
): Promise<MoodSignal | null> {
  return extractMoodSignal(rawText).catch(() => null);
}
