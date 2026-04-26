import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { briefs } from "@/lib/db/schema/briefs";
import {
  brief_storyboards,
  type StoryboardScene,
  type ShotlistGroup,
} from "@/lib/db/schema/brief-storyboards";
import { invokeLlmText } from "@/lib/ai/invoke";
import { logActivity } from "@/lib/activity-log";

function buildGenerationPrompt(brief: {
  description: string;
  project_title: string | null;
  brief_kind: string | null;
  style_references: string | null;
  key_messages: string | null;
  target_audience: string | null;
  deliverables_breakdown: string | null;
  location_details: string | null;
  talent_notes: string | null;
  budget_range: string | null;
  additional_notes: string | null;
  business_name: string;
}): string {
  const sections: string[] = [];

  sections.push(`Business: ${brief.business_name}`);
  if (brief.project_title) sections.push(`Project: ${brief.project_title}`);
  if (brief.brief_kind) sections.push(`Type: ${brief.brief_kind}`);
  sections.push(`Description: ${brief.description}`);
  if (brief.style_references)
    sections.push(`Style references: ${brief.style_references}`);
  if (brief.key_messages)
    sections.push(`Key messages: ${brief.key_messages}`);
  if (brief.target_audience)
    sections.push(`Target audience: ${brief.target_audience}`);
  if (brief.deliverables_breakdown)
    sections.push(`Deliverables: ${brief.deliverables_breakdown}`);
  if (brief.location_details)
    sections.push(`Locations: ${brief.location_details}`);
  if (brief.talent_notes) sections.push(`Talent: ${brief.talent_notes}`);
  if (brief.budget_range)
    sections.push(`Budget range: ${brief.budget_range.replace(/_/g, " ")}`);
  if (brief.additional_notes)
    sections.push(`Additional notes: ${brief.additional_notes}`);

  return `You are a video production storyboard artist for SuperBad Marketing, a Melbourne-based creative agency.

Given the following production brief, generate:
1. A scene-by-scene storyboard (5–15 scenes)
2. A shotlist that regroups those scenes by location/setup for efficient shooting

BRIEF:
${sections.join("\n")}

STORYBOARD RULES:
- Each scene should be a distinct visual moment in the narrative
- Include specific shot types (wide, medium, close_up, detail, aerial, pov)
- Include camera movements (static, pan, tilt, track, handheld, crane, drone)
- Audio notes should describe music, dialogue, voiceover, or ambient sound
- Duration in seconds (typically 2–8 seconds per scene)
- Mood notes should describe emotional tone, lighting, and visual feel
- Tell a story — build tension, create rhythm, end with impact

SHOTLIST RULES:
- Group scenes by location and camera setup to minimise rig changes
- Each group should note the location, setup description, and equipment needed
- Estimate minutes per setup group
- Order groups by practical shooting sequence (e.g. exterior daylight first, interior last)

Respond with ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "number": 1,
      "description": "...",
      "shot_type": "wide",
      "camera_movement": "static",
      "audio_notes": "...",
      "duration_seconds": 4,
      "mood_note": "..."
    }
  ],
  "shotlist": [
    {
      "group_number": 1,
      "location": "...",
      "setup_description": "...",
      "equipment_notes": "...",
      "estimated_minutes": 20,
      "scenes": [
        { "scene_number": 1, "shot_type": "wide", "description": "..." }
      ]
    }
  ]
}`;
}

export async function generateStoryboard(briefId: string): Promise<void> {
  const now = Date.now();
  const storyboardId = randomUUID();

  await db.insert(brief_storyboards).values({
    id: storyboardId,
    brief_id: briefId,
    status: "generating",
    created_at_ms: now,
    updated_at_ms: now,
  });

  const brief = await db
    .select()
    .from(briefs)
    .where(eq(briefs.id, briefId))
    .get();

  if (!brief) {
    await db
      .update(brief_storyboards)
      .set({
        status: "failed",
        error_message: "Brief not found.",
        updated_at_ms: Date.now(),
      })
      .where(eq(brief_storyboards.id, storyboardId));

    await logActivity({
      kind: "storyboard_failed",
      body: `Storyboard generation failed for brief ${briefId}: brief not found.`,
      meta: { brief_id: briefId },
    });
    return;
  }

  try {
    const prompt = buildGenerationPrompt(brief);
    const raw = await invokeLlmText({
      job: "brief-storyboard-generate",
      prompt,
      maxTokens: 4096,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in LLM response.");

    const parsed = JSON.parse(jsonMatch[0]) as {
      scenes: StoryboardScene[];
      shotlist: ShotlistGroup[];
    };

    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      throw new Error("LLM returned empty or invalid scenes array.");
    }

    await db
      .update(brief_storyboards)
      .set({
        status: "ready",
        scenes_json: parsed.scenes,
        shotlist_json: parsed.shotlist ?? [],
        generated_at_ms: Date.now(),
        updated_at_ms: Date.now(),
      })
      .where(eq(brief_storyboards.id, storyboardId));

    await logActivity({
      kind: "storyboard_generated",
      companyId: brief.company_id ?? undefined,
      body: `Storyboard generated for brief ${brief.reference_number} (${parsed.scenes.length} scenes).`,
      meta: {
        brief_id: briefId,
        reference_number: brief.reference_number,
        scene_count: parsed.scenes.length,
        group_count: parsed.shotlist?.length ?? 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(brief_storyboards)
      .set({
        status: "failed",
        error_message: message,
        updated_at_ms: Date.now(),
      })
      .where(eq(brief_storyboards.id, storyboardId));

    await logActivity({
      kind: "storyboard_failed",
      companyId: brief.company_id ?? undefined,
      body: `Storyboard generation failed for brief ${brief.reference_number}: ${message}`,
      meta: { brief_id: briefId, error: message },
    });
  }
}
