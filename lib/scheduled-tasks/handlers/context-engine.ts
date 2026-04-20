import { z } from "zod";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";

const SummaryRegeneratePayloadSchema = z.object({
  contact_id: z.string().min(1),
});

const ActionItemExtractPayloadSchema = z.object({
  contact_id: z.string().min(1),
  message_id: z.string().min(1),
});

/**
 * Stub — full implementation lands in CCE-2 (summary regen + action-item
 * extraction via Haiku). Handler validates payload shape now so the
 * worker dispatch path is wired end-to-end from CCE-1.
 */
export const handleContextSummaryRegenerate: TaskHandler = async (task) => {
  if (!killSwitches.llm_calls_enabled) return;

  const parsed = SummaryRegeneratePayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `context_summary_regenerate: invalid payload (${parsed.error.message})`,
    );
  }

  // CCE-2 wires: assembleContext → invokeLlmText → upsertContextSummary
};

export const handleContextActionItemExtract: TaskHandler = async (task) => {
  if (!killSwitches.llm_calls_enabled) return;

  const parsed = ActionItemExtractPayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `context_action_item_extract: invalid payload (${parsed.error.message})`,
    );
  }

  // CCE-2 wires: fetch message → invokeLlmText → createActionItem
};

export const CONTEXT_ENGINE_HANDLERS: HandlerMap = {
  context_summary_regenerate: handleContextSummaryRegenerate,
  context_action_item_extract: handleContextActionItemExtract,
};
