import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

const LINKEDIN_PATTERNS = [
  "linkedin.com",
  "lnkd.in",
];

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  const referrerLower = ctx.referrer.toLowerCase();
  const fromLinkedIn = LINKEDIN_PATTERNS.some((p) => referrerLower.includes(p));
  if (!fromLinkedIn) return null;

  return { referrer: ctx.referrer, reason: "linkedin_referrer_detected" };
}

registerTrigger("linkedin_referrer", evaluate);
