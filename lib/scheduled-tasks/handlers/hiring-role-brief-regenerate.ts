import type { TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { regenerateRoleBrief } from "@/lib/hiring/regenerate-brief";
import type { BriefRegenTrigger } from "@/lib/hiring/maybe-regenerate-brief";

export const handleHiringRoleBriefRegenerate: TaskHandler = async (task) => {
  if (!killSwitches.llm_calls_enabled) return;

  const payload = task.payload as {
    role_brief_id?: string;
    trigger?: BriefRegenTrigger;
  } | null;
  const roleBriefId = payload?.role_brief_id;
  const trigger = payload?.trigger ?? "manual_retune";
  if (!roleBriefId) return;

  await regenerateRoleBrief(roleBriefId, trigger);
};

export const HIRING_ROLE_BRIEF_REGENERATE_HANDLERS = {
  hiring_role_brief_regenerate: handleHiringRoleBriefRegenerate,
} as const;
