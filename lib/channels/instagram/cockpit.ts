import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { instagram_replies } from "@/lib/db/schema/instagram";
import type { WaitingItem, HealthBanner } from "@/lib/tasks/cockpit";

export async function getInstagramReplyWaitingItems(
  _nowMs: number,
): Promise<WaitingItem[]> {
  const pending = await db
    .select({
      id: instagram_replies.id,
      inbound_author: instagram_replies.inbound_author,
      reply_type: instagram_replies.reply_type,
      created_at_ms: instagram_replies.created_at_ms,
    })
    .from(instagram_replies)
    .where(eq(instagram_replies.status, "pending_review"))
    .orderBy(instagram_replies.created_at_ms)
    .limit(6);

  return pending.map((r) => ({
    id: `ig_reply_${r.id}`,
    label: `IG ${r.reply_type} — @${r.inbound_author ?? "unknown"}`,
    href: "/lite/content/instagram/replies",
    urgency: { kind: "age_of_wait" as const, value: r.created_at_ms },
    scope: "own" as const,
    source: "instagram_replies",
  }));
}

export async function getInstagramReplyHealthBanners(
  _nowMs: number,
): Promise<HealthBanner[]> {
  const [escalatedResult, pendingResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(instagram_replies)
      .where(eq(instagram_replies.status, "escalated"))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(instagram_replies)
      .where(eq(instagram_replies.status, "pending_review"))
      .then((rows) => rows[0]?.count ?? 0),
  ]);

  const banners: HealthBanner[] = [];

  if (escalatedResult > 0) {
    banners.push({
      id: "ig_escalated",
      severity: "critical",
      summary: `${escalatedResult} escalated Instagram ${escalatedResult === 1 ? "reply" : "replies"}`,
      href: "/lite/content/instagram/replies",
      source: "instagram_replies",
    });
  }

  if (pendingResult > 5) {
    banners.push({
      id: "ig_pending_backlog",
      severity: "warning",
      summary: `${pendingResult} Instagram replies pending review`,
      href: "/lite/content/instagram/replies",
      source: "instagram_replies",
    });
  }

  return banners;
}
