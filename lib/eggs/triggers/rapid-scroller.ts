import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.scrollDepth < 0.9) return null;
  if (ctx.scrollDurationMs >= 6_000) return null;
  if (ctx.scrollDurationMs <= 0) return null;

  return {
    scrollDepth: ctx.scrollDepth,
    scrollDurationMs: ctx.scrollDurationMs,
    reason: "scrolled_full_page_under_6s",
  };
}

registerTrigger("rapid_scroller", evaluate);
