import { createHash } from "crypto";
import { db } from "@/lib/db";
import { riddles, riddle_resolutions, type RiddleOutcome } from "@/lib/db/schema/riddles";
import { nanoid } from "nanoid";

export interface ResolveByAnswerResult {
  outcome: RiddleOutcome;
  content: string;
  riddleId: string | null;
}

interface CommonWrongEntry {
  answer_hash: string;
  response: string;
}

function normalise(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
}

function hashWith(normalised: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${normalised}`).digest("hex");
}

/**
 * Resolve an answer against ALL riddles (active first, then retired).
 * Used by /say/[answer] where the URL slug is the answer text.
 */
export async function resolveByAnswer(
  input: string,
  context: {
    actorType: "public" | "admin" | "customer";
    userId?: string;
  },
): Promise<ResolveByAnswerResult> {
  const normalised = normalise(input);
  if (!normalised) {
    return { outcome: "unknown_riddle", content: "nothing to say.", riddleId: null };
  }

  const allRiddles = await db.select().from(riddles).all();
  const active = allRiddles.filter((r) => r.retired_at_ms === null);
  const retired = allRiddles.filter((r) => r.retired_at_ms !== null);

  // Correct answer — active riddles
  for (const riddle of active) {
    const hash = hashWith(normalised, riddle.salt);
    if (hash === riddle.answer_hash) {
      await logResolution(riddle.id, context, normalised, "correct");
      const content =
        context.actorType === "public"
          ? riddle.public_reward_content
          : riddle.loggedin_reward_content;
      return { outcome: "correct", content, riddleId: riddle.id };
    }
  }

  // Common wrong — active riddles
  for (const riddle of active) {
    const hash = hashWith(normalised, riddle.salt);
    const commonWrongs = riddle.common_wrong_answers as CommonWrongEntry[];
    const match = commonWrongs.find((cw) => cw.answer_hash === hash);
    if (match) {
      await logResolution(riddle.id, context, normalised, "common_wrong");
      return { outcome: "common_wrong", content: match.response, riddleId: riddle.id };
    }
  }

  // Correct answer — retired riddles
  for (const riddle of retired) {
    const hash = hashWith(normalised, riddle.salt);
    if (hash === riddle.answer_hash) {
      await logResolution(riddle.id, context, normalised, "retired");
      return { outcome: "retired", content: "that riddle's retired. it had a good run.", riddleId: riddle.id };
    }
  }

  // No match — catch-all from first active riddle or generic
  if (active.length > 0) {
    await logResolution(active[0].id, context, normalised, "catch_all_wrong");
    return {
      outcome: "catch_all_wrong",
      content: active[0].catch_all_wrong_content,
      riddleId: active[0].id,
    };
  }

  return { outcome: "unknown_riddle", content: "no riddles running right now.", riddleId: null };
}

async function logResolution(
  riddleId: string,
  context: { actorType: "public" | "admin" | "customer"; userId?: string },
  normalisedInput: string,
  outcome: RiddleOutcome,
): Promise<void> {
  const inputHash = createHash("sha256").update(normalisedInput).digest("hex");
  await db.insert(riddle_resolutions).values({
    id: nanoid(),
    riddle_id: riddleId,
    actor_type: context.actorType,
    user_id: context.userId ?? null,
    input_hash: inputHash,
    resolved_at_ms: Date.now(),
    outcome,
  });
}
