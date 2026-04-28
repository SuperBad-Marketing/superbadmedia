"use server";

import { randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  instagram_watched_accounts,
  instagram_competitor_posts,
  instagram_inspiration_reactions,
  type WatchedAccountCategory,
  WATCHED_ACCOUNT_CATEGORIES,
  type EnhancedContentPlanSlot,
} from "@/lib/db/schema/instagram-competitive";
import { instagram_accounts, instagram_content_plans } from "@/lib/db/schema/instagram";
import { tasks } from "@/lib/db/schema/tasks";
import { scrapeWatchedAccounts } from "@/lib/channels/instagram/competitive-scrape";
import { generateCompetitiveStrategy } from "@/lib/channels/instagram/generate-strategy";
import { shouldRegenerateTasteProfile, generateTasteProfile } from "@/lib/channels/instagram/taste-learning";
import { logActivity } from "@/lib/activity-log";

type ActionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export async function addWatchedAccountAction(input: {
  username: string;
  category: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const cleaned = input.username.replace(/^@/, "").trim().toLowerCase();
  if (!cleaned || cleaned.length < 2)
    return { ok: false, error: "Invalid username." };

  const existing = await db
    .select({ id: instagram_watched_accounts.id })
    .from(instagram_watched_accounts)
    .where(eq(instagram_watched_accounts.username, cleaned))
    .get();

  if (existing) return { ok: false, error: "Account already being watched." };

  const count = await db
    .select({ id: instagram_watched_accounts.id })
    .from(instagram_watched_accounts)
    .where(eq(instagram_watched_accounts.status, "active"))
    .all();

  if (count.length >= 15)
    return { ok: false, error: "Maximum 15 watched accounts." };

  const category = WATCHED_ACCOUNT_CATEGORIES.includes(
    input.category as WatchedAccountCategory,
  )
    ? (input.category as WatchedAccountCategory)
    : "wildcard";

  const id = randomUUID();
  await db.insert(instagram_watched_accounts).values({
    id,
    username: cleaned,
    category,
    added_at_ms: Date.now(),
    status: "active",
  });

  revalidatePath("/lite/content/instagram");
  revalidatePath("/lite/admin/settings/instagram");
  return { ok: true, value: { id } };
}

export async function removeWatchedAccountAction(
  accountId: string,
): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  await db
    .update(instagram_watched_accounts)
    .set({ status: "removed" })
    .where(eq(instagram_watched_accounts.id, accountId));

  revalidatePath("/lite/content/instagram");
  revalidatePath("/lite/admin/settings/instagram");
  return { ok: true, value: undefined };
}

export async function updateWatchedAccountCategoryAction(input: {
  accountId: string;
  category: string;
}): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const category = WATCHED_ACCOUNT_CATEGORIES.includes(
    input.category as WatchedAccountCategory,
  )
    ? (input.category as WatchedAccountCategory)
    : "wildcard";

  await db
    .update(instagram_watched_accounts)
    .set({ category })
    .where(eq(instagram_watched_accounts.id, input.accountId));

  revalidatePath("/lite/content/instagram");
  revalidatePath("/lite/admin/settings/instagram");
  return { ok: true, value: undefined };
}

export async function reactToInspirationAction(input: {
  competitorPostId: string;
  reaction: "like" | "dislike";
}): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const existing = await db
    .select({ id: instagram_inspiration_reactions.id })
    .from(instagram_inspiration_reactions)
    .where(
      eq(
        instagram_inspiration_reactions.competitor_post_id,
        input.competitorPostId,
      ),
    )
    .get();

  if (existing) {
    await db
      .update(instagram_inspiration_reactions)
      .set({
        reaction: input.reaction,
        reacted_at_ms: Date.now(),
      })
      .where(eq(instagram_inspiration_reactions.id, existing.id));
  } else {
    await db.insert(instagram_inspiration_reactions).values({
      id: randomUUID(),
      competitor_post_id: input.competitorPostId,
      reaction: input.reaction,
      reacted_at_ms: Date.now(),
    });
  }

  await logActivity({
    kind:
      input.reaction === "like"
        ? "instagram_inspiration_liked"
        : "instagram_inspiration_disliked",
    body: `Inspiration post ${input.reaction}d.`,
    meta: { competitor_post_id: input.competitorPostId },
  });

  shouldRegenerateTasteProfile()
    .then((should) => {
      if (should) return generateTasteProfile();
    })
    .catch(() => {});

  revalidatePath("/lite/content/instagram");
  return { ok: true, value: undefined };
}

export async function generateStrategyAction(): Promise<
  ActionResult<{ planId: string; reportId: string }>
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const account = await db
    .select({ id: instagram_accounts.id, username: instagram_accounts.username })
    .from(instagram_accounts)
    .where(eq(instagram_accounts.status, "active"))
    .limit(1)
    .get();

  if (!account)
    return {
      ok: false,
      error: "No active Instagram account. Connect one in Settings first.",
    };

  const watchedCount = await db
    .select({ id: instagram_watched_accounts.id })
    .from(instagram_watched_accounts)
    .where(eq(instagram_watched_accounts.status, "active"))
    .all();

  if (watchedCount.length > 0) {
    const latestScrape = await db
      .select({ scraped_at_ms: instagram_competitor_posts.scraped_at_ms })
      .from(instagram_competitor_posts)
      .orderBy(desc(instagram_competitor_posts.scraped_at_ms))
      .limit(1)
      .get();

    const oneDayAgo = Date.now() - 86_400_000;
    if (!latestScrape || latestScrape.scraped_at_ms < oneDayAgo) {
      await scrapeWatchedAccounts();
    }
  }

  try {
    const result = await generateCompetitiveStrategy({
      accountId: account.id,
      accountUsername: account.username,
    });

    revalidatePath("/lite/content/instagram");
    revalidatePath("/lite/tasks");
    return { ok: true, value: result };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Strategy generation failed.",
    };
  }
}

export async function fetchInspirationFeedAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      imageUrl: string;
      caption: string | null;
      mediaType: string;
      likes: number;
      comments: number;
      finalScore: number;
      whyHigh: string | null;
      permalink: string | null;
      accountUsername: string;
      accountFollowers: number;
      reaction: "like" | "dislike" | null;
    }>
  >
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const posts = await db
    .select()
    .from(instagram_competitor_posts)
    .orderBy(desc(instagram_competitor_posts.final_score))
    .limit(15)
    .all();

  const reactions = await db
    .select()
    .from(instagram_inspiration_reactions)
    .all();

  const reactionMap = new Map(
    reactions.map((r) => [r.competitor_post_id, r.reaction as "like" | "dislike"]),
  );

  const accountIds = [...new Set(posts.map((p) => p.watched_account_id))];
  const accountMap = new Map<string, { username: string; followers: number }>();

  for (const aid of accountIds) {
    const acc = await db
      .select({
        username: instagram_watched_accounts.username,
        followers: instagram_watched_accounts.followers,
      })
      .from(instagram_watched_accounts)
      .where(eq(instagram_watched_accounts.id, aid))
      .get();

    if (acc) accountMap.set(aid, { username: acc.username, followers: acc.followers ?? 0 });
  }

  return {
    ok: true,
    value: posts.map((p) => ({
      id: p.id,
      imageUrl: p.image_url,
      caption: p.caption,
      mediaType: p.media_type,
      likes: p.likes,
      comments: p.comments,
      finalScore: p.final_score,
      whyHigh: p.why_high,
      permalink: p.ig_permalink,
      accountUsername: accountMap.get(p.watched_account_id)?.username ?? "unknown",
      accountFollowers: accountMap.get(p.watched_account_id)?.followers ?? 0,
      reaction: reactionMap.get(p.id) ?? null,
    })),
  };
}

export async function updateSlotStatusAction(input: {
  planId: string;
  slotIndex: number;
  status: "pending" | "approved" | "created" | "posted" | "pushed_back" | "dropped";
}): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const plan = await db
    .select()
    .from(instagram_content_plans)
    .where(eq(instagram_content_plans.id, input.planId))
    .get();

  if (!plan) return { ok: false, error: "Plan not found." };

  const slots = [...(plan.slots_json as EnhancedContentPlanSlot[])];
  const slot = slots[input.slotIndex];
  if (!slot) return { ok: false, error: "Slot not found." };

  slot.status = input.status;
  if (input.status === "pushed_back" || input.status === "dropped") {
    slot.approved = false;
  }
  if (input.status === "approved") {
    slot.approved = true;
  }
  slots[input.slotIndex] = slot;

  const planStatus = derivePlanStatus(slots);
  await db
    .update(instagram_content_plans)
    .set({ slots_json: slots, status: planStatus, updated_at_ms: Date.now() })
    .where(eq(instagram_content_plans.id, plan.id));

  if (input.status === "created" && slot.task_id) {
    await db
      .update(tasks)
      .set({ status: "done", updated_at_ms: Date.now() })
      .where(eq(tasks.id, slot.task_id));
    revalidatePath("/lite/tasks");
  }

  if (input.status === "posted") {
    await logActivity({
      kind: "instagram_post_published",
      body: `Instagram post published: ${slot.topic}`,
      meta: { plan_id: input.planId, slot_index: input.slotIndex },
    });
  }

  revalidatePath("/lite/content/instagram");
  return { ok: true, value: undefined };
}

function derivePlanStatus(slots: EnhancedContentPlanSlot[]): "awaiting_review" | "partially_approved" | "all_approved" | "expired" {
  const active = slots.filter((s) => s.status !== "dropped");
  if (active.length === 0) return "expired";
  const allApproved = active.every(
    (s) => s.status === "approved" || s.status === "created" || s.status === "posted",
  );
  const someApproved = active.some(
    (s) => s.status === "approved" || s.status === "created" || s.status === "posted",
  );
  if (allApproved) return "all_approved";
  if (someApproved) return "partially_approved";
  return "awaiting_review";
}

export async function syncTaskCompletionToSlotAction(
  taskId: string,
): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const allPlans = await db
    .select()
    .from(instagram_content_plans)
    .all();

  for (const plan of allPlans) {
    const slots = plan.slots_json as EnhancedContentPlanSlot[];
    const slotIndex = slots.findIndex((s) => s.task_id === taskId);
    if (slotIndex === -1) continue;

    const slot = slots[slotIndex];
    if (slot.status === "pending" || slot.status === "approved") {
      slot.status = "created";
      const updated = [...slots];
      updated[slotIndex] = slot;

      await db
        .update(instagram_content_plans)
        .set({ slots_json: updated, updated_at_ms: Date.now() })
        .where(eq(instagram_content_plans.id, plan.id));

      revalidatePath("/lite/content/instagram");
    }
    break;
  }

  return { ok: true, value: undefined };
}

export async function deletePlanAction(
  planId: string,
): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const plan = await db
    .select()
    .from(instagram_content_plans)
    .where(eq(instagram_content_plans.id, planId))
    .get();

  if (!plan) return { ok: false, error: "Plan not found." };

  const slots = plan.slots_json as EnhancedContentPlanSlot[];
  const taskIds = slots
    .map((s) => s.task_id)
    .filter((id): id is string => id !== null);

  for (const taskId of taskIds) {
    await db.delete(tasks).where(eq(tasks.id, taskId));
  }

  await db
    .delete(instagram_content_plans)
    .where(eq(instagram_content_plans.id, planId));

  await logActivity({
    kind: "instagram_plan_deleted",
    body: "Content plan deleted.",
    meta: { plan_id: planId, tasks_removed: taskIds.length },
  });

  revalidatePath("/lite/content/instagram");
  revalidatePath("/lite/tasks");
  return { ok: true, value: undefined };
}

export async function rescrapeInspirationAction(): Promise<
  ActionResult<{ postsStored: number }>
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const watchedCount = await db
    .select({ id: instagram_watched_accounts.id })
    .from(instagram_watched_accounts)
    .where(eq(instagram_watched_accounts.status, "active"))
    .all();

  if (watchedCount.length === 0)
    return { ok: false, error: "No watched accounts. Add some in Settings first." };

  try {
    const result = await scrapeWatchedAccounts();
    revalidatePath("/lite/content/instagram");
    return { ok: true, value: { postsStored: result.postsStored } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Scrape failed.",
    };
  }
}

export async function fetchEnhancedPlanAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      accountId: string;
      weekStartDate: string;
      weekEndDate: string;
      themeSummary: string;
      slots: EnhancedContentPlanSlot[];
      status: string;
      strategyReportId: string | null;
    }>
  >
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const plans = await db
    .select()
    .from(instagram_content_plans)
    .orderBy(desc(instagram_content_plans.created_at_ms))
    .all();

  return {
    ok: true,
    value: plans
      .filter((p) => p.status !== "expired")
      .map((p) => ({
        id: p.id,
        accountId: p.account_id,
        weekStartDate: p.week_start_date,
        weekEndDate: p.week_end_date,
        themeSummary: p.theme_summary,
        slots: p.slots_json as EnhancedContentPlanSlot[],
        status: p.status,
        strategyReportId: p.strategy_report_id,
      })),
  };
}
