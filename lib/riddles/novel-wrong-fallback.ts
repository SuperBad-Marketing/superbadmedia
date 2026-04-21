import { createHash } from "crypto";
import { db } from "@/lib/db";
import { riddle_novel_wrong_cache, type RiddleRow } from "@/lib/db/schema/riddles";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import { killSwitches } from "@/lib/kill-switches";
import settingsRegistry from "@/lib/settings";

export interface NovelWrongResult {
  used: boolean;
  content: string;
}

function hashInput(input: string): string {
  return createHash("sha256")
    .update(input.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ""))
    .digest("hex");
}

export async function resolveNovelWrong(
  riddle: RiddleRow,
  input: string,
): Promise<NovelWrongResult> {
  const inputHash = hashInput(input);

  const cached = await db
    .select({ response: riddle_novel_wrong_cache.response })
    .from(riddle_novel_wrong_cache)
    .where(
      and(
        eq(riddle_novel_wrong_cache.riddle_id, riddle.id),
        eq(riddle_novel_wrong_cache.input_hash, inputHash),
      ),
    )
    .limit(1);

  if (cached.length > 0) {
    return { used: true, content: cached[0].response };
  }

  if (!killSwitches.llm_calls_enabled) {
    return { used: false, content: riddle.catch_all_wrong_content };
  }

  const budget = await settingsRegistry.get(
    "surprise.riddle_wrong_answer_fallback_budget_per_riddle",
  );

  const currentCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(riddle_novel_wrong_cache)
    .where(eq(riddle_novel_wrong_cache.riddle_id, riddle.id))
    .then((rows) => rows[0]?.count ?? 0);

  if (currentCount >= budget) {
    return { used: false, content: riddle.catch_all_wrong_content };
  }

  let profile;
  try {
    profile = await getSuperbadBrandProfile();
  } catch {
    return { used: false, content: riddle.catch_all_wrong_content };
  }

  const prompt = `Someone submitted "${input}" as an answer to a riddle. It's wrong.

The riddle prompt was: "${riddle.public_reward_content ? "a cryptic riddle" : "a SuperBad riddle"}"

Write a single dry, witty one-liner response acknowledging their wrong answer. SuperBad voice: understated Melbourne wit, never explains the joke, deadpan.

Rules:
- One line only, under 80 characters preferred
- Acknowledge what they said without giving the answer away
- Dry, observational, self-deprecating tone
- Never use: synergy, leverage, solutions, stakeholder
- No exclamation marks, no emojis
- Never reveal or hint at the correct answer

Respond with the line only — no quotes, no prefix, no explanation.`;

  const text = await invokeLlmText({
    job: "sd-riddle-wrong-fallback",
    prompt,
    maxTokens: 80,
  });

  const driftResult = await checkBrandVoiceDrift(text, profile);

  if (!driftResult.pass) {
    return { used: false, content: riddle.catch_all_wrong_content };
  }

  await db.insert(riddle_novel_wrong_cache).values({
    id: nanoid(),
    riddle_id: riddle.id,
    input_hash: inputHash,
    response: text,
    drift_check_score: Math.round(driftResult.score * 100),
    created_at_ms: Date.now(),
  });

  return { used: true, content: text };
}
