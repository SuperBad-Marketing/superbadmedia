import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";

export async function logDiscoveryCall(
  job: string,
  durationMs: number,
  estimatedCostAud: number,
  units?: Record<string, number>,
): Promise<void> {
  try {
    await db.insert(external_call_log).values({
      id: crypto.randomUUID(),
      job,
      actor_type: "internal",
      units: JSON.stringify({
        duration_ms: durationMs,
        ...units,
      }),
      estimated_cost_aud: estimatedCostAud,
      created_at_ms: Date.now(),
    });
  } catch {
    // Best-effort — never block the discovery flow
  }
}
