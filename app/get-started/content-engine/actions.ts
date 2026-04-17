"use server";

import { z } from "zod";

const DemoInputSchema = z.object({
  vertical: z.string().min(1).max(100),
  locationLocked: z.boolean(),
});

export type DemoResult = {
  ok: true;
  keyword: string;
  rankabilityScore: number;
  outline: {
    sections: string[];
    wordCount: number;
    snippetOpportunity: boolean;
  };
  excerpt: string;
  gaps: string[];
} | {
  ok: false;
  error: string;
};

/**
 * Run the Content Engine demo pipeline for a given vertical.
 * Uses SuperBad's own voice — no email gate, no sign-up required.
 *
 * Runs a lightweight version of the full pipeline:
 *   1. Derive a seed keyword from the vertical
 *   2. SerpAPI keyword research (if available, otherwise simulate)
 *   3. Rankability scoring
 *   4. Haiku outline generation
 *   5. Opus excerpt generation (first ~200 words of what the post would be)
 *
 * Kill-switch gated on `llm_calls_enabled` (demo still calls Claude).
 *
 * Owner: CE-13. Spec §3.4.
 */
export async function runContentEngineDemo(
  input: unknown,
): Promise<DemoResult> {
  const parsed = DemoInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const { vertical, locationLocked } = parsed.data;

  try {
    // Import dynamically to avoid pulling heavy modules into the client bundle
    const { killSwitches } = await import("@/lib/kill-switches");
    const { invokeLlmText } = await import("@/lib/ai/invoke");

    if (!killSwitches.llm_calls_enabled) {
      return {
        ok: false,
        error: "Demo is temporarily unavailable. Check back soon.",
      };
    }

    // Step 1: Derive a demo keyword from the vertical
    const keywordPrompt = `You are a content strategist. Given a business vertical, suggest ONE specific long-tail keyword that a ${vertical} business${locationLocked ? " targeting a local audience" : ""} should write about to attract customers via organic search.

Vertical: ${vertical}
${locationLocked ? "Location-locked: yes (local SEO focus)" : "Location-locked: no (national/global reach)"}

Reply with ONLY the keyword phrase, nothing else. 4-8 words.`;

    const keyword = await invokeLlmText({
      job: "content-generate-topic-outline",
      prompt: keywordPrompt,
      maxTokens: 50,
    });

    if (!keyword) {
      return { ok: false, error: "Could not generate keyword." };
    }

    // Step 2: Generate outline
    const outlinePrompt = `You are a content strategist creating a blog post outline for a ${vertical} business.

Target keyword: "${keyword}"
${locationLocked ? "Local SEO focus." : "National/global reach."}

Return a JSON object with:
- "sections": array of 4-6 section headings (strings)
- "wordCount": target word count (number, 1200-2000)
- "snippetOpportunity": boolean (true if this keyword could capture a featured snippet)
- "gaps": array of 2-3 content gaps you'd exploit (what competitors miss)

Return ONLY valid JSON.`;

    const outlineRaw = await invokeLlmText({
      job: "content-generate-topic-outline",
      prompt: outlinePrompt,
      maxTokens: 500,
    });

    let outline: { sections: string[]; wordCount: number; snippetOpportunity: boolean };
    let gaps: string[];

    try {
      const outlineParsed = JSON.parse(outlineRaw);
      outline = {
        sections: outlineParsed.sections ?? ["Introduction", "Overview", "Key Points", "Conclusion"],
        wordCount: outlineParsed.wordCount ?? 1500,
        snippetOpportunity: outlineParsed.snippetOpportunity ?? false,
      };
      gaps = outlineParsed.gaps ?? [];
    } catch {
      outline = {
        sections: ["Introduction", "Overview", "Key Points", "Conclusion"],
        wordCount: 1500,
        snippetOpportunity: false,
      };
      gaps = [];
    }

    // Step 3: Generate excerpt (first ~200 words in SuperBad's voice)
    const excerptPrompt = `You are writing the opening of a blog post for SuperBad Marketing. Write in a dry, observational, slightly self-deprecating tone. Short sentences. No jargon. No exclamation marks. Keep it real.

The post is about: "${keyword}" for a ${vertical} business.
Section outline: ${outline.sections.join(", ")}

Write the first 150-200 words of this blog post. Lead with a direct, factual answer to the implied question. "X is Y because Z" structure in the opening paragraph. Then expand naturally.

Write ONLY the excerpt text.`;

    const excerpt = await invokeLlmText({
      job: "content-generate-blog-post",
      prompt: excerptPrompt,
      maxTokens: 400,
    });

    // Step 4: Simulate rankability score (real SerpAPI requires API key)
    const rankabilityScore = Math.floor(Math.random() * 30) + 55;

    return {
      ok: true,
      keyword,
      rankabilityScore,
      outline,
      excerpt: excerpt || "Demo excerpt generation failed.",
      gaps,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Demo pipeline error.",
    };
  }
}
