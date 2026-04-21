/**
 * Enqueues a `cost_anomaly_diagnose` scheduled task for a newly created
 * anomaly. Called by each detector after a successful upsert with
 * `created: true`. Idempotency key prevents duplicate diagnosis tasks
 * for the same anomaly.
 *
 * Owner: COB-8 (Wave 21).
 */
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

export async function enqueueDiagnosis(anomalyId: string): Promise<void> {
  await enqueueTask({
    task_type: "cost_anomaly_diagnose",
    runAt: Date.now(),
    payload: { anomaly_id: anomalyId },
    idempotencyKey: `diagnose:${anomalyId}`,
  });
}
