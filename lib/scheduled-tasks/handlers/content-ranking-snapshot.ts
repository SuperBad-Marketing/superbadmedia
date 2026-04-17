/**
 * Scheduled-task handler for `content_ranking_snapshot` — weekly per-owner
 * SerpAPI re-queries for all published blog posts (spec §7.1, §2.2).
 *
 * Payload: `{ company_id: string }`. Delegates to `takeRankingSnapshots()`
 * in `lib/content-engine/ranking-snapshot.ts`.
 *
 * Self-perpetuating weekly cadence. Kill-switch: `content_automations_enabled`.
 *
 * Owner: CE-9. Consumer: worker dispatch via HANDLER_REGISTRY.
 */
import { z } from "zod";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { takeRankingSnapshots } from "@/lib/content-engine/ranking-snapshot";

// ── Payload ─────────────────────────────────────────────────────────

export const ContentRankingSnapshotPayloadSchema = z.object({
  company_id: z.string().min(1),
});

export type ContentRankingSnapshotPayload = z.infer<
  typeof ContentRankingSnapshotPayloadSchema
>;

// ── Constants ───────────────────────────────────────────────────────

/** Re-enqueue interval: 7 days in milliseconds. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Idempotency key prefix for deduplication. */
const TASK_KEY_PREFIX = "content_ranking_snapshot:";

// ── Handler ─────────────────────────────────────────────────────────

export const handleContentRankingSnapshot: TaskHandler = async (task) => {
  if (!killSwitches.content_automations_enabled) return;

  const parsed = ContentRankingSnapshotPayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `content_ranking_snapshot: invalid payload (${parsed.error.message})`,
    );
  }

  const { company_id } = parsed.data;
  const nowMs = Date.now();

  await takeRankingSnapshots(company_id);

  // Self-perpetuate: re-enqueue in 1 week
  await scheduleNextRun(company_id, nowMs);
};

// ── Scheduling ──────────────────────────────────────────────────────

async function scheduleNextRun(
  companyId: string,
  nowMs: number,
): Promise<void> {
  const runAtMs = nowMs + WEEK_MS;

  await enqueueTask({
    task_type: "content_ranking_snapshot",
    runAt: runAtMs,
    payload: { company_id: companyId },
    idempotencyKey: `${TASK_KEY_PREFIX}${companyId}:${runAtMs}`,
  });
}

// ── Bootstrap ───────────────────────────────────────────────────────

/**
 * Idempotently enqueue the first `content_ranking_snapshot` run for a
 * company. Called after the first blog post is published, or from the
 * onboarding wizard completion.
 *
 * Schedules the first run 1 week from now (no published posts need
 * ranking data until they've had time to be indexed).
 */
export async function ensureRankingSnapshotEnqueued(
  companyId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  const runAtMs = nowMs + WEEK_MS;

  await enqueueTask({
    task_type: "content_ranking_snapshot",
    runAt: runAtMs,
    payload: { company_id: companyId },
    idempotencyKey: `${TASK_KEY_PREFIX}${companyId}:bootstrap`,
  });
}

// ── Registry wiring ─────────────────────────────────────────────────

export const CONTENT_RANKING_SNAPSHOT_HANDLERS: HandlerMap = {
  content_ranking_snapshot: handleContentRankingSnapshot,
};
