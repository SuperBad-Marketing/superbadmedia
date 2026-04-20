import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import settings from "@/lib/settings";

const MS_PER_DAY = 86_400_000;

export async function enqueueBenchPauseEnding(
  candidateId: string,
  pausedUntilMs: number,
): Promise<void> {
  const warnDays = await settings.get(
    "hiring.bench.pause_ending_warn_days",
  );
  const runAtMs = pausedUntilMs - warnDays * MS_PER_DAY;

  if (runAtMs <= Date.now()) return;

  await enqueueTask({
    task_type: "hiring_bench_pause_ending",
    runAt: runAtMs,
    payload: { candidate_id: candidateId },
    idempotencyKey: `bench_pause_ending:${candidateId}:${pausedUntilMs}`,
  });
}
