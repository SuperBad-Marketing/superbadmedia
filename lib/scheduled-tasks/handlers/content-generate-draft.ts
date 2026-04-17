/**
 * Scheduled-task handler for `content_generate_draft` — tier-paced automatic
 * blog post generation (spec §2.1 Stage 3, §2.2, Q12).
 *
 * Payload: `{ company_id: string }`. Delegates to `generateBlogPost()` in
 * `lib/content-engine/generate-blog-post.ts`. After each run (success or
 * soft-skip), self-re-enqueues at the tier-paced interval so posts spread
 * evenly across the month.
 *
 * Kill-switch: `content_automations_enabled` (checked here for fast exit;
 * also checked inside `generateBlogPost()` as defence-in-depth).
 *
 * Owner: CE-4. Consumer: worker dispatch via HANDLER_REGISTRY.
 */
import { z } from "zod";
import { eq, and, gte, inArray, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { generateBlogPost } from "@/lib/content-engine/generate-blog-post";
import settingsRegistry from "@/lib/settings";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";

// ── Payload ─────────────────────────────────────────────────────────

export const ContentGenerateDraftPayloadSchema = z.object({
  company_id: z.string().min(1),
});

export type ContentGenerateDraftPayload = z.infer<
  typeof ContentGenerateDraftPayloadSchema
>;

// ── Constants ───────────────────────────────────────────────────────

/** Approximate days in a billing month for pacing. */
const DAYS_PER_MONTH = 30;

/** Minimum gap between generation runs (hours). Prevents hammering. */
const MIN_INTERVAL_HOURS = 12;

/** Idempotency key prefix for deduplication. */
const TASK_KEY_PREFIX = "content_generate_draft:";

// ── Handler ─────────────────────────────────────────────────────────

export const handleContentGenerateDraft: TaskHandler = async (task) => {
  if (!killSwitches.content_automations_enabled) return;

  const parsed = ContentGenerateDraftPayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `content_generate_draft: invalid payload (${parsed.error.message})`,
    );
  }

  const { company_id } = parsed.data;
  const nowMs = Date.now();

  // Check monthly cap before calling generation
  const maxPosts = await settingsRegistry.get("content.max_posts_per_month");
  const publishedThisMonth = await countPublishedThisMonth(company_id, nowMs);

  if (publishedThisMonth >= maxPosts) {
    // Cap reached — re-enqueue at start of next month
    await scheduleNextRun(company_id, nowMs, maxPosts, true);
    return;
  }

  const result = await generateBlogPost(company_id);

  if (result.ok) {
    await logActivity({
      companyId: company_id,
      kind: "content_draft_generated",
      body: `Automatic draft generation completed (post ${result.postId}).`,
      meta: {
        post_id: result.postId,
        source: "scheduled",
        published_this_month: publishedThisMonth,
        cap: maxPosts,
      },
    });
  }

  // Self-perpetuate regardless of outcome. If the result was
  // "already_generating" or "no_topic", the next run will re-check.
  // If "kill_switch", the next handler invocation exits early.
  await scheduleNextRun(company_id, nowMs, maxPosts, false);
};

// ── Scheduling ──────────────────────────────────────────────────────

/**
 * Compute the interval (ms) between generation runs for a given tier cap.
 *
 * Spreads posts evenly across the month:
 *   interval = (30 days / maxPostsPerMonth)
 *
 * Floors at MIN_INTERVAL_HOURS to prevent rapid-fire generation.
 */
function computeIntervalMs(maxPostsPerMonth: number): number {
  if (maxPostsPerMonth <= 0) return DAYS_PER_MONTH * 24 * 60 * 60 * 1000;
  const intervalDays = DAYS_PER_MONTH / maxPostsPerMonth;
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  const floorMs = MIN_INTERVAL_HOURS * 60 * 60 * 1000;
  return Math.max(intervalMs, floorMs);
}

/**
 * Enqueue the next `content_generate_draft` run for a company.
 *
 * When `capReached` is true, delays until the 1st of the next month
 * (approximate — 30 days from now) so we don't burn cycles polling.
 */
async function scheduleNextRun(
  companyId: string,
  nowMs: number,
  maxPosts: number,
  capReached: boolean,
): Promise<void> {
  const delayMs = capReached
    ? DAYS_PER_MONTH * 24 * 60 * 60 * 1000
    : computeIntervalMs(maxPosts);

  const runAtMs = nowMs + delayMs;

  await enqueueTask({
    task_type: "content_generate_draft",
    runAt: runAtMs,
    payload: { company_id: companyId },
    idempotencyKey: `${TASK_KEY_PREFIX}${companyId}:${runAtMs}`,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Count blog posts published (or approved/in_review) this billing month
 * for a company. Uses a rolling 30-day window from now.
 */
async function countPublishedThisMonth(
  companyId: string,
  nowMs: number,
): Promise<number> {
  const windowStartMs = nowMs - DAYS_PER_MONTH * 24 * 60 * 60 * 1000;

  const result = await db
    .select({ total: count() })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.company_id, companyId),
        inArray(blogPosts.status, [
          "in_review",
          "approved",
          "publishing",
          "published",
        ]),
        gte(blogPosts.created_at_ms, windowStartMs),
      ),
    )
    .get();

  return result?.total ?? 0;
}

// ── Bootstrap ───────────────────────────────────────────────────────

/**
 * Idempotently enqueue the first `content_generate_draft` run for a
 * company. Called from onboarding wizard completion or manual trigger.
 *
 * Schedules the first run 1 hour from now so keyword research has time
 * to populate the topic queue first.
 */
export async function ensureContentGenerationEnqueued(
  companyId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  const firstRunDelayMs = 60 * 60 * 1000; // 1 hour
  const runAtMs = nowMs + firstRunDelayMs;

  await enqueueTask({
    task_type: "content_generate_draft",
    runAt: runAtMs,
    payload: { company_id: companyId },
    idempotencyKey: `${TASK_KEY_PREFIX}${companyId}:bootstrap`,
  });
}

// ── Registry wiring ─────────────────────────────────────────────────

export const CONTENT_GENERATE_DRAFT_HANDLERS: HandlerMap = {
  content_generate_draft: handleContentGenerateDraft,
};
