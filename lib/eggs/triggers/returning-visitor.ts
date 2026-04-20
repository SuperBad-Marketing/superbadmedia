import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.visitCount < 2) return null;
  if (ctx.visitCount === 5) return null;

  return { visitCount: ctx.visitCount, reason: "returning_visitor_not_fifth" };
}

registerTrigger("returning_visitor", evaluate);
