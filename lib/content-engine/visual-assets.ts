/**
 * Content Engine — visual asset orchestration (spec §5.2).
 *
 * For each social draft: Haiku selects template or decides AI generation →
 * render via Puppeteer (template) or OpenAI Images (AI) → store → update
 * `social_drafts` row with asset URLs and transition to `ready`.
 *
 * Owner: CE-5. Consumer: `content_fan_out` handler (CE-6).
 */
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialDrafts, type SocialDraftRow } from "@/lib/db/schema/social-drafts";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import { logActivity } from "@/lib/activity-log";
import {
  renderTemplate,
  renderCarouselTemplate,
  PLATFORM_DIMENSIONS,
  type BrandVisualTokens,
  type TemplateId,
  type ImageDimensions,
} from "./social-templates";
import { renderSocialImage, renderSocialImageBatch } from "./render-social-image";
import { generateAiImage } from "./ai-image";
import { storeContentAsset } from "./asset-storage";
import type { CarouselSlide } from "./social-drafts";

// ── Types ────────────────────────────────────────────────────────────────────

export type VisualResult =
  | { ok: true; assetsGenerated: number }
  | { ok: false; reason: "kill_switch" | "no_drafts" };

interface TemplateSelection {
  useTemplate: true;
  templateId: TemplateId;
  headline: string;
  body: string;
}

interface AiImageSelection {
  useTemplate: false;
}

type VisualSelection = TemplateSelection | AiImageSelection;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate visual assets for all social drafts of a blog post.
 * Updates each draft's `visual_asset_urls` and transitions status to `ready`.
 */
export async function generateVisualAssets(
  blogPostId: string,
): Promise<VisualResult> {
  if (!killSwitches.content_automations_enabled) {
    return { ok: false, reason: "kill_switch" };
  }

  const drafts = await db
    .select()
    .from(socialDrafts)
    .where(
      and(
        eq(socialDrafts.blog_post_id, blogPostId),
        eq(socialDrafts.status, "generating"),
      ),
    )
    .all();

  if (drafts.length === 0) {
    return { ok: false, reason: "no_drafts" };
  }

  const post = await db
    .select({
      title: blogPosts.title,
      body: blogPosts.body,
      company_id: blogPosts.company_id,
    })
    .from(blogPosts)
    .where(eq(blogPosts.id, blogPostId))
    .get();

  if (!post) {
    return { ok: false, reason: "no_drafts" };
  }

  const tokens = await loadBrandVisualTokens(post.company_id);
  let assetsGenerated = 0;

  for (const draft of drafts) {
    const urls = await generateVisualForDraft(
      draft,
      post.title,
      post.body,
      tokens,
    );

    await db
      .update(socialDrafts)
      .set({
        visual_asset_urls: urls,
        status: "ready",
      })
      .where(eq(socialDrafts.id, draft.id));

    assetsGenerated += urls.length;
  }

  await logActivity({
    companyId: post.company_id,
    kind: "content_social_draft_generated",
    body: `Visual assets generated for ${drafts.length} social drafts (${assetsGenerated} images)`,
    meta: {
      blog_post_id: blogPostId,
      assets_generated: assetsGenerated,
      draft_count: drafts.length,
    },
  });

  return { ok: true, assetsGenerated };
}

/**
 * Extract visual tokens from Brand DNA for template rendering.
 * Falls back to SuperBad brand defaults if no Brand DNA exists.
 */
export async function loadBrandVisualTokens(
  companyId: string,
): Promise<BrandVisualTokens> {
  const row = await db
    .select({
      signal_tags: brand_dna_profiles.signal_tags,
      subject_display_name: brand_dna_profiles.subject_display_name,
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

  if (!row?.signal_tags) {
    return SUPERBAD_DEFAULT_TOKENS;
  }

  const tags =
    typeof row.signal_tags === "string"
      ? (JSON.parse(row.signal_tags) as Record<string, unknown>)
      : (row.signal_tags as Record<string, unknown>);

  const visualObj = tags?.visual as Record<string, unknown> | undefined;
  const colorObj = visualObj?.colors as Record<string, string> | undefined;

  return {
    primaryColor: colorObj?.primary ?? SUPERBAD_DEFAULT_TOKENS.primaryColor,
    accentColor: colorObj?.accent ?? SUPERBAD_DEFAULT_TOKENS.accentColor,
    backgroundColor:
      colorObj?.background ?? SUPERBAD_DEFAULT_TOKENS.backgroundColor,
    textColor: colorObj?.text ?? SUPERBAD_DEFAULT_TOKENS.textColor,
    brandName: row.subject_display_name ?? SUPERBAD_DEFAULT_TOKENS.brandName,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** SuperBad brand defaults — used when no Brand DNA visual tokens exist. */
const SUPERBAD_DEFAULT_TOKENS: BrandVisualTokens = {
  primaryColor: "#D14836",
  accentColor: "#E8916E",
  backgroundColor: "#FAF5F0",
  textColor: "#2E2B28",
  brandName: "SuperBad",
};

async function generateVisualForDraft(
  draft: SocialDraftRow,
  blogTitle: string,
  blogBody: string,
  tokens: BrandVisualTokens,
): Promise<string[]> {
  const dims = resolveDimensions(draft.platform);

  // Carousel path: multiple slides
  if (draft.format === "carousel" && draft.carousel_slides) {
    const slides = (
      typeof draft.carousel_slides === "string"
        ? JSON.parse(draft.carousel_slides)
        : draft.carousel_slides
    ) as CarouselSlide[];

    return renderAndStoreCarousel(
      draft.id,
      draft.platform,
      slides,
      tokens,
      dims,
    );
  }

  // Single image path: template selection → render or AI fallback
  const selection = await selectVisualApproach(blogTitle, draft.text, tokens);

  if (selection.useTemplate) {
    return renderAndStoreTemplate(
      draft.id,
      draft.platform,
      selection.templateId,
      selection.headline,
      selection.body,
      tokens,
      dims,
    );
  }

  // AI image fallback
  return renderAndStoreAiImage(
    draft.id,
    draft.platform,
    blogTitle,
    blogBody,
    tokens,
    dims,
  );
}

function resolveDimensions(platform: string): ImageDimensions {
  return PLATFORM_DIMENSIONS[platform] ?? PLATFORM_DIMENSIONS.instagram;
}

async function selectVisualApproach(
  blogTitle: string,
  postText: string,
  tokens: BrandVisualTokens,
): Promise<VisualSelection> {
  try {
    const raw = await invokeLlmText({
      job: "content-select-visual-template",
      prompt: `You are selecting a visual template for a social media image.

BLOG TITLE: ${blogTitle}
POST TEXT: ${postText.slice(0, 500)}

AVAILABLE TEMPLATES:
1. "quote-card" — large pull-quote with accent bar. Best for key insights, memorable quotes, thought-provoking statements.
2. "stat-highlight" — big number or stat with context. Best for data-driven posts, percentages, metrics.
3. "listicle-card" — numbered key point with headline. Best for tips, how-to, list-format posts.
4. "branded-hero" — title-forward with gradient accent. Default/general purpose.

BRAND: ${tokens.brandName}

Which template fits this content best? Or should we use AI image generation instead (for content that needs a scene, photographic image, or abstract visual)?

Respond in this exact JSON format (no markdown fencing):
{
  "useTemplate": true or false,
  "templateId": "quote-card" | "stat-highlight" | "listicle-card" | "branded-hero" (only if useTemplate is true),
  "headline": "short headline for the image" (only if useTemplate is true),
  "body": "supporting text (max 200 chars)" (only if useTemplate is true)
}`,
      maxTokens: 300,
    });

    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    if (parsed.useTemplate === false) {
      return { useTemplate: false };
    }

    const templateId = String(parsed.templateId ?? "branded-hero");
    const validTemplates: TemplateId[] = [
      "quote-card",
      "stat-highlight",
      "listicle-card",
      "branded-hero",
    ];
    const finalTemplate = validTemplates.includes(templateId as TemplateId)
      ? (templateId as TemplateId)
      : "branded-hero";

    return {
      useTemplate: true,
      templateId: finalTemplate,
      headline: String(parsed.headline ?? blogTitle).slice(0, 120),
      body: String(parsed.body ?? "").slice(0, 200),
    };
  } catch {
    // Fallback: branded hero (safest default)
    return {
      useTemplate: true,
      templateId: "branded-hero",
      headline: blogTitle.slice(0, 120),
      body: "",
    };
  }
}

async function renderAndStoreTemplate(
  draftId: string,
  platform: string,
  templateId: TemplateId,
  headline: string,
  body: string,
  tokens: BrandVisualTokens,
  dims: ImageDimensions,
): Promise<string[]> {
  const html = renderTemplate(
    templateId,
    { headline, body, tokens },
    dims,
  );

  const buffer = await renderSocialImage(html, { dimensions: dims });
  const key = `${draftId}/${platform}-1.png`;
  const url = await storeContentAsset(key, buffer);
  return [url];
}

async function renderAndStoreCarousel(
  draftId: string,
  platform: string,
  slides: CarouselSlide[],
  tokens: BrandVisualTokens,
  dims: ImageDimensions,
): Promise<string[]> {
  const htmlSlides = renderCarouselTemplate(
    {
      headline: slides[0]?.headline ?? "",
      body: slides[0]?.body ?? "",
      tokens,
      slides,
    },
    dims,
  );

  const batchItems = htmlSlides.map((html) => ({
    html,
    opts: { dimensions: dims },
  }));

  const buffers = await renderSocialImageBatch(batchItems);
  const urls: string[] = [];

  for (let i = 0; i < buffers.length; i++) {
    const key = `${draftId}/${platform}-${i + 1}.png`;
    const url = await storeContentAsset(key, buffers[i]);
    urls.push(url);
  }

  return urls;
}

async function renderAndStoreAiImage(
  draftId: string,
  platform: string,
  blogTitle: string,
  blogBody: string,
  tokens: BrandVisualTokens,
  dims: ImageDimensions,
): Promise<string[]> {
  const result = await generateAiImage(
    blogTitle,
    blogBody.slice(0, 1000),
    platform,
    tokens,
  );

  if (result.ok) {
    const key = `${draftId}/${platform}-ai.png`;
    const url = await storeContentAsset(key, result.buffer);

    // Store the prompt used for debugging/auditing
    await db
      .update(socialDrafts)
      .set({ image_prompt: result.prompt })
      .where(eq(socialDrafts.id, draftId));

    return [url];
  }

  // AI image failed → fall back to branded-hero template
  const html = renderTemplate(
    "branded-hero",
    { headline: blogTitle.slice(0, 120), body: "", tokens },
    dims,
  );

  const buffer = await renderSocialImage(html, { dimensions: dims });
  const key = `${draftId}/${platform}-fallback.png`;
  const url = await storeContentAsset(key, buffer);
  return [url];
}
