import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.visitCount !== 5) return null;

  return { visitCount: ctx.visitCount, reason: "fifth_distinct_calendar_day_visit" };
}

registerTrigger("fifth_time_visitor", evaluate);
