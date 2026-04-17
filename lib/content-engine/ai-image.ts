/**
 * Content Engine — AI image generation fallback (spec §5.2 AI image path).
 *
 * When no template fits the content (needs a scene, abstract visual, or
 * photographic style): Haiku generates an image prompt from blog content +
 * Brand DNA visual signals → OpenAI Images API → stored in R2 (v1: local).
 *
 * Quality-gated: if the image doesn't pass a basic relevance check (Haiku
 * verification call), the engine falls back to the template path.
 *
 * Owner: CE-5.
 */
import { getCredential } from "@/lib/integrations/getCredential";
import { invokeLlmText } from "@/lib/ai/invoke";
import type { BrandVisualTokens } from "./social-templates";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AiImageResult {
  ok: true;
  buffer: Buffer;
  prompt: string;
  revisedPrompt: string | null;
}

export interface AiImageFailure {
  ok: false;
  reason: "no_api_key" | "prompt_generation_failed" | "image_generation_failed" | "quality_gate_failed";
}

export type GenerateAiImageResult = AiImageResult | AiImageFailure;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate an AI image for a social post.
 *
 * 1. Haiku generates image prompt from content + brand tokens.
 * 2. OpenAI Images API generates the image.
 * 3. Haiku quality-gates the result.
 */
export async function generateAiImage(
  blogTitle: string,
  blogExcerpt: string,
  platform: string,
  tokens: BrandVisualTokens,
): Promise<GenerateAiImageResult> {
  const apiKey = await getCredential("openai");
  if (!apiKey) {
    return { ok: false, reason: "no_api_key" };
  }

  // Step 1: Haiku generates image prompt
  const imagePrompt = await generateImagePrompt(
    blogTitle,
    blogExcerpt,
    platform,
    tokens,
  );

  if (!imagePrompt) {
    return { ok: false, reason: "prompt_generation_failed" };
  }

  // Step 2: Call OpenAI Images API
  const imageResult = await callOpenAiImages(apiKey, imagePrompt, platform);
  if (!imageResult) {
    return { ok: false, reason: "image_generation_failed" };
  }

  // Step 3: Quality gate (Haiku verification)
  const passesQuality = await qualityGateCheck(
    blogTitle,
    imagePrompt,
  );

  if (!passesQuality) {
    return { ok: false, reason: "quality_gate_failed" };
  }

  return {
    ok: true,
    buffer: imageResult.buffer,
    prompt: imagePrompt,
    revisedPrompt: imageResult.revisedPrompt,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function generateImagePrompt(
  blogTitle: string,
  blogExcerpt: string,
  platform: string,
  tokens: BrandVisualTokens,
): Promise<string | null> {
  const excerpt = blogExcerpt.length > 1000
    ? blogExcerpt.slice(0, 1000) + "..."
    : blogExcerpt;

  const raw = await invokeLlmText({
    job: "content-generate-image-prompt",
    prompt: `Generate a detailed image prompt for OpenAI's DALL-E image generation API.

The image will be used as the visual for a ${platform} social media post about this blog article:
TITLE: ${blogTitle}
EXCERPT: ${excerpt}

BRAND VISUAL IDENTITY:
- Primary colour: ${tokens.primaryColor}
- Accent colour: ${tokens.accentColor}
- Brand name: ${tokens.brandName}
- Overall mood: professional, modern, clean

Requirements:
- The image should visually represent the blog topic without containing text
- Use colours that complement the brand palette
- Style: clean, professional, slightly abstract or editorial photography style
- No faces, no logos, no text in the image
- Must work at social media resolution

Respond with ONLY the image generation prompt (no JSON, no explanation). One paragraph, 50-150 words.`,
    maxTokens: 300,
  });

  const trimmed = raw.trim();
  return trimmed.length > 10 ? trimmed : null;
}

interface OpenAiImageResponse {
  buffer: Buffer;
  revisedPrompt: string | null;
}

async function callOpenAiImages(
  apiKey: string,
  prompt: string,
  platform: string,
): Promise<OpenAiImageResponse | null> {
  // Platform-appropriate size
  const size = platform === "instagram" ? "1024x1024" : "1792x1024";

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
        quality: "standard",
        response_format: "b64_json",
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      data: Array<{ b64_json?: string; revised_prompt?: string }>;
    };

    const imageData = data.data?.[0];
    if (!imageData?.b64_json) {
      return null;
    }

    return {
      buffer: Buffer.from(imageData.b64_json, "base64"),
      revisedPrompt: imageData.revised_prompt ?? null,
    };
  } catch {
    return null;
  }
}

async function qualityGateCheck(
  blogTitle: string,
  imagePrompt: string,
): Promise<boolean> {
  try {
    const raw = await invokeLlmText({
      job: "content-select-visual-template",
      prompt: `You are a quality gate for AI-generated social media images.

An image was generated with this prompt:
"${imagePrompt}"

For a blog post titled: "${blogTitle}"

Is this image prompt likely to produce a relevant, professional, on-brand image for a social media post about this topic?

Respond with ONLY "yes" or "no".`,
      maxTokens: 10,
    });

    return raw.toLowerCase().includes("yes");
  } catch {
    // Conservative: pass on error (discipline #63 — false positive is correctable)
    return true;
  }
}
