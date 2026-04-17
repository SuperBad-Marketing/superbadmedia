/**
 * Scheduled-task handler for `content_outreach_match` — on-publish
 * content-to-outreach matching (spec §6, §2.2).
 *
 * Payload: `{ post_id: string, company_id: string }`. Enqueued by the
 * `content_fan_out` handler after a blog post is published.
 *
 * Not self-perpetuating — fires once per published post.
 * Kill-switch: `content_outreach_enabled` (checked by the library).
 *
 * Owner: CE-13. Consumer: worker dispatch via HANDLER_REGISTRY.
 */
import { z } from "zod";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { matchContentToProspects } from "@/lib/content-engine/outreach-match";

// ── Payload ─────────────────────────────────────────────────────────

export const ContentOutreachMatchPayloadSchema = z.object({
  post_id: z.string().min(1),
  company_id: z.string().min(1),
});

export type ContentOutreachMatchPayload = z.infer<
  typeof ContentOutreachMatchPayloadSchema
>;

// ── Handler ─────────────────────────────────────────────────────────

export const handleContentOutreachMatch: TaskHandler = async (task) => {
  if (!killSwitches.content_outreach_enabled) return;

  const parsed = ContentOutreachMatchPayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `content_outreach_match: invalid payload (${parsed.error.message})`,
    );
  }

  const { post_id, company_id } = parsed.data;

  // Delegate to library — handles all gates (SuperBad-only, lead gen
  // availability, post status) and returns a result.
  await matchContentToProspects(post_id, company_id);
};

// ── Registry wiring ─────────────────────────────────────────────────

export const CONTENT_OUTREACH_MATCH_HANDLERS: HandlerMap = {
  content_outreach_match: handleContentOutreachMatch,
};
