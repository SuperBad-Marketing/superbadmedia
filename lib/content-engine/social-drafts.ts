/**
 * Content Engine — social draft generation (spec §5).
 *
 * For each platform (Instagram, LinkedIn, X, Facebook), Haiku generates
 * platform-specific text + decides format (single/carousel). Inserts
 * `social_drafts` rows with status `generating`.
 *
 * Visual asset generation is handled by `visual-assets.ts` (separate step).
 *
 * Owner: CE-5. Consumer: `content_fan_out` handler (CE-6).
 */
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { socialDrafts, SOCIAL_PLATFORMS, type SocialPlatform, type SocialDraftFormat } from "@/lib/db/schema/social-drafts";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmText } from "@/lib/ai/invoke";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SocialDraftOutput {
  platform: SocialPlatform;
  text: string;
  format: SocialDraftFormat;
  hashtags: string[];
  carouselSlides: CarouselSlide[] | null;
}

export interface CarouselSlide {
  headline: string;
  body: string;
  slideNumber: number;
}

export type GenerateSocialResult =
  | { ok: true; draftIds: string[] }
  | { ok: false; reason: "kill_switch" | "post_not_found" | "no_brand_dna" };

// ── Platform specs ───────────────────────────────────────────────────────────

const PLATFORM_SPECS: Record<SocialPlatform, {
  register: string;
  formats: string;
  imageOrientation: string;
  hashtagGuidance: string;
  maxLength: number;
}> = {
  instagram: {
    register: "casual, engaging, visual-first",
    formats: "single image or carousel (multi-slide). Choose carousel when the content has 3+ distinct points, a listicle structure, or step-by-step information.",
    imageOrientation: "square (1080x1080) or portrait (1080x1350)",
    hashtagGuidance: "Include 5-15 relevant hashtags. Mix broad and niche.",
    maxLength: 2200,
  },
  linkedin: {
    register: "professional, insightful, conversational but authoritative",
    formats: "single image only. LinkedIn carousels use PDF documents which we do not generate here.",
    imageOrientation: "landscape (1200x627) or square (1080x1080)",
    hashtagGuidance: "Include 3-5 industry-standard hashtags only if they add discoverability.",
    maxLength: 3000,
  },
  x: {
    register: "concise, punchy, direct. Thread format for longer content — lead with the hook.",
    formats: "single image only (v1). If content is rich, structure as a thread (each tweet separated by ---THREAD--- delimiter).",
    imageOrientation: "landscape card (1200x675)",
    hashtagGuidance: "0-2 hashtags maximum. Only if highly relevant.",
    maxLength: 280,
  },
  facebook: {
    register: "conversational, warm, community-oriented",
    formats: "single image only.",
    imageOrientation: "landscape (1200x630)",
    hashtagGuidance: "Minimal hashtags. 0-3 at most.",
    maxLength: 5000,
  },
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate social drafts for all four platforms from a published blog post.
 * Each draft is a separate Haiku call for platform-appropriate voice.
 */
export async function generateSocialDrafts(
  blogPostId: string,
): Promise<GenerateSocialResult> {
  if (!killSwitches.content_automations_enabled) {
    return { ok: false, reason: "kill_switch" };
  }

  const post = await db
    .select({
      id: blogPosts.id,
      company_id: blogPosts.company_id,
      title: blogPosts.title,
      body: blogPosts.body,
      meta_description: blogPosts.meta_description,
      slug: blogPosts.slug,
      published_url: blogPosts.published_url,
    })
    .from(blogPosts)
    .where(eq(blogPosts.id, blogPostId))
    .get();

  if (!post) {
    return { ok: false, reason: "post_not_found" };
  }

  const brandDna = await loadBrandDnaForSocial(post.company_id);
  if (!brandDna) {
    return { ok: false, reason: "no_brand_dna" };
  }

  const draftIds: string[] = [];
  const now = Date.now();

  for (const platform of SOCIAL_PLATFORMS) {
    const draft = await generateSinglePlatformDraft(
      post,
      platform,
      brandDna,
    );

    const id = randomUUID();
    await db.insert(socialDrafts).values({
      id,
      blog_post_id: blogPostId,
      platform,
      text: draft.text,
      format: draft.format,
      carousel_slides: draft.carouselSlides,
      status: "generating", // visual assets still pending
      created_at_ms: now,
    });

    draftIds.push(id);
  }

  await logActivity({
    companyId: post.company_id,
    kind: "content_social_draft_generated",
    body: `Social drafts generated for "${post.title}" across ${SOCIAL_PLATFORMS.length} platforms`,
    meta: {
      blog_post_id: blogPostId,
      draft_ids: draftIds,
      platforms: [...SOCIAL_PLATFORMS],
    },
  });

  return { ok: true, draftIds };
}

/**
 * Retrieve all social drafts for a blog post, optionally filtered by status.
 */
export async function listSocialDrafts(
  blogPostId: string,
  status?: "generating" | "ready" | "published",
) {
  const conditions = [eq(socialDrafts.blog_post_id, blogPostId)];
  if (status) {
    conditions.push(eq(socialDrafts.status, status));
  }
  return db
    .select()
    .from(socialDrafts)
    .where(and(...conditions))
    .all();
}

// ── Internal helpers ─────────────────────────────────────────────────────────

interface BrandDnaSocial {
  voiceDescription: string;
  toneMarkers: string[];
  avoidWords: string[];
  signalTags: Record<string, unknown> | null;
}

async function loadBrandDnaForSocial(
  companyId: string,
): Promise<BrandDnaSocial | null> {
  const row = await db
    .select({
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
    .limit(1)
    .get();

  if (!row) return null;

  const tags = row.signal_tags
    ? (JSON.parse(
        typeof row.signal_tags === "string"
          ? row.signal_tags
          : JSON.stringify(row.signal_tags),
      ) as Record<string, unknown>)
    : null;

  const voiceObj = tags?.voice as Record<string, number> | undefined;
  const toneObj = tags?.tone as Record<string, number> | undefined;
  const avoidObj = tags?.avoid as Record<string, number> | undefined;

  return {
    voiceDescription: voiceObj
      ? Object.keys(voiceObj).slice(0, 5).join(", ")
      : "professional, clear, and approachable",
    toneMarkers: toneObj ? Object.keys(toneObj).slice(0, 5) : ["professional"],
    avoidWords: avoidObj ? Object.keys(avoidObj) : [],
    signalTags: tags,
  };
}

interface PostData {
  title: string;
  body: string;
  meta_description: string | null;
  slug: string;
  published_url: string | null;
}

async function generateSinglePlatformDraft(
  post: PostData,
  platform: SocialPlatform,
  brandDna: BrandDnaSocial,
): Promise<SocialDraftOutput> {
  const spec = PLATFORM_SPECS[platform];

  // Truncate body for prompt context (first 2000 chars)
  const bodyExcerpt = post.body.length > 2000
    ? post.body.slice(0, 2000) + "..."
    : post.body;

  const prompt = `You are a social media copywriter. Generate a ${platform} post based on this blog post.

BRAND VOICE: ${brandDna.voiceDescription}
TONE MARKERS: ${brandDna.toneMarkers.join(", ")}
${brandDna.avoidWords.length > 0 ? `WORDS TO AVOID: ${brandDna.avoidWords.join(", ")}` : ""}

PLATFORM: ${platform}
REGISTER: ${spec.register}
FORMAT OPTIONS: ${spec.formats}
HASHTAG GUIDANCE: ${spec.hashtagGuidance}
MAX TEXT LENGTH: ${spec.maxLength} characters

BLOG POST TITLE: ${post.title}
BLOG POST EXCERPT:
${bodyExcerpt}

${post.meta_description ? `META DESCRIPTION: ${post.meta_description}` : ""}
${post.published_url ? `LINK: ${post.published_url}` : ""}

Respond in this exact JSON format (no markdown fencing):
{
  "text": "The full social media post text. Include the blog link naturally if appropriate.",
  "format": "single" or "carousel",
  "hashtags": ["tag1", "tag2"],
  "carouselSlides": null for single, or [{"headline": "...", "body": "...", "slideNumber": 1}, ...] for carousel (3-8 slides)
}`;

  const raw = await invokeLlmText({
    job: "content-generate-social-draft",
    prompt,
    maxTokens: 2000,
  });

  return parseSocialDraftResponse(raw, platform);
}

function parseSocialDraftResponse(
  raw: string,
  platform: SocialPlatform,
): SocialDraftOutput {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const text = String(parsed.text ?? "");
    const format = parsed.format === "carousel" ? "carousel" : "single";
    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map(String)
      : [];

    let carouselSlides: CarouselSlide[] | null = null;
    if (format === "carousel" && Array.isArray(parsed.carouselSlides)) {
      carouselSlides = parsed.carouselSlides
        .filter(
          (s): s is Record<string, unknown> =>
            typeof s === "object" && s !== null,
        )
        .map((s, i) => ({
          headline: String(s.headline ?? ""),
          body: String(s.body ?? ""),
          slideNumber: typeof s.slideNumber === "number" ? s.slideNumber : i + 1,
        }));
    }

    // Enforce platform constraints: only Instagram gets carousels in v1
    const finalFormat: SocialDraftFormat =
      format === "carousel" && platform !== "instagram" ? "single" : format;

    return {
      platform,
      text,
      format: finalFormat,
      hashtags,
      carouselSlides: finalFormat === "carousel" ? carouselSlides : null,
    };
  } catch {
    // Fallback: use raw text as the post, single format
    return {
      platform,
      text: raw.slice(0, PLATFORM_SPECS[platform].maxLength),
      format: "single",
      hashtags: [],
      carouselSlides: null,
    };
  }
}
