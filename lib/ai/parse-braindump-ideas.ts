import { invokeLlmText } from "@/lib/ai/invoke";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { extractMoodSignal } from "@/lib/ai/extract-mood-signal";
import type { MoodSignal } from "@/lib/db/schema/instagram-competitive";

export type { ParsedProjectIdea, IdeasParsedBraindump } from "./parse-braindump-ideas-types";
import type { ParsedProjectIdea, IdeasParsedBraindump } from "./parse-braindump-ideas-types";

type LlmProjectIdea = {
  title: string;
  description: string;
  confidence: number;
};

function clamp01(n: unknown): number {
  const v = typeof n === "number" ? n : 0;
  return Math.max(0, Math.min(1, v));
}

function buildPrompt(rawText: string): string {
  return `You are a project idea parser for SuperBad Marketing, a Melbourne-based marketing agency run by Andy. Parse freeform text into DISTINCT PROJECT IDEAS. These are half-formed thoughts, concepts, or initiatives that Andy wants to capture for later.

INSTRUCTIONS:
1. Each distinct idea becomes one project. Don't over-split — if the user wrote one connected thought, that's one project.
2. Write a clear, concise title (5-10 words) that captures the essence of the idea.
3. Clean up the raw text into a coherent description. Fix grammar, structure it, but keep Andy's voice. Don't add information that wasn't there.
4. Confidence 0.0–1.0 reflects how well-formed the idea is (1.0 = very clear, 0.3 = barely a notion).

Respond with ONLY valid JSON, no markdown fencing:
{
  "project_ideas": [
    {
      "title": "concise project title",
      "description": "cleaned-up idea description",
      "confidence": 0.7
    }
  ],
  "global_confidence": 0.8
}

BRAINDUMP TEXT:
${rawText}`;
}

export async function parseIdeasBraindump(
  rawText: string,
): Promise<IdeasParsedBraindump> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls are disabled (kill switch).");
  }

  const [responseText, moodSignal] = await Promise.all([
    invokeLlmText({
      job: "braindump-ideas-parse",
      prompt: buildPrompt(rawText),
      maxTokens: 2048,
    }),
    extractMoodSignal(rawText).catch(() => null),
  ]);

  let parsed: { project_ideas: LlmProjectIdea[]; global_confidence: number };
  try {
    const cleaned = responseText.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse braindump response from Claude.");
  }

  if (!Array.isArray(parsed.project_ideas)) {
    parsed.project_ideas = [];
  }

  const project_ideas: ParsedProjectIdea[] = parsed.project_ideas.map(
    (idea, i) => ({
      id: `project-${i}-${Date.now()}`,
      title: idea.title || `Idea ${i + 1}`,
      description: idea.description || rawText,
      confidence: clamp01(idea.confidence),
    }),
  );

  await logActivity({
    kind: "braindump_parsed",
    body: `Ideas braindump parsed — ${project_ideas.length} project idea${project_ideas.length === 1 ? "" : "s"}`,
    meta: { project_count: project_ideas.length, type: "ideas" },
    createdBy: "system",
  });

  return {
    project_ideas,
    global_confidence: clamp01(parsed.global_confidence),
    mood_signal: moodSignal,
  };
}
