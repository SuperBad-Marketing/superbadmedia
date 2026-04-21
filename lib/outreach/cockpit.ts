import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import type { WaitingItem } from "@/lib/tasks/cockpit";

export async function getLeadGenWaitingItems(
  _nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const items: WaitingItem[] = [];

  const pendingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(outreachDrafts)
    .where(eq(outreachDrafts.status, "pending_approval"))
    .get();

  const count = pendingCount?.count ?? 0;
  if (count > 0) {
    const oldest = await db
      .select({ created_at: outreachDrafts.created_at })
      .from(outreachDrafts)
      .where(eq(outreachDrafts.status, "pending_approval"))
      .orderBy(outreachDrafts.created_at)
      .limit(1)
      .get();

    items.push({
      id: "outreach_pending_approval",
      label: `${count} outreach draft${count === 1 ? "" : "s"} awaiting approval`,
      href: "/lite/outreach?filter=pending",
      urgency: {
        kind: "age_of_wait",
        value: oldest?.created_at?.getTime() ?? _nowMs,
      },
      scope: "own",
      source: "lead-generation",
    });
  }

  return items;
}
