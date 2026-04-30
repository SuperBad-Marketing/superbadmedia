/**
 * Scheduled-task handler for `content_syndicate` — syndicates a published
 * blog post to all enabled external platforms (Medium, LinkedIn Articles,
 * Ghost, Beehiiv, WordPress.com).
 *
 * Enqueued by the content_fan_out handler after blog publish succeeds.
 * Can also be triggered manually for retry.
 *
 * Kill-switch: `content_syndication_enabled`.
 *
 * Owner: CE-14 (v1.1). Consumer: worker dispatch via HANDLER_REGISTRY.
 */
import { z } from "zod";
import { killSwitches } from "@/lib/kill-switches";
import { syndicateBlogPost } from "@/lib/content-engine/syndicate";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";

const ContentSyndicatePayloadSchema = z.object({
  post_id: z.string().min(1),
  company_id: z.string().min(1),
});

export const handleContentSyndicate: TaskHandler = async (task) => {
  if (!killSwitches.content_syndication_enabled) return;

  const parsed = ContentSyndicatePayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `content_syndicate: invalid payload (${parsed.error.message})`,
    );
  }

  await syndicateBlogPost(parsed.data.post_id);
};

export const CONTENT_SYNDICATE_HANDLERS: HandlerMap = {
  content_syndicate: handleContentSyndicate,
};
