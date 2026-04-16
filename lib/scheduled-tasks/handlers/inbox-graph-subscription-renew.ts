import { eq, lte, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { graph_api_state } from "@/lib/db/schema/graph-api-state";
import { killSwitches } from "@/lib/kill-switches";
import {
  createGraphClient,
  renewGraphSubscription,
} from "@/lib/graph";
import settings from "@/lib/settings";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";

async function handleSubscriptionRenew(): Promise<void> {
  if (!killSwitches.inbox_sync_enabled) return;

  const bufferHours = await settings.get("inbox.graph_subscription_renew_buffer_hours");
  const bufferMs = bufferHours * 60 * 60 * 1000;
  const threshold = Date.now() + bufferMs;

  const expiring = await db
    .select()
    .from(graph_api_state)
    .where(
      and(
        isNotNull(graph_api_state.subscription_id),
        lte(graph_api_state.subscription_expires_at_ms, threshold),
      ),
    );

  for (const row of expiring) {
    if (!row.subscription_id) continue;

    try {
      const client = await createGraphClient(row.integration_connection_id);
      const ttlHours = await settings.get("inbox.graph_subscription_ttl_hours");
      const ttlMinutes = ttlHours * 60;

      const renewed = await renewGraphSubscription(
        client,
        row.subscription_id,
        ttlMinutes,
      );

      await db
        .update(graph_api_state)
        .set({
          subscription_expires_at_ms: new Date(
            renewed.expirationDateTime,
          ).getTime(),
          updated_at_ms: Date.now(),
        })
        .where(eq(graph_api_state.id, row.id));
    } catch (err) {
      console.error(
        `[inbox-graph-subscription-renew] Failed for state ${row.id}:`,
        err,
      );
    }
  }
}

export const INBOX_SUBSCRIPTION_RENEW_HANDLERS: HandlerMap = {
  inbox_graph_subscription_renew: handleSubscriptionRenew,
};
