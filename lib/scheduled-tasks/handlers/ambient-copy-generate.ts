import { eq, and, gt } from "drizzle-orm";

import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { db } from "@/lib/db";
import {
  ambient_copy_cache,
  AMBIENT_SLOTS,
  type AmbientSlot,
} from "@/lib/db/schema/ambient-copy-cache";
import { generateInVoice } from "@/lib/eggs/generate-in-voice";
import { killSwitches } from "@/lib/kill-switches";
import settings from "@/lib/settings";

function contextHash(slot: AmbientSlot): string {
  return `default:${slot}`;
}

const handleAmbientCopyGenerate: TaskHandler = async (task) => {
  if (!killSwitches.llm_calls_enabled) return;

  const payload = task.payload as { slots?: AmbientSlot[] } | null;
  const slots = payload?.slots ?? [...AMBIENT_SLOTS];
  const refreshIntervalDays = await settings.get(
    "surprise.ambient_copy_refresh_interval_days",
  );
  const cutoffMs = Date.now() - refreshIntervalDays * 86_400_000;

  for (const slot of slots) {
    const hash = contextHash(slot);

    const existing = await db
      .select({ id: ambient_copy_cache.id, generated_at_ms: ambient_copy_cache.generated_at_ms })
      .from(ambient_copy_cache)
      .where(
        and(
          eq(ambient_copy_cache.slot, slot),
          eq(ambient_copy_cache.context_hash, hash),
          gt(ambient_copy_cache.generated_at_ms, cutoffMs),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    const result = await generateInVoice({
      slot,
      context: {},
    });

    await db
      .insert(ambient_copy_cache)
      .values({
        id: crypto.randomUUID(),
        slot,
        context_hash: hash,
        generated_text: result.text,
        drift_check_score: result.driftCheckScore != null
          ? Math.round(result.driftCheckScore * 100)
          : null,
        generated_at_ms: Date.now(),
        expires_at_ms: null,
      })
      .onConflictDoNothing();
  }
};

export const AMBIENT_COPY_GENERATE_HANDLERS: HandlerMap = {
  ambient_copy_generate: handleAmbientCopyGenerate,
};
