import { invokeLlmText } from "@/lib/ai/invoke";

export interface OptimisedPrompt {
  prompt: string;
  cameraDirection: string;
  lighting: string;
  composition: string;
  negativePrompt: string;
}

export async function optimiseForHiggsfield(
  userBrief: string,
  resolvedPrompt: string,
  mood?: string,
  aspectRatio?: string,
): Promise<OptimisedPrompt> {
  const result = await invokeLlmText({
    job: "video-prompt-optimise",
    system: `You are a cinematographer writing generation prompts for an AI video model (Seedance/Higgsfield). Your prompts must be specific, visual, and technically grounded. Never use marketing language. Describe what the camera sees, not what the brand wants.

RULES:
- Lead with camera movement and framing (dolly, pan, rack focus, static wide, handheld close-up)
- Include lighting direction and quality (golden hour backlight, soft overcast, hard top-down, practical tungsten)
- Specify composition and depth (foreground blur, deep focus, rule of thirds, center frame, negative space)
- Include texture and atmosphere (film grain, lens flare, haze, dust motes, bokeh)
- End with a negative prompt listing what to avoid (text overlays, logos, watermarks, distortion, morphing)
- Keep the final prompt under 200 words — density over length
- The prompt is for a ${aspectRatio ?? "16:9"} frame`,
    prompt: `USER'S ORIGINAL BRIEF: ${userBrief}

BRIEF BUILDER'S RESOLVED PROMPT: ${resolvedPrompt}

${mood ? `MOOD: ${mood}` : ""}

Rewrite the resolved prompt into a cinematographer-grade generation prompt. Respond as JSON only:
{
  "prompt": "the optimised generation prompt",
  "camera_direction": "primary camera movement",
  "lighting": "lighting setup description",
  "composition": "framing and composition notes",
  "negative_prompt": "what to avoid"
}`,
    maxTokens: 600,
  });

  const cleaned = result
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  return {
    prompt: String(parsed.prompt ?? resolvedPrompt),
    cameraDirection: String(parsed.camera_direction ?? ""),
    lighting: String(parsed.lighting ?? ""),
    composition: String(parsed.composition ?? ""),
    negativePrompt: String(parsed.negative_prompt ?? ""),
  };
}
