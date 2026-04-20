import { createHash } from "crypto";
import { db } from "@/lib/db";
import { riddles, riddle_resolutions, type RiddleOutcome } from "@/lib/db/schema/riddles";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface ResolveResult {
  outcome: RiddleOutcome;
  content: string;
}

interface CommonWrongEntry {
  answer_hash: string;
  response: string;
}

function hashAnswer(input: string, salt: string): string {
  const normalised = input.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
  return createHash("sha256").update(`${salt}:${normalised}`).digest("hex");
}

/**
 * Single resolver for all riddle answer attempts.
 * Called identically from public search, admin search, and /say/[answer].
 *
 * SD-10 will wire the live Claude fallback for novel wrong answers.
 */
export async function resolveRiddleAnswer(
  input: string,
  context: {
    riddleSlug?: string;
    riddleId?: string;
    actorType: "public" | "admin" | "customer";
    userId?: string;
  },
): Promise<ResolveResult> {
  const riddle = context.riddleId
    ? await db.select().from(riddles).where(eq(riddles.id, context.riddleId)).get()
    : context.riddleSlug
      ? await db.select().from(riddles).where(eq(riddles.slug, context.riddleSlug)).get()
      : null;

  if (!riddle) {
    return { outcome: "unknown_riddle", content: "that's not a riddle we recognise." };
  }

  if (riddle.retired_at_ms !== null) {
    await logResolution(riddle.id, context, input, "retired");
    return { outcome: "retired", content: "that riddle's retired. it had a good run." };
  }

  const answerHash = hashAnswer(input, riddle.salt);

  if (answerHash === riddle.answer_hash) {
    await logResolution(riddle.id, context, input, "correct");
    const content =
      context.actorType === "public"
        ? riddle.public_reward_content
        : riddle.loggedin_reward_content;
    return { outcome: "correct", content };
  }

  const commonWrongs = riddle.common_wrong_answers as CommonWrongEntry[];
  const commonMatch = commonWrongs.find((cw) => cw.answer_hash === answerHash);
  if (commonMatch) {
    await logResolution(riddle.id, context, input, "common_wrong");
    return { outcome: "common_wrong", content: commonMatch.response };
  }

  // Novel wrong — SD-10 adds the live Claude fallback here
  await logResolution(riddle.id, context, input, "catch_all_wrong");
  return { outcome: "catch_all_wrong", content: riddle.catch_all_wrong_content };
}

async function logResolution(
  riddleId: string,
  context: { actorType: "public" | "admin" | "customer"; userId?: string },
  input: string,
  outcome: RiddleOutcome,
): Promise<void> {
  const inputHash = createHash("sha256").update(input.toLowerCase().trim()).digest("hex");
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
