import { describe, it, expect } from "vitest";
import { ACTIVITY_LOG_KINDS } from "@/lib/db/schema/activity-log";

describe("activity_log kinds — CM-1 additions", () => {
  const CM1_KINDS = [
    "portal_chat_message_sent",
    "portal_chat_escalated",
    "portal_chat_action_taken",
    "data_export_requested",
    "data_export_completed",
    "external_link_added",
    "external_link_removed",
    "client_profile_viewed_by_admin",
    "retainer_mode_brand_dna_gate_entered",
    "retainer_kickoff_bartender_message_sent",
  ] as const;

  for (const kind of CM1_KINDS) {
    it(`includes "${kind}"`, () => {
      expect(ACTIVITY_LOG_KINDS).toContain(kind);
    });
  }
});
