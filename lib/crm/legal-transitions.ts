import type { DealStage } from "@/lib/db/schema/deals";

export const LEGAL_TRANSITIONS: Record<DealStage, ReadonlyArray<DealStage>> = {
  lead: ["contacted", "conversation", "trial_shoot", "quoted", "lost"],
  contacted: ["lead", "conversation", "trial_shoot", "quoted", "lost"],
  conversation: [
    "lead",
    "contacted",
    "trial_shoot",
    "quoted",
    "negotiating",
    "lost",
  ],
  trial_shoot: ["conversation", "quoted", "negotiating", "lost"],
  quoted: ["conversation", "trial_shoot", "negotiating", "won", "lost"],
  negotiating: ["conversation", "trial_shoot", "quoted", "won", "lost"],
  won: [],
  lost: ["lead"],
};
