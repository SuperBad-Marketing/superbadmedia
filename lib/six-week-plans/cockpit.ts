import { and, eq, isNotNull, isNull, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { companies } from "@/lib/db/schema/companies";
import type { WaitingItem } from "@/lib/tasks/cockpit";

export async function getSixWeekPlanWaitingItems(
  _nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const items: WaitingItem[] = [];

  const pendingReview = await db
    .select({
      id: six_week_plans.id,
      status: six_week_plans.status,
      company_name: companies.name,
      updated_at_ms: six_week_plans.updated_at_ms,
    })
    .from(six_week_plans)
    .leftJoin(companies, eq(six_week_plans.company_id, companies.id))
    .where(
      inArray(six_week_plans.status, [
        "pending_strategy_review",
        "pending_detail_review",
      ]),
    )
    .all();

  for (const p of pendingReview) {
    const name = p.company_name ?? "Plan";
    const kind =
      p.status === "pending_strategy_review" ? "strategy" : "detail";
    items.push({
      id: `swp_review_${p.id}`,
      label: `${name} — ${kind} review`,
      href: `/lite/plans/${p.id}`,
      urgency: { kind: "age_of_wait", value: p.updated_at_ms },
      scope: "own",
      source: "six-week-plan-generator",
    });
  }

  const pendingRevision = await db
    .select({
      id: six_week_plans.id,
      company_name: companies.name,
      revision_requested_at_ms: six_week_plans.revision_requested_at_ms,
    })
    .from(six_week_plans)
    .leftJoin(companies, eq(six_week_plans.company_id, companies.id))
    .where(
      and(
        isNotNull(six_week_plans.revision_requested_at_ms),
        isNull(six_week_plans.revision_resolution),
        eq(six_week_plans.status, "approved"),
      ),
    )
    .all();

  for (const p of pendingRevision) {
    const name = p.company_name ?? "Plan";
    items.push({
      id: `swp_revision_${p.id}`,
      label: `${name} — revision request`,
      href: `/lite/plans/${p.id}`,
      urgency: {
        kind: "age_of_wait",
        value: p.revision_requested_at_ms!,
      },
      scope: "own",
      source: "six-week-plan-generator",
    });
  }

  return items;
}
