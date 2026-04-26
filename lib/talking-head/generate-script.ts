import { invokeLlmText } from "@/lib/ai/invoke";
import {
  type PillarDef,
  type ScriptFormat,
  type EnergyLevel,
} from "@/lib/db/schema/talking-head";

export interface ScriptBlock {
  text: string;
  cue: "pause" | "slower" | "land_it" | null;
}

export interface ScriptSegment {
  number: number;
  duration_hint_sec: number;
  blocks: ScriptBlock[];
  b_cam_after: boolean;
}

export interface GeneratedShortScript {
  format: "short";
  title: string;
  hook: string;
  estimated_duration_sec: number;
  blocks: ScriptBlock[];
}

export interface GeneratedMidScript {
  format: "mid";
  title: string;
  hook: string;
  estimated_duration_sec: number;
  segments: ScriptSegment[];
}

export type GeneratedScript = GeneratedShortScript | GeneratedMidScript;

export interface EditBrief {
  cut_style: string;
  b_cam_moments: string[];
  text_overlays: Array<{ segment?: number; text: string; style: string }>;
  thumbnail: { concept: string; style: string };
  music_note: string;
  pacing_note: string;
}

export interface PublishMeta {
  platforms: string[];
  caption: string;
  hashtags: string[];
  suggested_post_time: string | null;
  cross_post_notes: string;
}

function energyGuidance(energy: EnergyLevel): string {
  if (energy === "low_battery") {
    return `Energy: LOW BATTERY. Write shorter sentences, more fragments, more frequent [pause] cues. Keep it dry and thrown-away. For mid-form, segments should be 15–20 seconds max. The vibe is: barely wants to be here, but what he's saying is sharp.`;
  }
  if (energy === "feeling_it") {
    return `Energy: FEELING IT. More range, room to build a point across sentences. Longer segments (20–30 seconds for mid-form). More conviction and forward lean. Still SuperBad voice — never motivational-speaker energy — but animated.`;
  }
  return `Energy: DEFAULT. Balanced delivery. Natural pace with breathing room. Mid-range sentence length. Not flat, not animated — just talking.`;
}

function formatGuidance(format: ScriptFormat): string {
  if (format === "short") {
    return `FORMAT: SHORT-FORM (30–90 seconds, 100–200 words).
Written for one take. Output a flat array of "blocks", each with "text" (string) and "cue" (one of "pause", "slower", "land_it", or null).
- "pause" = 1–2 second breath
- "slower" = reduce pace for emphasis
- "land_it" = final line, let it sit
Structure: hook in the first line (must grab in 3 seconds), develop the point quickly, land it with a dry closer. No filler.`;
  }
  return `FORMAT: MID-FORM (2–5 minutes, 400–800 words).
Broken into numbered "segments" of 15–30 seconds each. Each segment is filmed as its own take — the viewer never knows.
Each segment has: "number" (int), "duration_hint_sec" (int), "blocks" (array of {text, cue}), and "b_cam_after" (boolean — true where the editor should cut to B camera between segments).
Structure: hook in segment 1, build the argument through the middle, land with a memorable closer. Vary the pacing — some segments are punchy, some breathe.`;
}

const SYSTEM_PROMPT = `You are a script writer for SuperBad Marketing's talking head video series. Andy Robinson sits in a burnt yellow armchair against a red studio backdrop, reading from a transparent teleprompter with the camera behind it. He's uncomfortable on camera but sharp on delivery when the script is right.

VOICE RULES (non-negotiable):
- Dry, observational, self-deprecating, slow burn
- Written the way Andy talks — contractions, fragments, trailing thoughts
- Short sentences. Leave room for the mutter.
- Never explain the joke
- Never sound like a marketing AI writing "authentic content"
- Never use words like "synergy", "leverage", "solutions", "game-changer", "unlock"
- No motivational-speaker energy. No rhetorical questions that answer themselves.
- If it sounds like a LinkedIn post, rewrite it.

You MUST respond with valid JSON only. No markdown, no code fences, no commentary.`;

export async function generateScript(
  pillar: PillarDef,
  format: ScriptFormat,
  energy: EnergyLevel,
): Promise<GeneratedScript> {
  const prompt = `Generate a talking head video script.

PILLAR: "${pillar.label}"
${pillar.description}
Tone: ${pillar.tone}

${formatGuidance(format)}

${energyGuidance(energy)}

Return a single JSON object with keys: "format" ("${format}"), "title" (string), "hook" (the opening line that grabs attention), "estimated_duration_sec" (integer), and ${format === "short" ? '"blocks" (array of {text, cue})' : '"segments" (array of {number, duration_hint_sec, blocks, b_cam_after})'}.`;

  const raw = await invokeLlmText({
    job: "talking-head-generate-script",
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 4096,
  });

  const cleaned = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as GeneratedScript;
}

export async function generateEditBrief(
  script: GeneratedScript,
): Promise<EditBrief> {
  const prompt = `Generate an edit brief for this talking head video script.

Script:
${JSON.stringify(script, null, 2)}

The video is filmed with an A cam (straight on, through teleprompter) and B cam (offset angle). The editor needs to know where to cut between cameras, what text overlays to add, thumbnail concept, and pacing notes.

Return a single JSON object with keys: "cut_style" (string), "b_cam_moments" (string[]), "text_overlays" (array of {segment?: number, text: string, style: string}), "thumbnail" ({concept: string, style: string}), "music_note" (string), "pacing_note" (string).

JSON only, no markdown.`;

  const raw = await invokeLlmText({
    job: "talking-head-generate-edit-brief",
    prompt,
    maxTokens: 2048,
  });

  const cleaned = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as EditBrief;
}

export async function generatePublishMeta(
  script: GeneratedScript,
  editBrief: EditBrief,
): Promise<PublishMeta> {
  const prompt = `Generate publishing metadata for this talking head video.

Script title: ${script.title}
Hook: ${script.hook}
Format: ${script.format}
Duration: ~${script.estimated_duration_sec} seconds

Edit brief thumbnail concept: ${editBrief.thumbnail.concept}

The video will be posted across social platforms. Generate a caption that sounds like Andy — dry, not salesy. Hashtags should be relevant but not excessive (4–6 max).

Return a single JSON object with keys: "platforms" (string[]), "caption" (string), "hashtags" (string[]), "suggested_post_time" (ISO string or null), "cross_post_notes" (string — notes on how to adapt for different platforms).

JSON only, no markdown.`;

  const raw = await invokeLlmText({
    job: "talking-head-generate-publish-meta",
    prompt,
    maxTokens: 1024,
  });

  const cleaned = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as PublishMeta;
}
