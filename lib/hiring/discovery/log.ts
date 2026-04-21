import { logExternalCall } from "@/lib/observatory";

export async function logDiscoveryCall(
  job: string,
  durationMs: number,
  estimatedCostAud: number,
  units?: Record<string, number>,
): Promise<void> {
  logExternalCall({
    job,
    actorType: "internal",
    units: { duration_ms: durationMs, ...units },
    estimatedCostAud,
  }).catch(() => {});
}
