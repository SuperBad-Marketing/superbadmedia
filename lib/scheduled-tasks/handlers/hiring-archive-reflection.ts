import type { TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { ingestArchiveReflection } from "@/lib/hiring/archive-reflection";

export const handleHiringArchiveReflectionIngest: TaskHandler = async (
  task,
) => {
  if (!killSwitches.llm_calls_enabled) return;

  const payload = task.payload as {
    candidate_id?: string;
    archive_id?: string;
  } | null;
  const candidateId = payload?.candidate_id;
  const archiveId = payload?.archive_id;
  if (!candidateId || !archiveId) return;

  await ingestArchiveReflection(candidateId, archiveId);
};

export const HIRING_ARCHIVE_REFLECTION_HANDLERS = {
  hiring_archive_reflection_ingest: handleHiringArchiveReflectionIngest,
} as const;
