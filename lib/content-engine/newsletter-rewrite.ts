/**
 * Content Engine — newsletter rewrite (spec §4.4, §2.1 Stage 6).
 *
 * Haiku rewrites approved blog post(s) into email format. Hybrid logic:
 *   - Single post since last send → standalone newsletter
 *   - Multiple posts since last send → editorial digest with brief intro
 *
 * Creates a `newsletter_sends` row scheduled for the company's configured
 * send window. The actual sending is handled by `content_newsletter_send`
 * (CE-7).
 *
 * Brand DNA tags injected as system context for voice matching (Haiku tier).
 *
 * Owner: CE-6. Consumer: `content_fan_out` handler.
 */
import { randomUUID } from "node:crypto";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts, type BlogPostRow } from "@/lib/db/schema/blog-posts";
import {
  newsletterSends,
  type NewsletterFormat,
} from "@/lib/db/schema/newsletter-sends";
import { contentEngineConfig } from "@/lib/db/schema/content-engine-config";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmText } from "@/lib/ai/invoke";

// ── Types ────────────────────────────────────────────────────────────────────

export type NewsletterRewriteResult =
  | { ok: true; newsletterSendId: string; format: NewsletterFormat }
  | {
      ok: false;
      reason:
        | "kill_switch"
        | "no_posts"
        | "no_config"
        | "no_brand_dna"
        | "rewrite_failed";
    };

interface RewriteOutput {
  subject: string;
  body: string;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Rewrite approved blog post(s) for newsletter format and schedule the send.
 *
 * Collects all approved/published posts for the company that haven't been
 * included in a previous newsletter send. Hybrid format: single post →
 * standalone rewrite, multiple → editorial digest.
 *
 * Returns the created `newsletter_sends` row ID and format used.
 */
export async function rewriteForNewsletter(
  postId: string,
  companyId: string,
): Promise<NewsletterRewriteResult> {
  if (!killSwitches.content_newsletter_enabled) {
    return { ok: false, reason: "kill_switch" };
  }

  // Gather all approved/published posts not yet included in a newsletter
  const unsent = await getUnsentPosts(companyId);
  if (unsent.length === 0) {
    return { ok: false, reason: "no_posts" };
  }

  // Load company config for send window
  const config = await db
    .select()
    .from(contentEngineConfig)
    .where(eq(contentEngineConfig.company_id, companyId))
    .get();

  if (!config) {
    return { ok: false, reason: "no_config" };
  }

  // Load Brand DNA signal tags for voice matching
  const brandDna = await db
    .select({ signal_tags: brand_dna_profiles.signal_tags })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.company_id, companyId),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .orderBy(desc(brand_dna_profiles.completed_at_ms))
    .get();

  if (!brandDna?.signal_tags) {
    return { ok: false, reason: "no_brand_dna" };
  }

  const format: NewsletterFormat = unsent.length === 1 ? "single" : "digest";
  const rewrite = await generateRewrite(unsent, format, brandDna.signal_tags);

  if (!rewrite) {
    return { ok: false, reason: "rewrite_failed" };
  }

  // Schedule for next send window
  const scheduledForMs = computeNextSendWindow(
    config.send_window_day,
    config.send_window_time,
    config.send_window_tz,
  );

  const sendId = randomUUID();
  const now = Date.now();

  await db.insert(newsletterSends).values({
    id: sendId,
    company_id: companyId,
    blog_post_ids: unsent.map((p) => p.id),
    subject: rewrite.subject,
    body: rewrite.body,
    format,
    scheduled_for_ms: scheduledForMs,
    created_at_ms: now,
  });

  await logActivity({
    companyId,
    kind: "content_newsletter_scheduled",
    body: `Newsletter ${format === "single" ? "rewrite" : "digest"} scheduled (${unsent.length} post${unsent.length > 1 ? "s" : ""})`,
    meta: {
      newsletter_send_id: sendId,
      format,
      post_ids: unsent.map((p) => p.id),
      scheduled_for_ms: scheduledForMs,
    },
  });

  return { ok: true, newsletterSendId: sendId, format };
}

// ── LLM generation ──────────────────────────────────────────────────────────

async function generateRewrite(
  posts: BlogPostRow[],
  format: NewsletterFormat,
  signalTags: unknown,
): Promise<RewriteOutput | null> {
  const tagsStr =
    typeof signalTags === "string"
      ? signalTags
      : JSON.stringify(signalTags);

  const prompt =
    format === "single"
      ? buildStandalonePrompt(posts[0], tagsStr)
      : buildDigestPrompt(posts, tagsStr);

  try {
    const raw = await invokeLlmText({
      job: "content-rewrite-for-newsletter",
      system: `You are rewriting blog content for an email newsletter. Match the brand voice described by these signal tags:\n${tagsStr}`,
      prompt,
      maxTokens: 4096,
    });

    return parseRewriteOutput(raw);
  } catch {
    return null;
  }
}

function buildStandalonePrompt(
  post: BlogPostRow,
  _tagsStr: string,
): string {
  const bodyTruncated = post.body.slice(0, 6000);
  return [
    "Rewrite this blog post as a standalone email newsletter.",
    "Make it conversational and scannable. Include a 'read the full post' link placeholder at the end: {{READ_MORE_LINK}}",
    "The audience opted in — they want this content. No hard sell.",
    "",
    `Title: ${post.title}`,
    `Slug: ${post.slug}`,
    "",
    "Blog body:",
    bodyTruncated,
    "",
    "Respond with valid JSON only:",
    '{ "subject": "email subject line (≤60 chars, voiced)", "body": "full newsletter body in HTML" }',
  ].join("\n");
}

function buildDigestPrompt(
  posts: BlogPostRow[],
  _tagsStr: string,
): string {
  const postSummaries = posts
    .map(
      (p, i) =>
        `${i + 1}. Title: ${p.title}\n   Slug: ${p.slug}\n   Meta: ${p.meta_description ?? "(none)"}\n   Excerpt: ${p.body.slice(0, 500)}`,
    )
    .join("\n\n");

  return [
    `Write an editorial digest newsletter covering ${posts.length} blog posts.`,
    "Include a brief editorial intro, then a headline + short excerpt + {{READ_MORE_LINK}} per post.",
    "Make it feel intentional and curated, not a dump. Conversational, scannable.",
    "",
    "Posts to include:",
    postSummaries,
    "",
    "Respond with valid JSON only:",
    '{ "subject": "email subject line (≤60 chars, voiced)", "body": "full newsletter body in HTML" }',
  ].join("\n");
}

function parseRewriteOutput(raw: string): RewriteOutput | null {
  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "");
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed.subject === "string" &&
      parsed.subject.length > 0 &&
      typeof parsed.body === "string" &&
      parsed.body.length > 0
    ) {
      return { subject: parsed.subject, body: parsed.body };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Send window scheduling ──────────────────────────────────────────────────

/**
 * Compute the next occurrence of the configured send window from now.
 * Returns a ms timestamp.
 *
 * Uses `Intl.DateTimeFormat` for DST-safe timezone computation (same
 * pattern as `next8amMelbourneMs` in UI-13 / `next23MelbourneMs` in UI-4).
 */
export function computeNextSendWindow(
  dayOfWeek: string,
  timeStr: string,
  tz: string,
  nowMs: number = Date.now(),
): number {
  const DAY_MAP: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const targetDay = DAY_MAP[dayOfWeek] ?? 2; // default tuesday
  const [hourStr, minStr] = timeStr.split(":");
  const targetHour = parseInt(hourStr, 10) || 10;
  const targetMinute = parseInt(minStr, 10) || 0;

  // Use Intl to get the current time in the target timezone
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(nowMs)).map((p) => [p.type, p.value]),
  );

  const localYear = parseInt(parts.year, 10);
  const localMonth = parseInt(parts.month, 10) - 1;
  const localDay = parseInt(parts.day, 10);
  const localHour = parseInt(parts.hour, 10);
  const localMinute = parseInt(parts.minute, 10);

  // Build a Date for "today at the target time" in the target tz
  // Then walk forward day-by-day until we hit the target day of week
  // AND the time is in the future
  const localNow = new Date(
    localYear,
    localMonth,
    localDay,
    localHour,
    localMinute,
  );

  let candidate = new Date(
    localYear,
    localMonth,
    localDay,
    targetHour,
    targetMinute,
    0,
    0,
  );

  // Walk forward to the next occurrence of targetDay that's in the future
  for (let i = 0; i < 8; i++) {
    if (candidate.getDay() === targetDay && candidate > localNow) {
      break;
    }
    candidate = new Date(
      candidate.getFullYear(),
      candidate.getMonth(),
      candidate.getDate() + 1,
      targetHour,
      targetMinute,
      0,
      0,
    );
  }

  // Convert local candidate back to UTC ms using the timezone offset
  // We create an ISO string in the target tz and parse it
  const isoInTz = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}T${String(targetHour).padStart(2, "0")}:${String(targetMinute).padStart(2, "0")}:00`;

  // Use a roundtrip through Intl to get the UTC equivalent
  // Build a UTC date and adjust by measuring the offset
  const naiveUtc = new Date(isoInTz + "Z");
  const tzOffset = getTimezoneOffsetMs(tz, naiveUtc.getTime());
  return naiveUtc.getTime() - tzOffset;
}

/**
 * Get the UTC offset in ms for a timezone at a given point in time.
 * Positive = ahead of UTC (e.g. AEST = +36000000).
 */
function getTimezoneOffsetMs(tz: string, refMs: number): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(refMs)).map((p) => [p.type, p.value]),
  );

  const localIso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`;
  const localAsUtcMs = new Date(localIso).getTime();
  return localAsUtcMs - refMs;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get approved/published posts for a company that haven't been included
 * in any newsletter send yet. Ordered oldest-first so the digest reads
 * chronologically.
 */
async function getUnsentPosts(companyId: string): Promise<BlogPostRow[]> {
  // Get all post IDs already included in a newsletter
  const sentRows = await db
    .select({ blog_post_ids: newsletterSends.blog_post_ids })
    .from(newsletterSends)
    .where(eq(newsletterSends.company_id, companyId));

  const sentPostIds = new Set<string>();
  for (const row of sentRows) {
    const ids = row.blog_post_ids as string[];
    if (Array.isArray(ids)) {
      for (const id of ids) sentPostIds.add(id);
    }
  }

  // Get all approved/published posts not yet in a newsletter
  const allPosts = await db
    .select()
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.company_id, companyId),
        // approved or published — both are newsletter-eligible
        // (approved = just approved, published = already live on blog)
      ),
    )
    .orderBy(blogPosts.created_at_ms);

  return allPosts.filter(
    (p) =>
      (p.status === "approved" || p.status === "published") &&
      !sentPostIds.has(p.id),
  );
}
