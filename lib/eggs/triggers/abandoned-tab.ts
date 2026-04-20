import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.tabBackgroundedMs < 600_000) return null;

  return {
    tabBackgroundedMs: ctx.tabBackgroundedMs,
    reason: "tab_backgrounded_10min_plus",
  };
}

registerTrigger("abandoned_tab", evaluate);
