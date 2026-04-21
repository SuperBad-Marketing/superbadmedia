import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import type { WaitingItem } from "@/lib/tasks/cockpit";

export async function getSaasWaitingItems(
  nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const items: WaitingItem[] = [];

  const pastDueDeals = await db
    .select({
      id: deals.id,
      company_name: companies.name,
      updated_at_ms: deals.updated_at_ms,
    })
    .from(deals)
    .innerJoin(companies, eq(deals.company_id, companies.id))
    .where(
      and(
        isNotNull(deals.saas_product_id),
        eq(deals.subscription_state, "past_due"),
      ),
    )
    .all();

  for (const d of pastDueDeals) {
    items.push({
      id: `saas_past_due_${d.id}`,
      label: `${d.company_name} — payment failed`,
      href: `/lite/admin/products`,
      urgency: { kind: "time_sensitive", value: d.updated_at_ms },
      scope: "fleet",
      source: "saas-subscription-billing",
    });
  }

  return items;
}
