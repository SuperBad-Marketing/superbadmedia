/**
 * Typed event-to-section mapping per spec §4.2.
 *
 * Material events that trigger Claude calls (Haiku):
 *   - Messages (inbound/outbound) → extraction + summary
 *   - Deal stage change → summary only
 *   - Action item completed → summary only
 *
 * Signal-only events (no Claude call, picked up by computeHealthScore on read):
 *   - Invoice sent/paid/overdue
 *   - Quote sent/accepted/expired
 *   - Deliverable status change
 *   - Brand DNA completed/retaken
 *   - Contact added/removed from company
 */

import {
  enqueueContextSummaryRegenerate,
  enqueueActionItemExtract,
} from "./enqueue";

export type MaterialEventType =
  | "new_inbound_message"
  | "new_outbound_message"
  | "deal_stage_change"
  | "action_item_completed";

export async function handleMaterialEvent(
  eventType: MaterialEventType,
  contactId: string,
  messageId?: string,
): Promise<void> {
  switch (eventType) {
    case "new_inbound_message":
    case "new_outbound_message":
      if (messageId) {
        await enqueueActionItemExtract(contactId, messageId);
      }
      await enqueueContextSummaryRegenerate(contactId);
      break;

    case "deal_stage_change":
    case "action_item_completed":
      await enqueueContextSummaryRegenerate(contactId);
      break;
  }
}
