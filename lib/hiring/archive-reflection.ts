import { invokeLlmText } from "@/lib/ai/invoke";
import {
  buildArchiveReflectionPrompt,
  buildArchiveReflectionSystem,
  type ArchiveReflectionPromptInput,
} from "@/lib/ai/prompts/hiring/archive-reflection-ingest";
import {
  getCandidateById,
  getRoleBriefById,
  updateRoleBrief,
  getArchivesForCandidate,
} from "./queries";
import { logActivity } from "@/lib/activity-log";

export async function ingestArchiveReflection(
  candidateId: string,
  archiveId: string,
): Promise<{ newItems: string[] }> {
  const candidate = await getCandidateById(candidateId);
  if (!candidate) return { newItems: [] };

  if (!candidate.role_brief_id) return { newItems: [] };
  const brief = await getRoleBriefById(candidate.role_brief_id);
  if (!brief) return { newItems: [] };

  const archives = await getArchivesForCandidate(candidateId);
  const archive = archives.find((a) => a.id === archiveId);
  if (!archive?.reflection_text) return { newItems: [] };

  const currentAvoidList: string[] = Array.isArray(brief.style_avoid_list_json)
    ? (brief.style_avoid_list_json as string[])
    : [];

  const promptInput: ArchiveReflectionPromptInput = {
    candidateName: candidate.name,
    roleName: brief.role_name,
    reasonCode: archive.reason_code,
    reasonFreeText: archive.reason_free_text,
    reflectionText: archive.reflection_text,
    currentAvoidList: currentAvoidList,
    briefStyleSummary: brief.style_summary,
  };

  const raw = await invokeLlmText({
    job: "hiring-archive-reflection-ingest",
    prompt: buildArchiveReflectionPrompt(promptInput),
    system: buildArchiveReflectionSystem(),
    maxTokens: 200,
  });

  const newItems = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length <= 100);

  if (newItems.length === 0) return { newItems: [] };

  const capped = newItems.slice(0, 3);
  const merged = [...currentAvoidList, ...capped];

  await updateRoleBrief(brief.id, {
    style_avoid_list_json: merged,
  });

  await logActivity({
    kind: "role_brief_regenerated",
    body: `Archive reflection from ${candidate.name} added ${capped.length} avoid item(s) to Role Brief.`,
    meta: {
      candidate_id: candidateId,
      archive_id: archiveId,
      role_brief_id: brief.id,
      new_items: capped,
    },
  });

  return { newItems: capped };
}
