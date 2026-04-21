import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { getCurrentSlot } from "./queries";
import settings from "@/lib/settings";
import type { CockpitBriefSlot } from "@/lib/db/schema/cockpit-briefs";

const MATERIAL_EVENT_DENYLIST = [
  "subscription_payment_failed",
  "subscription_cancelled",
  "invoice_paid_large",
  "outreach_reply_positive",
  "intro_funnel_booking_confirmed",
  "deal_won",
  "deal_lost",
  "graph_api_token_expired",
  "graph_api_subscription_lapsed",
  "cost_anomaly_detected",
] as const;

export type MaterialEventKey = (typeof MATERIAL_EVENT_DENYLIST)[number];

export function isMaterialEvent(eventKey: string): eventKey is MaterialEventKey {
  return (MATERIAL_EVENT_DENYLIST as readonly string[]).includes(eventKey);
}

/**
 * Called by source specs when a material event fires. Decides whether
 * to enqueue a debounced brief regen. Source specs just call this —
 * they never call `generateBriefForSlot()` directly.
 */
export async function maybeRegenerateBrief(
  eventKey: MaterialEventKey,
  payload?: Record<string, unknown> | null,
  opts?: { nowMs?: number },
): Promise<{ enqueued: boolean; reason?: string }> {
  const nowMs = opts?.nowMs ?? Date.now();
  const slot = getCurrentSlot(nowMs);

  const debounceMinutes = await settings.get(
    "cockpit.material_event_debounce_minutes",
  );
  const debounceMs = debounceMinutes * 60_000;
  const windowStart = nowMs - debounceMs;

  const existing = await db
    .select({ id: scheduled_tasks.id })
    .from(scheduled_tasks)
    .where(
      and(
        eq(scheduled_tasks.task_type, "cockpit_brief_regenerate"),
        eq(scheduled_tasks.status, "pending"),
        gte(scheduled_tasks.created_at_ms, windowStart),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return { enqueued: false, reason: "debounced" };
  }

  await enqueueTask({
    task_type: "cockpit_brief_regenerate",
    runAt: nowMs,
    payload: {
      slot,
      trigger_event: eventKey,
      material_event_payload: payload ?? null,
    },
  });

  return { enqueued: true };
}
