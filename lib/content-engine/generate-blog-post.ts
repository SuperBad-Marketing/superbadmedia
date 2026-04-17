/**
 * Content Engine — blog post generation (spec §2.1 Stage 3).
 *
 * Opus two-pass pipeline: outline (already generated in CE-2) → full blog
 * post. Brand DNA full profile injected as system context per discipline #44.
 * Drift check via §11.5 `checkBrandVoiceDrift()` with one auto-regen attempt.
 *
 * Owner: CE-3. Consumer: `content_generate_draft` scheduled-task handler (CE-4).
 */
import { randomUUID } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentTopics } from "@/lib/db/schema/content-topics";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import type { TopicOutline } from "./topic-queue";
import type { ContentGap } from "./rankability";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BlogPostDraft {
  title: string;
  slug: string;
  body: string;
  metaDescription: string;
  structuredData: Record<string, unknown>;
  internalLinks: string[];
  snippetTargetSection: string | null;
}

export type GenerateResult =
  | { ok: true; postId: string }
  | { ok: false; reason: "no_topic" | "kill_switch" | "already_generating" | "generation_failed" };

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a blog post for a company. Picks the top queued topic (or uses
 * the provided topicId), runs Opus generation, drift-checks, and inserts
 * the blog_posts row with status `in_review`.
 *
 * Enforces discipline #47: one unreviewed draft maximum per owner.
 */
export async function generateBlogPost(
  companyId: string,
  topicId?: string,
): Promise<GenerateResult> {
  if (!killSwitches.content_automations_enabled) {
    return { ok: false, reason: "kill_switch" };
  }

  // Discipline #47 — one unreviewed draft max per owner
  const existing = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.company_id, companyId),
        eq(blogPosts.status, "in_review"),
      ),
    )
    .limit(1)
    .get();

  if (existing) {
    return { ok: false, reason: "already_generating" };
  }

  // Resolve topic
  const topic = topicId
    ? await db
        .select()
        .from(contentTopics)
        .where(
          and(
            eq(contentTopics.id, topicId),
            eq(contentTopics.company_id, companyId),
            eq(contentTopics.status, "queued"),
          ),
        )
        .get()
    : await db
        .select()
        .from(contentTopics)
        .where(
          and(
            eq(contentTopics.company_id, companyId),
            eq(contentTopics.status, "queued"),
          ),
        )
        .orderBy(desc(contentTopics.rankability_score))
        .limit(1)
        .get();

  if (!topic) {
    return { ok: false, reason: "no_topic" };
  }

  // Transition topic → generating
  await db
    .update(contentTopics)
    .set({ status: "generating" })
    .where(eq(contentTopics.id, topic.id));

  try {
    const brandDna = await loadFullBrandDna(companyId);
    const outline = topic.outline as TopicOutline | null;
    const contentGaps = topic.content_gaps as ContentGap[] | null;
    const serpSnapshot = topic.serp_snapshot as { results?: Array<{ title: string; link: string; snippet: string }> } | null;

    // First generation attempt
    let draft = await callOpusBlogGeneration(
      topic.keyword,
      outline,
      contentGaps,
      serpSnapshot,
      brandDna,
    );

    // Drift check (§11.5) — auto-regen once on failure
    const driftProfile = buildDriftProfile(brandDna);
    let driftResult = await checkBrandVoiceDrift(draft.body, driftProfile);

    if (!driftResult.pass) {
      draft = await callOpusBlogGeneration(
        topic.keyword,
        outline,
        contentGaps,
        serpSnapshot,
        brandDna,
      );
      driftResult = await checkBrandVoiceDrift(draft.body, driftProfile);
    }

    const now = Date.now();
    const postId = randomUUID();

    await db.insert(blogPosts).values({
      id: postId,
      company_id: companyId,
      topic_id: topic.id,
      title: draft.title,
      slug: draft.slug,
      body: draft.body,
      meta_description: draft.metaDescription,
      structured_data: draft.structuredData,
      internal_links: draft.internalLinks,
      snippet_target_section: draft.snippetTargetSection,
      status: "in_review",
      created_at_ms: now,
      updated_at_ms: now,
    });

    // Transition topic → generated
    await db
      .update(contentTopics)
      .set({ status: "generated" })
      .where(eq(contentTopics.id, topic.id));

    await logActivity({
      companyId,
      kind: "content_draft_generated",
      body: `Blog post draft generated for "${topic.keyword}"${!driftResult.pass ? " (voice drift flagged)" : ""}`,
      meta: {
        post_id: postId,
        topic_id: topic.id,
        keyword: topic.keyword,
        drift_passed: driftResult.pass,
        drift_score: driftResult.score,
      },
    });

    return { ok: true, postId };
  } catch {
    // Revert topic on failure so it can be retried
    await db
      .update(contentTopics)
      .set({ status: "queued" })
      .where(eq(contentTopics.id, topic.id));

    return { ok: false, reason: "generation_failed" };
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

interface FullBrandDna {
  prosePortrait: string | null;
  firstImpression: string | null;
  signalTags: Record<string, unknown> | null;
  voiceDescription: string;
  toneMarkers: string[];
  avoidWords: string[];
}

async function loadFullBrandDna(companyId: string): Promise<FullBrandDna> {
  const row = await db
    .select({
      prose_portrait: brand_dna_profiles.prose_portrait,
      first_impression: brand_dna_profiles.first_impression,
      signal_tags: brand_dna_profiles.signal_tags,
    })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.company_id, companyId),
        eq(brand_dna_profiles.status, "complete"),
        eq(brand_dna_profiles.is_current, true),
      ),
    )
    .orderBy(desc(brand_dna_profiles.updated_at_ms))
    .limit(1)
    .get();

  if (!row) {
    return {
      prosePortrait: null,
      firstImpression: null,
      signalTags: null,
      voiceDescription: "professional, clear, and approachable",
      toneMarkers: ["professional", "clear"],
      avoidWords: [],
    };
  }

  const tags = row.signal_tags
    ? (JSON.parse(typeof row.signal_tags === "string" ? row.signal_tags : JSON.stringify(row.signal_tags)) as Record<string, unknown>)
    : null;

  // Extract voice descriptors from signal tags if available
  const voiceObj = tags?.voice as Record<string, number> | undefined;
  const toneObj = tags?.tone as Record<string, number> | undefined;
  const avoidObj = tags?.avoid as Record<string, number> | undefined;

  return {
    prosePortrait: row.prose_portrait,
    firstImpression: row.first_impression,
    signalTags: tags,
    voiceDescription:
      voiceObj
        ? Object.keys(voiceObj).slice(0, 5).join(", ")
        : "professional, clear, and approachable",
    toneMarkers: toneObj ? Object.keys(toneObj).slice(0, 5) : ["professional"],
    avoidWords: avoidObj ? Object.keys(avoidObj) : [],
  };
}

function buildDriftProfile(brandDna: FullBrandDna) {
  return {
    voiceDescription: brandDna.voiceDescription,
    toneMarkers: brandDna.toneMarkers,
    avoidWords: brandDna.avoidWords.length > 0 ? brandDna.avoidWords : undefined,
  };
}

function buildSystemPrompt(brandDna: FullBrandDna): string {
  const parts: string[] = [
    "You are a blog post writer. Your job is to produce a complete, publication-ready blog post that sounds exactly like the brand it represents.",
  ];

  if (brandDna.prosePortrait) {
    parts.push(`\nBRAND VOICE PORTRAIT:\n${brandDna.prosePortrait}`);
  }
  if (brandDna.firstImpression) {
    parts.push(`\nFIRST IMPRESSION:\n${brandDna.firstImpression}`);
  }
  if (brandDna.signalTags) {
    parts.push(`\nBRAND SIGNAL TAGS:\n${JSON.stringify(brandDna.signalTags)}`);
  }

  parts.push(
    "\nWrite in the brand's authentic voice. Never sound generic, templated, or like typical AI content. Match the tone markers precisely.",
  );

  return parts.join("\n");
}

function buildUserPrompt(
  keyword: string,
  outline: TopicOutline | null,
  contentGaps: ContentGap[] | null,
  serpSnapshot: { results?: Array<{ title: string; link: string; snippet: string }> } | null,
): string {
  const parts: string[] = [
    `Write a complete, publication-ready blog post targeting the keyword "${keyword}".`,
  ];

  if (outline) {
    parts.push(
      `\nOUTLINE TO FOLLOW:\n${outline.sections.map((s, i) => `${i + 1}. ${s.heading}\n   Key points: ${s.keyPoints.join(", ")}\n   Target: ~${s.estimatedWords} words`).join("\n")}`,
    );
    parts.push(`\nTarget total word count: ~${outline.targetWordCount}`);
    if (outline.featuredSnippetOpportunity) {
      parts.push(
        `\nFEATURED SNIPPET OPPORTUNITY: This keyword has a ${outline.featuredSnippetType ?? "paragraph"} snippet opportunity. Write the relevant section to directly answer the search query in a concise, authoritative format.`,
      );
    }
  }

  if (contentGaps && contentGaps.length > 0) {
    parts.push(
      `\nCONTENT GAPS TO EXPLOIT (angles competitors miss):\n${contentGaps.map((g) => `- ${g.angle}: ${g.reasoning}`).join("\n")}`,
    );
  }

  if (serpSnapshot?.results && serpSnapshot.results.length > 0) {
    parts.push(
      `\nCOMPETITOR TITLES (for context, do not copy):\n${serpSnapshot.results.slice(0, 5).map((r) => `- ${r.title}`).join("\n")}`,
    );
  }

  parts.push(`
Respond in this exact JSON format (no markdown fencing):
{
  "title": "Blog post title (SEO-optimised, 50-65 chars)",
  "slug": "url-friendly-slug-derived-from-title",
  "body": "Full blog post in markdown. Use ## for H2, ### for H3. Include a table of contents at the top as a bullet list of section links.",
  "metaDescription": "155-char meta description targeting the keyword",
  "structuredData": { "@context": "https://schema.org", "@type": "Article", "headline": "...", "description": "...", "datePublished": "${new Date().toISOString().split("T")[0]}", "author": { "@type": "Organization", "name": "..." } },
  "internalLinks": ["suggested-related-slug-1", "suggested-related-slug-2"],
  "snippetTargetSection": "The exact heading of the section targeting the featured snippet, or null"
}`);

  return parts.join("\n");
}

function parseBlogDraftResponse(raw: string): BlogPostDraft {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const title = String(parsed.title ?? "Untitled");
  const rawSlug = String(parsed.slug ?? title);
  const slug = rawSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    title,
    slug,
    body: String(parsed.body ?? ""),
    metaDescription: String(parsed.metaDescription ?? ""),
    structuredData:
      typeof parsed.structuredData === "object" && parsed.structuredData !== null
        ? (parsed.structuredData as Record<string, unknown>)
        : {},
    internalLinks: Array.isArray(parsed.internalLinks)
      ? parsed.internalLinks.map(String)
      : [],
    snippetTargetSection:
      typeof parsed.snippetTargetSection === "string"
        ? parsed.snippetTargetSection
        : null,
  };
}

async function callOpusBlogGeneration(
  keyword: string,
  outline: TopicOutline | null,
  contentGaps: ContentGap[] | null,
  serpSnapshot: { results?: Array<{ title: string; link: string; snippet: string }> } | null,
  brandDna: FullBrandDna,
): Promise<BlogPostDraft> {
  const systemPrompt = buildSystemPrompt(brandDna);
  const userPrompt = buildUserPrompt(keyword, outline, contentGaps, serpSnapshot);

  const raw = await invokeLlmText({
    job: "content-generate-blog-post",
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 8000,
  });

  return parseBlogDraftResponse(raw);
}
