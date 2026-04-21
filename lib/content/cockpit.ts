import { and, eq, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { companies } from "@/lib/db/schema/companies";
import type { WaitingItem } from "@/lib/tasks/cockpit";

const MS_48H = 48 * 60 * 60 * 1000;

export async function getContentWaitingItems(
  nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const items: WaitingItem[] = [];

  const ownReview = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      updated_at_ms: blogPosts.updated_at_ms,
      company_id: blogPosts.company_id,
    })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.status, "in_review"),
        sql`${blogPosts.company_id} IS NULL`,
      ),
    )
    .all();

  for (const p of ownReview) {
    items.push({
      id: `content_review_own_${p.id}`,
      label: `Draft review — ${p.title}`,
      href: `/lite/content/${p.id}`,
      urgency: { kind: "age_of_wait", value: p.updated_at_ms },
      scope: "own",
      source: "content-engine",
    });
  }

  const fleetStalled = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      company_name: companies.name,
      updated_at_ms: blogPosts.updated_at_ms,
    })
    .from(blogPosts)
    .innerJoin(companies, eq(blogPosts.company_id, companies.id))
    .where(
      and(
        eq(blogPosts.status, "in_review"),
        sql`${blogPosts.company_id} IS NOT NULL`,
        lte(blogPosts.updated_at_ms, nowMs - MS_48H),
      ),
    )
    .all();

  for (const p of fleetStalled) {
    items.push({
      id: `content_review_fleet_${p.id}`,
      label: `${p.company_name} draft stalled — ${p.title}`,
      href: `/lite/content/${p.id}`,
      urgency: { kind: "age_of_wait", value: p.updated_at_ms },
      scope: "fleet",
      source: "content-engine",
    });
  }

  return items;
}
