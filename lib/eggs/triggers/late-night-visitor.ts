import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.localHour >= 2 && ctx.localHour < 5) {
    return { localHour: ctx.localHour, reason: "visitor_local_time_0200_0459" };
  }
  return null;
}

registerTrigger("late_night_visitor", evaluate);
