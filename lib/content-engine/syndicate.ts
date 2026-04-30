/**
 * Content Engine — cross-platform syndication (CE-14, v1.1).
 *
 * After a blog post is published, syndicates it to enabled external
 * platforms (Medium, LinkedIn Articles, Ghost, Beehiiv, WordPress.com).
 * Each syndicated copy includes a canonical URL pointing back to the
 * home domain so SEO accrues to the subscriber, not the platform.
 *
 * Adapter pattern: each platform implements `SyndicationAdapter`. The
 * orchestrator iterates enabled targets, calls the adapter, and tracks
 * status in `syndication_posts`.
 *
 * Owner: CE-14. Consumer: content-fan-out handler (Step 5) or
 * content_syndicate scheduled task.
 */
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { syndicationTargets, type SyndicationTargetRow } from "@/lib/db/schema/syndication-targets";
import { syndicationPosts } from "@/lib/db/schema/syndication-posts";
import { companies } from "@/lib/db/schema/companies";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { vault } from "@/lib/crypto/vault";
import { markdownToHtml } from "./markdown-to-html";

// ── Types ─────────────────────────────────────────────────────────────

export interface SyndicateInput {
  title: string;
  body: string;
  bodyHtml: string;
  canonicalUrl: string;
  metaDescription: string | null;
  tags: string[];
  ogImageUrl: string | null;
}

export type SyndicateResult =
  | { ok: true; platformUrl: string; platformPostId: string }
  | { ok: false; error: string };

export type SyndicationOrchestrationResult =
  | { ok: true; syndicated: number; failed: number }
  | { ok: false; reason: "kill_switch" | "not_published" | "not_found" | "no_targets" };

interface SyndicationAdapter {
  syndicate(
    input: SyndicateInput,
    credentials: Record<string, string>,
    config: Record<string, unknown>,
  ): Promise<SyndicateResult>;
}

// ── Orchestrator ──────────────────────────────────────────────────────

export async function syndicateBlogPost(
  postId: string,
): Promise<SyndicationOrchestrationResult> {
  if (!killSwitches.content_syndication_enabled) {
    return { ok: false, reason: "kill_switch" };
  }

  const post = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.id, postId))
    .get();

  if (!post) return { ok: false, reason: "not_found" };
  if (post.status !== "published" || !post.published_url) {
    return { ok: false, reason: "not_published" };
  }

  const targets = await db
    .select()
    .from(syndicationTargets)
    .where(
      and(
        eq(syndicationTargets.company_id, post.company_id),
        eq(syndicationTargets.enabled, true),
      ),
    );

  if (targets.length === 0) return { ok: false, reason: "no_targets" };

  const company = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, post.company_id))
    .get();

  const tags = extractTags(post.body);
  const bodyHtml = markdownToHtml(post.body);
  const attribution = `<p><em>Originally published at <a href="${post.published_url}" rel="canonical">${company?.name ?? "our blog"}</a>.</em></p>`;
  const bodyHtmlWithAttribution = bodyHtml + "\n" + attribution;

  const input: SyndicateInput = {
    title: post.title,
    body: post.body,
    bodyHtml: bodyHtmlWithAttribution,
    canonicalUrl: post.published_url,
    metaDescription: post.meta_description,
    tags,
    ogImageUrl: post.og_image_url,
  };

  let syndicated = 0;
  let failed = 0;

  for (const target of targets) {
    const result = await syndicateToTarget(postId, target, input);
    if (result.ok) syndicated++;
    else failed++;
  }

  await logActivity({
    companyId: post.company_id,
    kind: "content_syndicated",
    body: `Blog post "${post.title}" syndicated to ${syndicated} platform(s)${failed > 0 ? `, ${failed} failed` : ""}`,
    meta: { post_id: postId, syndicated, failed },
  });

  return { ok: true, syndicated, failed };
}

async function syndicateToTarget(
  postId: string,
  target: SyndicationTargetRow,
  input: SyndicateInput,
): Promise<SyndicateResult> {
  const existing = await db
    .select({ id: syndicationPosts.id })
    .from(syndicationPosts)
    .where(
      and(
        eq(syndicationPosts.blog_post_id, postId),
        eq(syndicationPosts.syndication_target_id, target.id),
      ),
    )
    .get();

  if (existing) return { ok: true, platformUrl: "", platformPostId: "" };

  const synPostId = randomUUID();
  const now = Date.now();

  await db.insert(syndicationPosts).values({
    id: synPostId,
    blog_post_id: postId,
    syndication_target_id: target.id,
    platform: target.platform,
    status: "syndicating",
    created_at_ms: now,
    attempted_at_ms: now,
  });

  const adapter = getAdapter(target.platform);
  if (!adapter) {
    await markFailed(synPostId, `No adapter for platform: ${target.platform}`);
    return { ok: false, error: `No adapter for platform: ${target.platform}` };
  }

  const credentials = decryptCredentials(target);
  const config = (target.platform_config as Record<string, unknown>) ?? {};

  try {
    const result = await adapter.syndicate(input, credentials, config);

    if (result.ok) {
      await db
        .update(syndicationPosts)
        .set({
          status: "syndicated",
          platform_url: result.platformUrl,
          platform_post_id: result.platformPostId,
          syndicated_at_ms: Date.now(),
        })
        .where(eq(syndicationPosts.id, synPostId));
    } else {
      await markFailed(synPostId, result.error);
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await markFailed(synPostId, msg);
    return { ok: false, error: msg };
  }
}

async function markFailed(synPostId: string, error: string): Promise<void> {
  await db
    .update(syndicationPosts)
    .set({ status: "failed", error_message: error.slice(0, 1000) })
    .where(eq(syndicationPosts.id, synPostId));
}

function decryptCredentials(target: SyndicationTargetRow): Record<string, string> {
  if (!target.credentials) return {};
  try {
    const decrypted = vault.decrypt(
      target.credentials,
      `syndication.${target.platform}.credentials`,
    );
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

function extractTags(body: string): string[] {
  const headings = body.match(/^#{2,3}\s+(.+)$/gm) ?? [];
  return headings
    .slice(0, 5)
    .map((h) => h.replace(/^#{2,3}\s+/, "").replace(/\?$/, "").trim())
    .filter((t) => t.length > 2 && t.length < 40);
}

// ── Adapter registry ──────────────────────────────────────────────────

function getAdapter(platform: string): SyndicationAdapter | null {
  switch (platform) {
    case "medium": return mediumAdapter;
    case "linkedin_articles": return linkedinAdapter;
    case "ghost": return ghostAdapter;
    case "beehiiv": return beehiivAdapter;
    case "wordpress": return wordpressAdapter;
    default: return null;
  }
}

// ── Medium adapter ────────────────────────────────────────────────────
// POST https://api.medium.com/v1/users/{userId}/posts
// Auth: Bearer integration token
// Credentials: { token, user_id }

const mediumAdapter: SyndicationAdapter = {
  async syndicate(input, credentials, _config) {
    const { token, user_id } = credentials;
    if (!token || !user_id) {
      return { ok: false, error: "Medium credentials missing (token, user_id)" };
    }

    const res = await fetch(
      `https://api.medium.com/v1/users/${user_id}/posts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          title: input.title,
          contentFormat: "html",
          content: input.bodyHtml,
          canonicalUrl: input.canonicalUrl,
          tags: input.tags.slice(0, 5),
          publishStatus: "public",
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Medium API ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as { data?: { id?: string; url?: string } };
    return {
      ok: true,
      platformUrl: data.data?.url ?? "",
      platformPostId: data.data?.id ?? "",
    };
  },
};

// ── LinkedIn Articles adapter ─────────────────────────────────────────
// POST https://api.linkedin.com/v2/ugcPosts
// Auth: Bearer OAuth token
// Credentials: { access_token, author_urn }

const linkedinAdapter: SyndicationAdapter = {
  async syndicate(input, credentials, _config) {
    const { access_token, author_urn } = credentials;
    if (!access_token || !author_urn) {
      return { ok: false, error: "LinkedIn credentials missing (access_token, author_urn)" };
    }

    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: author_urn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: input.metaDescription ?? input.title,
            },
            shareMediaCategory: "ARTICLE",
            media: [
              {
                status: "READY",
                originalUrl: input.canonicalUrl,
                title: { text: input.title },
                description: {
                  text: input.metaDescription ?? "",
                },
              },
            ],
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `LinkedIn API ${res.status}: ${body.slice(0, 200)}` };
    }

    const postId = res.headers.get("x-restli-id") ?? "";
    return {
      ok: true,
      platformUrl: `https://www.linkedin.com/feed/update/${postId}`,
      platformPostId: postId,
    };
  },
};

// ── Ghost adapter ─────────────────────────────────────────────────────
// POST https://{admin_url}/ghost/api/admin/posts/
// Auth: JWT from Admin API key
// Credentials: { admin_api_key }
// Config: { admin_url }

const ghostAdapter: SyndicationAdapter = {
  async syndicate(input, credentials, config) {
    const { admin_api_key } = credentials;
    const adminUrl = config.admin_url as string | undefined;
    if (!admin_api_key || !adminUrl) {
      return { ok: false, error: "Ghost credentials missing (admin_api_key, admin_url)" };
    }

    const token = await buildGhostJwt(admin_api_key);

    const res = await fetch(`${adminUrl}/ghost/api/admin/posts/`, {
      method: "POST",
      headers: {
        Authorization: `Ghost ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        posts: [
          {
            title: input.title,
            html: input.bodyHtml,
            status: "published",
            canonical_url: input.canonicalUrl,
            meta_description: input.metaDescription ?? undefined,
            tags: input.tags.map((t) => ({ name: t })),
            ...(input.ogImageUrl ? { feature_image: input.ogImageUrl } : {}),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Ghost API ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as { posts?: Array<{ id?: string; url?: string }> };
    const post = data.posts?.[0];
    return {
      ok: true,
      platformUrl: post?.url ?? "",
      platformPostId: post?.id ?? "",
    };
  },
};

async function buildGhostJwt(apiKey: string): Promise<string> {
  const [id, secret] = apiKey.split(":");
  if (!id || !secret) throw new Error("Invalid Ghost Admin API key format");

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: "/admin/",
  })).toString("base64url");

  const { createHmac } = await import("node:crypto");
  const key = Buffer.from(secret, "hex");
  const signature = createHmac("sha256", key)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

// ── Beehiiv adapter ───────────────────────────────────────────────────
// POST https://api.beehiiv.com/v2/publications/{publicationId}/posts
// Auth: API key header
// Credentials: { api_key }
// Config: { publication_id }

const beehiivAdapter: SyndicationAdapter = {
  async syndicate(input, credentials, config) {
    const { api_key } = credentials;
    const publicationId = config.publication_id as string | undefined;
    if (!api_key || !publicationId) {
      return { ok: false, error: "Beehiiv credentials missing (api_key, publication_id)" };
    }

    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${publicationId}/posts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: input.title,
          subtitle: input.metaDescription ?? undefined,
          content: input.bodyHtml,
          status: "confirmed",
          web_url: input.canonicalUrl,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Beehiiv API ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as { data?: { id?: string; web_url?: string } };
    return {
      ok: true,
      platformUrl: data.data?.web_url ?? "",
      platformPostId: data.data?.id ?? "",
    };
  },
};

// ── WordPress.com adapter ─────────────────────────────────────────────
// POST https://public-api.wordpress.com/rest/v1.1/sites/{siteId}/posts/new
// Auth: Bearer OAuth token
// Credentials: { access_token }
// Config: { site_id }

const wordpressAdapter: SyndicationAdapter = {
  async syndicate(input, credentials, config) {
    const { access_token } = credentials;
    const siteId = config.site_id as string | undefined;
    if (!access_token || !siteId) {
      return { ok: false, error: "WordPress credentials missing (access_token, site_id)" };
    }

    const res = await fetch(
      `https://public-api.wordpress.com/rest/v1.1/sites/${siteId}/posts/new`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: input.title,
          content: input.bodyHtml,
          status: "publish",
          excerpt: input.metaDescription ?? undefined,
          tags: input.tags,
          metadata: [
            { key: "canonical_url", value: input.canonicalUrl },
          ],
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `WordPress API ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as { ID?: number; URL?: string };
    return {
      ok: true,
      platformUrl: data.URL ?? "",
      platformPostId: String(data.ID ?? ""),
    };
  },
};

// ── Query helpers ─────────────────────────────────────────────────────

export async function getSyndicationStatus(postId: string) {
  return db
    .select()
    .from(syndicationPosts)
    .where(eq(syndicationPosts.blog_post_id, postId));
}

export async function getEnabledTargets(companyId: string) {
  return db
    .select()
    .from(syndicationTargets)
    .where(
      and(
        eq(syndicationTargets.company_id, companyId),
        eq(syndicationTargets.enabled, true),
      ),
    );
}

export async function retrySyndication(synPostId: string): Promise<SyndicateResult> {
  const synPost = await db
    .select()
    .from(syndicationPosts)
    .where(eq(syndicationPosts.id, synPostId))
    .get();

  if (!synPost || synPost.status !== "failed") {
    return { ok: false, error: "Not found or not in failed state" };
  }

  const target = await db
    .select()
    .from(syndicationTargets)
    .where(eq(syndicationTargets.id, synPost.syndication_target_id))
    .get();

  if (!target) return { ok: false, error: "Target not found" };

  const post = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.id, synPost.blog_post_id))
    .get();

  if (!post || !post.published_url) {
    return { ok: false, error: "Blog post not found or not published" };
  }

  const company = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, post.company_id))
    .get();

  const tags = extractTags(post.body);
  const bodyHtml = markdownToHtml(post.body);
  const attribution = `<p><em>Originally published at <a href="${post.published_url}" rel="canonical">${company?.name ?? "our blog"}</a>.</em></p>`;

  const input: SyndicateInput = {
    title: post.title,
    body: post.body,
    bodyHtml: bodyHtml + "\n" + attribution,
    canonicalUrl: post.published_url,
    metaDescription: post.meta_description,
    tags,
    ogImageUrl: post.og_image_url,
  };

  await db
    .update(syndicationPosts)
    .set({ status: "syndicating", attempted_at_ms: Date.now(), error_message: null })
    .where(eq(syndicationPosts.id, synPostId));

  const adapter = getAdapter(target.platform);
  if (!adapter) {
    await markFailed(synPostId, `No adapter for platform: ${target.platform}`);
    return { ok: false, error: `No adapter for platform: ${target.platform}` };
  }

  const credentials = decryptCredentials(target);
  const config = (target.platform_config as Record<string, unknown>) ?? {};

  try {
    const result = await adapter.syndicate(input, credentials, config);
    if (result.ok) {
      await db
        .update(syndicationPosts)
        .set({
          status: "syndicated",
          platform_url: result.platformUrl,
          platform_post_id: result.platformPostId,
          syndicated_at_ms: Date.now(),
        })
        .where(eq(syndicationPosts.id, synPostId));
    } else {
      await markFailed(synPostId, result.error);
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await markFailed(synPostId, msg);
    return { ok: false, error: msg };
  }
}
