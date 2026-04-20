import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { db } from "@/lib/db";
import { finance_snapshots } from "@/lib/db/schema/finance-snapshots";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { computeSnapshotMetrics } from "@/lib/finance/snapshot";
import { computeProjection } from "@/lib/finance/projection";
import { msToDateStr } from "@/lib/finance/projection";

const handleFinanceSnapshotTake: TaskHandler = async (_task) => {
  const nowMs = Date.now();
  const snapshotDate = msToDateStr(nowMs);

  const [{ metrics, staleFlags }, projection] = await Promise.all([
    computeSnapshotMetrics(nowMs),
    computeProjection(nowMs),
  ]);

  await db
    .insert(finance_snapshots)
    .values({
      snapshot_date: snapshotDate,
      metrics_json: metrics as unknown as null,
      projection_json: projection as unknown as null,
      narrative_text: null,
      narrative_generated_at_ms: null,
      narrative_callouts: null,
      stale_flags:
        Object.keys(staleFlags).length > 0
          ? (staleFlags as unknown as null)
          : null,
      created_at_ms: nowMs,
    })
    .onConflictDoUpdate({
      target: finance_snapshots.snapshot_date,
      set: {
        metrics_json: metrics as unknown as null,
        projection_json: projection as unknown as null,
        stale_flags:
          Object.keys(staleFlags).length > 0
            ? (staleFlags as unknown as null)
            : null,
      },
    });

  await enqueueTask({
    task_type: "finance_narrative_regenerate",
    runAt: nowMs,
    idempotencyKey: `finance_narrative_regenerate:${snapshotDate}`,
    payload: { snapshot_date: snapshotDate },
  });

};

export const FINANCE_SNAPSHOT_HANDLERS: HandlerMap = {
  finance_snapshot_take: handleFinanceSnapshotTake,
};
