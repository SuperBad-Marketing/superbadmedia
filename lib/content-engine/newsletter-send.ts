/**
 * Content Engine — newsletter send (spec §4.1, §4.3, §4.4).
 *
 * Queries `newsletter_sends` rows whose `scheduled_for_ms` has passed and
 * `sent_at_ms` is still null, resolves `{{READ_MORE_LINK}}` placeholders
 * with actual blog post URLs, injects an unsubscribe link + footer, and
 * sends to every active subscriber for the owning company via `sendEmail()`.
 *
 * Spam Act 2003 compliance:
 *   - `List-Unsubscribe` + `List-Unsubscribe-Post` headers on every email
 *   - One-click unsubscribe link in the email body
 *   - Sender identity via EMAIL_FROM env var
 *
 * Owner: CE-7. Consumer: `content_newsletter_send` handler.
 */
import { eq, and, lte, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  newsletterSends,
  type NewsletterSendRow,
} from "@/lib/db/schema/newsletter-sends";
import {
  newsletterSubscribers,
  type NewsletterSubscriberRow,
} from "@/lib/db/schema/newsletter-subscribers";
import { blogPosts, type BlogPostRow } from "@/lib/db/schema/blog-posts";
import { sendEmail } from "@/lib/channels/email/send";
import { logActivity } from "@/lib/activity-log";

// ── Types ────────────────────────────────────────────────────────────────────

export type NewsletterSendResult =
  | {
      ok: true;
      sendId: string;
      recipientCount: number;
      skippedCount: number;
    }
  | {
      ok: false;
      reason: "no_subscribers" | "send_failed";
      sendId: string;
    };

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get all due newsletter sends (scheduled_for_ms <= now, not yet sent).
 */
export async function getDueNewsletterSends(
  nowMs: number = Date.now(),
): Promise<NewsletterSendRow[]> {
  return db
    .select()
    .from(newsletterSends)
    .where(
      and(
        lte(newsletterSends.scheduled_for_ms, nowMs),
        isNull(newsletterSends.sent_at_ms),
      ),
    )
    .all();
}

/**
 * Send a single newsletter to all active subscribers for its company.
 *
 * Per build-time discipline #49: "No partial sends — all posts approved
 * since the last send go in one email." The content is already assembled
 * by CE-6's rewrite. This function handles per-recipient delivery.
 *
 * Individual recipient failures (suppression, bounce) are counted but
 * do not fail the overall send — the newsletter is marked as sent once
 * delivery is attempted for all active subscribers.
 */
export async function sendNewsletter(
  send: NewsletterSendRow,
): Promise<NewsletterSendResult> {
  // Get active subscribers for this company
  const subscribers = await getActiveSubscribers(send.company_id);

  if (subscribers.length === 0) {
    return { ok: false, reason: "no_subscribers", sendId: send.id };
  }

  // Load blog posts for {{READ_MORE_LINK}} resolution
  const postIds = send.blog_post_ids as string[];
  const posts = await loadBlogPosts(postIds);

  // Resolve {{READ_MORE_LINK}} placeholders in the body
  const resolvedBody = resolveReadMoreLinks(send.body, posts);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://superbadmedia.com.au";

  let sentCount = 0;
  let skippedCount = 0;

  // Send to each subscriber individually (sendEmail handles per-recipient
  // suppression via canSendTo)
  for (const subscriber of subscribers) {
    const unsubscribeUrl = buildUnsubscribeUrl(baseUrl, subscriber.id);

    // Inject unsubscribe footer into body
    const bodyWithFooter = injectUnsubscribeFooter(
      resolvedBody,
      unsubscribeUrl,
    );

    const result = await sendEmail({
      to: subscriber.email,
      subject: send.subject,
      body: bodyWithFooter,
      classification: "transactional",
      purpose: `newsletter:${send.id}`,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [
        { name: "newsletter_send_id", value: send.id },
        { name: "company_id", value: send.company_id },
      ],
    });

    if (result.sent) {
      sentCount++;
    } else {
      skippedCount++;
    }
  }

  // Update the send record
  const nowMs = Date.now();
  await db
    .update(newsletterSends)
    .set({
      sent_at_ms: nowMs,
      recipient_count: sentCount,
    })
    .where(eq(newsletterSends.id, send.id));

  await logActivity({
    companyId: send.company_id,
    kind: "content_newsletter_sent",
    body: `Newsletter sent to ${sentCount} subscriber${sentCount === 1 ? "" : "s"}${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}.`,
    meta: {
      newsletter_send_id: send.id,
      format: send.format,
      recipient_count: sentCount,
      skipped_count: skippedCount,
      post_ids: postIds,
    },
  });

  return {
    ok: true,
    sendId: send.id,
    recipientCount: sentCount,
    skippedCount,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get all active subscribers for a company.
 */
async function getActiveSubscribers(
  companyId: string,
): Promise<NewsletterSubscriberRow[]> {
  return db
    .select()
    .from(newsletterSubscribers)
    .where(
      and(
        eq(newsletterSubscribers.company_id, companyId),
        eq(newsletterSubscribers.status, "active"),
      ),
    )
    .all();
}

/**
 * Load blog posts by IDs, preserving order.
 */
async function loadBlogPosts(postIds: string[]): Promise<BlogPostRow[]> {
  if (postIds.length === 0) return [];

  const allPosts = await db.select().from(blogPosts).all();
  const postMap = new Map(allPosts.map((p) => [p.id, p]));

  return postIds.map((id) => postMap.get(id)).filter(Boolean) as BlogPostRow[];
}

/**
 * Replace `{{READ_MORE_LINK}}` placeholders with actual published URLs.
 *
 * For single format: one placeholder → one URL.
 * For digest format: multiple placeholders replaced in post order.
 * If a post has no published_url, falls back to `/blog/<slug>`.
 */
export function resolveReadMoreLinks(
  body: string,
  posts: BlogPostRow[],
): string {
  let result = body;
  let postIndex = 0;

  // Replace each occurrence of {{READ_MORE_LINK}} with the next post's URL
  while (result.includes("{{READ_MORE_LINK}}") && postIndex < posts.length) {
    const post = posts[postIndex];
    const url = post.published_url ?? `/blog/${post.slug}`;
    result = result.replace("{{READ_MORE_LINK}}", url);
    postIndex++;
  }

  // If any remaining placeholders (more placeholders than posts), remove them
  result = result.replace(/\{\{READ_MORE_LINK\}\}/g, "#");

  return result;
}

/**
 * Build the one-click unsubscribe URL for a subscriber.
 */
export function buildUnsubscribeUrl(
  baseUrl: string,
  subscriberId: string,
): string {
  return `${baseUrl}/api/newsletter/unsubscribe?sid=${encodeURIComponent(subscriberId)}`;
}

/**
 * Inject an unsubscribe footer into the HTML email body.
 * Inserted before the closing </body> tag (or appended if no </body>).
 */
export function injectUnsubscribeFooter(
  body: string,
  unsubscribeUrl: string,
): string {
  const footer = [
    '<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #737373; text-align: center;">',
    `  <p>You received this because you subscribed to this newsletter.</p>`,
    `  <p><a href="${unsubscribeUrl}" style="color: #737373; text-decoration: underline;">Unsubscribe</a></p>`,
    "</div>",
  ].join("\n");

  if (body.includes("</body>")) {
    return body.replace("</body>", `${footer}\n</body>`);
  }

  return body + "\n" + footer;
}
