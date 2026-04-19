import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import { runAbandonCheck, ensureAbandonCheckEnqueued } from "@/lib/intro-funnel/abandon-tracking";

export const INTRO_FUNNEL_ABANDON_HANDLERS: HandlerMap = {
  intro_funnel_abandon_check: async () => {
    await runAbandonCheck();
    await ensureAbandonCheckEnqueued();
  },
};
