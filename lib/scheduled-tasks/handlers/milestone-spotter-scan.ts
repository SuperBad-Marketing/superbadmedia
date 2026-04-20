import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { scanForMilestones, generateMilestoneDraft } from "@/lib/eggs/admin-triggers/milestone-spotter";
import { fireEgg } from "@/lib/eggs/fire-egg";
import { logActivity } from "@/lib/activity-log";

const DAILY_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export const MILESTONE_SPOTTER_SCAN_HANDLERS: HandlerMap = {
  milestone_spotter_daily_scan: async (_payload) => {
    if (!killSwitches.llm_calls_enabled) return;

    const milestones = await scanForMilestones(Date.now(), DAILY_LOOKBACK_MS);

    for (const m of milestones) {
      const draft = await generateMilestoneDraft(m);

      await fireEgg({
        eggId: "milestone_spotter",
        actorType: "admin",
        evidence: {
          contactId: m.contactId,
          companyId: m.companyId,
          eventType: m.eventType,
          eventDate: m.eventDate,
          sourceNoteId: m.sourceNoteId,
          sourceText: m.sourceText.slice(0, 200),
        },
        outcome: "pending_review",
      });

      await logActivity({
        kind: "hidden_egg_fired",
        body: `Milestone spotted: ${m.eventType} for ${m.contactName ?? m.companyName ?? "unknown"} on ${m.eventDate}`,
        contactId: m.contactId ?? undefined,
        companyId: m.companyId ?? undefined,
        meta: {
          egg_id: "milestone_spotter",
          event_type: m.eventType,
          event_date: m.eventDate,
          draft_message: draft,
        },
      });
    }
  },
};
