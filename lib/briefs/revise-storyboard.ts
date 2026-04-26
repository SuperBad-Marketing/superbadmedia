import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { briefs } from "@/lib/db/schema/briefs";
import {
  brief_storyboards,
  type StoryboardScene,
  type StoryboardChatMessage,
} from "@/lib/db/schema/brief-storyboards";
import { invokeLlmText } from "@/lib/ai/invoke";
import { logActivity } from "@/lib/activity-log";

type ReviseResult =
  | { ok: true; changesSummary: string }
  | { ok: false; error: string };

export async function reviseStoryboard(
  briefId: string,
  userMessage: string,
): Promise<ReviseResult> {
  const storyboard = await db
    .select()
    .from(brief_storyboards)
    .where(eq(brief_storyboards.brief_id, briefId))
    .get();

  if (!storyboard || storyboard.status !== "ready") {
    return { ok: false, error: "No ready storyboard found for this brief." };
  }

  const brief = await db
    .select()
    .from(briefs)
    .where(eq(briefs.id, briefId))
    .get();

  if (!brief) return { ok: false, error: "Brief not found." };

  const chatHistory = (storyboard.chat_history_json ??
    []) as StoryboardChatMessage[];
  const scenes = storyboard.scenes_json as StoryboardScene[];

  const historyBlock = chatHistory
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n\n");

  const prompt = `You are revising a video production storyboard based on feedback.

ORIGINAL BRIEF:
Business: ${brief.business_name}
${brief.project_title ? `Project: ${brief.project_title}` : ""}
Description: ${brief.description}

CURRENT STORYBOARD (${scenes.length} scenes):
${JSON.stringify(scenes, null, 2)}

${historyBlock ? `PREVIOUS FEEDBACK CONVERSATION:\n${historyBlock}\n` : ""}
NEW FEEDBACK FROM DIRECTOR:
${userMessage}

Update ONLY the scenes that need to change based on the feedback. Keep unchanged scenes exactly as they are.

Respond with ONLY valid JSON:
{
  "updated_scenes": [full array of ALL scenes — changed and unchanged],
  "changes_summary": "one-line description of what changed"
}`;

  try {
    const raw = await invokeLlmText({
      job: "brief-storyboard-revise",
      prompt,
      maxTokens: 4096,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in LLM response.");

    const parsed = JSON.parse(jsonMatch[0]) as {
      updated_scenes: StoryboardScene[];
      changes_summary: string;
    };

    if (
      !Array.isArray(parsed.updated_scenes) ||
      parsed.updated_scenes.length === 0
    ) {
      throw new Error("LLM returned empty scenes.");
    }

    const now = Date.now();
    const newHistory: StoryboardChatMessage[] = [
      ...chatHistory,
      { role: "user", content: userMessage, timestamp_ms: now },
      {
        role: "assistant",
        content: parsed.changes_summary,
        timestamp_ms: now,
        changes_summary: parsed.changes_summary,
      },
    ];

    await db
      .update(brief_storyboards)
      .set({
        scenes_json: parsed.updated_scenes,
        chat_history_json: newHistory,
        updated_at_ms: now,
      })
      .where(eq(brief_storyboards.id, storyboard.id));

    await logActivity({
      kind: "storyboard_revised",
      companyId: brief.company_id ?? undefined,
      body: `Storyboard revised for brief ${brief.reference_number}: ${parsed.changes_summary}`,
      meta: {
        brief_id: briefId,
        changes_summary: parsed.changes_summary,
        scene_count: parsed.updated_scenes.length,
      },
    });

    return { ok: true, changesSummary: parsed.changes_summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}
