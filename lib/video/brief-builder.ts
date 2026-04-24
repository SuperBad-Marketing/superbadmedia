import { invokeLlmText } from "@/lib/ai/invoke";
import type { VideoType } from "@/lib/db/schema/video-jobs";

export interface VideoBrief {
  videoType: VideoType;
  engine: "higgsfield" | "remotion";
  resolvedPrompt: string;
  aspectRatio: string;
  duration: number;
  mood: string;
  pacing: string;
  colorPalette: string;
  animationEnergy?: string;
  hookStyle?: string;
  platform?: string;
  typographyStyle?: string;
}

export async function buildBriefFromPrompt(
  initialPrompt: string,
  brandContext?: { name: string; colors?: string; voice?: string },
): Promise<VideoBrief> {
  const brandSection = brandContext
    ? `\nBRAND CONTEXT:\n- Brand: ${brandContext.name}\n- Colors: ${brandContext.colors ?? "not specified"}\n- Voice: ${brandContext.voice ?? "not specified"}`
    : "\nBRAND: SuperBad Marketing (bold, dry, cinematic, premium)";

  const prompt = `You are a video production brief builder. Analyse the user's request and produce a structured brief.

VIDEO TYPES AND ENGINE MAPPING:
- "cinematic" → higgsfield (brand films, mood pieces, hero content — sweeping, atmospheric, emotional)
- "motion_design" → remotion (animated graphics, kinetic typography, data viz — precise, repeatable)
- "product_showcase" → higgsfield (product reveals, demos — focused, clean, professional)
- "social_short" → remotion for template-driven (quote cards, stats) OR higgsfield for creative (trending hooks, organic feel)
- "talking_head" → higgsfield (presenter-style, explainer content)

Choose the video type and engine that best matches the request. If ambiguous, default to higgsfield.
${brandSection}

USER REQUEST: ${initialPrompt}

Respond as JSON only — no prose, no fences:
{
  "video_type": "cinematic"|"motion_design"|"product_showcase"|"social_short"|"talking_head",
  "engine": "higgsfield"|"remotion",
  "resolved_prompt": "detailed generation prompt optimised for the chosen engine",
  "aspect_ratio": "16:9"|"9:16"|"1:1"|"4:5",
  "duration": 5,
  "mood": "short mood description",
  "pacing": "slow"|"medium"|"fast"|"dynamic",
  "color_palette": "dominant colors or palette description",
  "animation_energy": "subtle"|"moderate"|"high" (motion_design/social_short only),
  "hook_style": "text hook"|"visual hook"|"pattern interrupt" (social_short only),
  "platform": "instagram"|"tiktok"|"youtube"|"linkedin" (social_short only),
  "typography_style": "bold"|"minimal"|"editorial" (motion_design only)
}`;

  const result = await invokeLlmText({
    job: "video-brief-builder",
    system: "You are a video production expert. Respond only in the requested JSON format.",
    prompt,
    maxTokens: 500,
  });

  const cleaned = result
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  return {
    videoType: parsed.video_type as VideoType,
    engine: parsed.engine as "higgsfield" | "remotion",
    resolvedPrompt: String(parsed.resolved_prompt ?? initialPrompt),
    aspectRatio: String(parsed.aspect_ratio ?? "16:9"),
    duration: Number(parsed.duration ?? 5),
    mood: String(parsed.mood ?? ""),
    pacing: String(parsed.pacing ?? "medium"),
    colorPalette: String(parsed.color_palette ?? ""),
    animationEnergy: parsed.animation_energy
      ? String(parsed.animation_energy)
      : undefined,
    hookStyle: parsed.hook_style ? String(parsed.hook_style) : undefined,
    platform: parsed.platform ? String(parsed.platform) : undefined,
    typographyStyle: parsed.typography_style
      ? String(parsed.typography_style)
      : undefined,
  };
}
