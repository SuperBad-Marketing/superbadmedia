import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { generateBriefForSlot } from "@/lib/cockpit/generate-brief";
import { getCurrentSlot } from "@/lib/cockpit/queries";
import type { CockpitBriefSlot } from "@/lib/db/schema/cockpit-briefs";

const handleCockpitBriefRegenerate: TaskHandler = async (task) => {
  const payload = task.payload as { slot?: CockpitBriefSlot; trigger_event?: string } | null;
  const slot = payload?.slot ?? getCurrentSlot();
  await generateBriefForSlot(slot, {
    trigger: "material_event",
    triggerEvent: payload?.trigger_event,
  });
};

export const COCKPIT_BRIEF_REGENERATE_HANDLERS: HandlerMap = {
  cockpit_brief_regenerate: handleCockpitBriefRegenerate,
};
