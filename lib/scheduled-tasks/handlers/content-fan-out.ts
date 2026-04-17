/**
 * Scheduled-task handler for `content_fan_out` — on blog approval, fan out
 * to publish + social drafts + visual assets + newsletter rewrite
 * (spec §2.1 Stage 6, §2.2).
 *
 * Payload: `{ post_id: string, company_id: string }` (set by
 * `approveBlogPost()` in CE-3's `review.ts`).
 *
 * Orchestration order:
 *   1. Publish blog post (transitions approved → published)
 *   2. Generate social drafts (text per platform)
 *   3. Generate visual assets (template/AI render per draft)
 *   4. Rewrite for newsletter (Haiku, creates scheduled newsletter_sends row)
 *
 * Steps 2+3 run in sequence because visuals need the draft rows from step 2.
 * Step 4 is independent of 2+3. All steps are best-effort — a failure in
 * social drafts does not block newsletter rewrite, and vice versa.
 *
 * Kill-switch: `content_automations_enabled` (top-level gate). Individual
 * steps have their own kill-switch checks (e.g. `content_newsletter_enabled`
 * for the newsletter rewrite).
 *
 * Owner: CE-6. Consumer: worker dispatch via HANDLER_REGISTRY.
 */
import { z } from "zod";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { publishBlogPost } from "@/lib/content-engine/publish";
import { generateSocialDrafts } from "@/lib/content-engine/social-drafts";
import { generateVisualAssets } from "@/lib/content-engine/visual-assets";
import { rewriteForNewsletter } from "@/lib/content-engine/newsletter-rewrite";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";

// ── Payload ─────────────────────────────────────────────────────────

export const ContentFanOutPayloadSchema = z.object({
  post_id: z.string().min(1),
  company_id: z.string().min(1),
});

export type ContentFanOutPayload = z.infer<typeof ContentFanOutPayloadSchema>;

// ── Handler ─────────────────────────────────────────────────────────

export const handleContentFanOut: TaskHandler = async (task) => {
  if (!killSwitches.content_automations_enabled) return;

  const parsed = ContentFanOutPayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `content_fan_out: invalid payload (${parsed.error.message})`,
    );
  }

  const { post_id, company_id } = parsed.data;

  // Step 1: Publish the blog post (approved → published)
  const publishResult = await publishBlogPost(post_id);
  if (!publishResult.ok) {
    // If publishing fails (wrong status, no domain), log and continue.
    // Social + newsletter still make sense for approved-but-unpublished posts
    // in edge cases (e.g. domain not yet configured).
    await logActivity({
      companyId: company_id,
      kind: "content_post_published",
      body: `Fan-out: publish skipped (${publishResult.reason})`,
      meta: { post_id, reason: publishResult.reason },
    });
  }

  // Step 2+3: Social drafts + visual assets (best-effort)
  try {
    const socialResult = await generateSocialDrafts(post_id);
    if (socialResult.ok) {
      await generateVisualAssets(post_id);
      await logActivity({
        companyId: company_id,
        kind: "content_social_draft_generated",
        body: `Fan-out: social drafts + visuals generated (${socialResult.draftIds.length} platforms)`,
        meta: { post_id, draft_ids: socialResult.draftIds },
      });
    }
  } catch (err) {
    // Social pipeline failure doesn't block newsletter
    await logActivity({
      companyId: company_id,
      kind: "content_social_draft_generated",
      body: `Fan-out: social pipeline error — ${err instanceof Error ? err.message : "unknown"}`,
      meta: { post_id, error: true },
    });
  }

  // Step 3.5: Enqueue content-to-outreach matching (best-effort, async).
  // Only fires for SuperBad's own posts — the library gates on company_id.
  // CE-13: enqueued immediately; handler checks `content_outreach_enabled`.
  if (publishResult.ok) {
    try {
      await enqueueTask({
        task_type: "content_outreach_match",
        runAt: Date.now(),
        payload: { post_id, company_id },
        idempotencyKey: `content_outreach_match:${post_id}`,
      });
    } catch {
      // Enqueue failure doesn't block the rest of fan-out
    }
  }

  // Step 4: Newsletter rewrite (best-effort, independent of social)
  try {
    const nlResult = await rewriteForNewsletter(post_id, company_id);
    if (nlResult.ok) {
      await logActivity({
        companyId: company_id,
        kind: "content_newsletter_scheduled",
        body: `Fan-out: newsletter ${nlResult.format} scheduled`,
        meta: {
          post_id,
          newsletter_send_id: nlResult.newsletterSendId,
          format: nlResult.format,
        },
      });
    }
    // Non-ok results (kill_switch, no_posts, no_config, no_brand_dna)
    // are normal operational states, not errors. The newsletter-rewrite
    // function logs its own activity for the "scheduled" case; for the
    // skip cases we log here for observability.
    if (!nlResult.ok && nlResult.reason !== "kill_switch") {
      await logActivity({
        companyId: company_id,
        kind: "content_newsletter_scheduled",
        body: `Fan-out: newsletter skipped (${nlResult.reason})`,
        meta: { post_id, reason: nlResult.reason },
      });
    }
  } catch (err) {
    await logActivity({
      companyId: company_id,
      kind: "content_newsletter_scheduled",
      body: `Fan-out: newsletter error — ${err instanceof Error ? err.message : "unknown"}`,
      meta: { post_id, error: true },
    });
  }
};

// ── Registry wiring ─────────────────────────────────────────────────

export const CONTENT_FAN_OUT_HANDLERS: HandlerMap = {
  content_fan_out: handleContentFanOut,
};
