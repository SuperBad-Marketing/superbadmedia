import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ambient_copy_cache,
  type AmbientSlot,
} from "@/lib/db/schema/ambient-copy-cache";
import settings from "@/lib/settings";

export async function getAmbientCopy(
  slot: AmbientSlot,
): Promise<string | null> {
  const refreshIntervalDays = await settings.get(
    "surprise.ambient_copy_refresh_interval_days",
  );
  const cutoffMs = Date.now() - refreshIntervalDays * 86_400_000;

  const [row] = await db
    .select({ generated_text: ambient_copy_cache.generated_text })
    .from(ambient_copy_cache)
    .where(
      and(
        eq(ambient_copy_cache.slot, slot),
        gt(ambient_copy_cache.generated_at_ms, cutoffMs),
      ),
    )
    .orderBy(desc(ambient_copy_cache.generated_at_ms))
    .limit(1);

  return row?.generated_text ?? null;
}
