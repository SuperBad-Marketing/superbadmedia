import settingsRegistry from "@/lib/settings";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { getRoleBriefById } from "./queries";
import { db } from "@/lib/db";
import { candidate_archives } from "@/lib/db/schema/candidate-archives";
import { candidates } from "@/lib/db/schema/candidates";
import { eq, and, isNull, isNotNull, gte } from "drizzle-orm";

export type BriefRegenTrigger =
  | "bench_entry"
  | "archive_reflection"
  | "archive_threshold"
  | "manual_retune";

const DEBOUNCE_MS = 10 * 60 * 1000;

export async function maybeRegenerateRoleBrief(
  roleBriefId: string,
  trigger: BriefRegenTrigger,
): Promise<{ enqueued: boolean; reason?: string }> {
  const brief = await getRoleBriefById(roleBriefId);
  if (!brief) return { enqueued: false, reason: "Brief not found." };
  if (brief.status !== "open" && brief.status !== "paused") {
    return { enqueued: false, reason: `Brief status is '${brief.status}'.` };
  }

  if (trigger === "bench_entry") {
    const regenOnBench = await settingsRegistry.get(
      "hiring.brief.regen_on_bench_entry",
    );
    if (!regenOnBench) {
      return { enqueued: false, reason: "Bench-entry regen disabled." };
    }
  }

  if (trigger === "archive_threshold") {
    const threshold = await settingsRegistry.get(
      "hiring.brief.archive_retune_threshold",
    );
    const lastRegenAt = brief.last_regenerated_at_ms ?? 0;
    const countSinceRegen = await countArchiveReflectionsSince(
      roleBriefId,
      lastRegenAt,
    );
    if (countSinceRegen < threshold) {
      return {
        enqueued: false,
        reason: `${countSinceRegen}/${threshold} reflections since last regen.`,
      };
    }
  }

  const runAt = trigger === "manual_retune" ? Date.now() + 2_000 : Date.now() + DEBOUNCE_MS;

  const debounceWindow = Math.floor(runAt / DEBOUNCE_MS);
  const idempotencyKey =
    trigger === "manual_retune"
      ? `brief-regen-manual-${roleBriefId}-${Date.now()}`
      : `brief-regen-${roleBriefId}-${debounceWindow}`;

  const task = await enqueueTask({
    task_type: "hiring_role_brief_regenerate",
    runAt,
    payload: { role_brief_id: roleBriefId, trigger },
    idempotencyKey,
  });

  return {
    enqueued: task !== null,
    reason: task === null ? "Debounced — regen already queued." : undefined,
  };
}

async function countArchiveReflectionsSince(
  roleBriefId: string,
  sinceMs: number,
): Promise<number> {
  const rows = await db
    .select({ id: candidate_archives.id })
    .from(candidate_archives)
    .innerJoin(candidates, eq(candidates.id, candidate_archives.candidate_id))
    .where(
      and(
        eq(candidates.role_brief_id, roleBriefId),
        isNotNull(candidate_archives.reflection_text),
        isNull(candidate_archives.un_archived_at_ms),
        gte(candidate_archives.created_at_ms, sinceMs),
      ),
    )
    .all();
  return rows.length;
}
