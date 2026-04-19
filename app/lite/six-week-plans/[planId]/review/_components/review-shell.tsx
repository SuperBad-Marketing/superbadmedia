"use client";

import type { PlanForReview } from "@/lib/six-week-plan/queries";
import { StrategyReview } from "./strategy-review";
import { DetailReview } from "./detail-review";

interface ReviewShellProps {
  plan: PlanForReview["plan"];
  prospect: PlanForReview["prospect"];
}

export function ReviewShell({ plan, prospect }: ReviewShellProps) {
  if (plan.status === "generating") {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Plan is generating — check back shortly.
        </p>
      </div>
    );
  }

  if (plan.status === "pending_strategy_review" && plan.strategyJson) {
    return (
      <StrategyReview
        planId={plan.id}
        strategy={plan.strategyJson}
        prospect={prospect}
        regenCount={plan.regenCount}
      />
    );
  }

  if (
    (plan.status === "pending_detail_review" || plan.status === "approved") &&
    plan.weeksJson
  ) {
    return (
      <DetailReview
        planId={plan.id}
        weeks={plan.weeksJson}
        prospect={prospect}
        selfReviewPassed={plan.selfReviewPassed}
        selfReviewIssues={plan.selfReviewIssues}
        regenCount={plan.regenCount}
        isApproved={plan.status === "approved"}
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card p-8 text-center">
      <p className="text-muted-foreground">
        No review content available for status: {plan.status}
      </p>
    </div>
  );
}
