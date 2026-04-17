/**
 * Scheduled-task handler for `content_keyword_research` — weekly per-owner
 * keyword research pipeline (spec §2.2).
 *
 * Payload: `{ company_id: string }`. Delegates to `runKeywordResearch()`
 * in `lib/content-engine/research.ts`.
 *
 * Kill-switch: `content_automations_enabled` (checked inside
 * `runKeywordResearch`; handler also gates at the top for fast exit).
 *
 * Owner: CE-2. Consumer: worker dispatch via HANDLER_REGISTRY.
 */
import { z } from "zod";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { runKeywordResearch } from "@/lib/content-engine/research";

export const ContentKeywordResearchPayloadSchema = z.object({
  company_id: z.string().min(1),
});

export type ContentKeywordResearchPayload = z.infer<
  typeof ContentKeywordResearchPayloadSchema
>;

export const handleContentKeywordResearch: TaskHandler = async (task) => {
  if (!killSwitches.content_automations_enabled) {
    return; // Silent exit — worker marks as done
  }

  const parsed = ContentKeywordResearchPayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `content_keyword_research: invalid payload (${parsed.error.message})`,
    );
  }

  await runKeywordResearch(parsed.data.company_id);
};

export const CONTENT_KEYWORD_RESEARCH_HANDLERS: HandlerMap = {
  content_keyword_research: handleContentKeywordResearch,
};
