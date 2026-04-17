/**
 * Content Engine — subscriber fleet overview (CE-11).
 *
 * Spec: docs/specs/content-engine.md §8.2.
 *
 * Aggregation queries for the admin fleet view at `/lite/content/subscribers`.
 * Shows: total active subscribers, posts published this month, aggregate list
 * size, per-subscriber engine status + health signals.
 *
 * Owner: CE-11. Consumers: fleet overview page.
 */
import { eq, and, gte, count } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { contentEngineConfig } from "@/lib/db/schema/content-engine-config";
import { newsletterSubscribers } from "@/lib/db/schema/newsletter-subscribers";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { companies } from "@/lib/db/schema/companies";

// ── Types ────────────────────────────────────────────────────────────────────

export type EngineStatus =
  | "healthy"
  | "draft_waiting"
  | "domain_not_verified"
  | "list_declining";

export interface FleetSummary {
  totalSubscribers: number;
  postsPublishedThisMonth: number;
  aggregateListSize: number;
  subscribersWithUnreviewedDrafts: number;
}

export interface FleetSubscriberRow {
  companyId: string;
  companyName: string;
  engineStatus: EngineStatus;
  postCount: number;
  listSize: number;
  lastReviewDateMs: number | null;
  unreviewedDraftCount: number;
}

// ── Fleet summary ───────────────────────────────────────────────────────────

/**
 * Aggregate summary cards for the fleet overview.
 */
export async function getFleetSummary(
  opts?: { db?: typeof defaultDb },
): Promise<FleetSummary> {
  const database = opts?.db ?? defaultDb;

  // Total subscriber companies (companies with a content_engine_config row)
  const configs = await database
    .select({ company_id: contentEngineConfig.company_id })
    .from(contentEngineConfig)
    .all();
  const totalSubscribers = configs.length;

  // Posts published this month
  const startOfMonthMs = getStartOfMonthMs();
  const publishedThisMonth = await database
    .select({ cnt: count() })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.status, "published"),
        gte(blogPosts.published_at_ms, startOfMonthMs),
      ),
    )
    .get();

  // Aggregate list size (active newsletter subscribers across all companies)
  const activeListSize = await database
    .select({ cnt: count() })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, "active"))
    .get();

  // Subscribers with unreviewed drafts (companies that have in_review posts)
  const unreviewedCompanies = await database
    .select({ company_id: blogPosts.company_id })
    .from(blogPosts)
    .where(eq(blogPosts.status, "in_review"))
    .groupBy(blogPosts.company_id)
    .all();

  return {
    totalSubscribers,
    postsPublishedThisMonth: publishedThisMonth?.cnt ?? 0,
    aggregateListSize: activeListSize?.cnt ?? 0,
    subscribersWithUnreviewedDrafts: unreviewedCompanies.length,
  };
}

// ── Per-subscriber fleet list ───────────────────────────────────────────────

/**
 * Compact list: one row per subscriber company showing engine status,
 * post count, list size, last review date.
 *
 * Spec §8.2: "one row per subscriber showing engine status (healthy /
 * draft waiting / domain not verified / list declining), post count,
 * list size, last review date."
 */
export async function getFleetList(
  opts?: { db?: typeof defaultDb },
): Promise<FleetSubscriberRow[]> {
  const database = opts?.db ?? defaultDb;

  // Get all companies with content engine configs
  const configs = await database
    .select({
      company_id: contentEngineConfig.company_id,
      embed_form_token: contentEngineConfig.embed_form_token,
    })
    .from(contentEngineConfig)
    .all();

  if (configs.length === 0) return [];

  const companyIds = configs.map((c) => c.company_id);

  // Load company names
  const allCompanies = await database.select().from(companies).all();
  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

  // Load all blog posts for these companies
  const allPosts = await database.select().from(blogPosts).all();

  // Load active subscriber counts per company
  const allSubs = await database
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, "active"))
    .all();

  const result: FleetSubscriberRow[] = [];

  for (const config of configs) {
    const company = companyMap.get(config.company_id);
    if (!company) continue;

    const companyPosts = allPosts.filter(
      (p) => p.company_id === config.company_id,
    );
    const publishedCount = companyPosts.filter(
      (p) => p.status === "published",
    ).length;
    const inReviewPosts = companyPosts.filter(
      (p) => p.status === "in_review",
    );
    const unreviewedDraftCount = inReviewPosts.length;

    // List size: active subscribers for this company
    const companySubs = allSubs.filter(
      (s) => s.company_id === config.company_id,
    );
    const listSize = companySubs.length;

    // Last review date: most recent updated_at_ms on approved/rejected posts
    const reviewedPosts = companyPosts
      .filter(
        (p) =>
          p.status === "approved" ||
          p.status === "published" ||
          p.status === "rejected",
      )
      .sort((a, b) => b.updated_at_ms - a.updated_at_ms);
    const lastReviewDateMs =
      reviewedPosts.length > 0 ? reviewedPosts[0].updated_at_ms : null;

    // Engine status determination
    const engineStatus = deriveEngineStatus({
      unreviewedDraftCount,
      hasDomain: !!company.domain,
      listSize,
      allSubsForCompany: await database
        .select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.company_id, config.company_id))
        .all(),
    });

    result.push({
      companyId: config.company_id,
      companyName: company.name,
      engineStatus,
      postCount: publishedCount,
      listSize,
      lastReviewDateMs,
      unreviewedDraftCount,
    });
  }

  return result;
}

// ── Status derivation ───────────────────────────────────────────────────────

function deriveEngineStatus(params: {
  unreviewedDraftCount: number;
  hasDomain: boolean;
  listSize: number;
  allSubsForCompany: Array<{ status: string; removed_at_ms: number | null }>;
}): EngineStatus {
  // Priority order per spec §8.2
  if (!params.hasDomain) return "domain_not_verified";
  if (params.unreviewedDraftCount > 0) return "draft_waiting";

  // List declining: more removed than active in the last 30 days
  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentRemovals = params.allSubsForCompany.filter(
    (s) =>
      (s.status === "bounced" ||
        s.status === "unsubscribed" ||
        s.status === "inactive_removed") &&
      s.removed_at_ms &&
      s.removed_at_ms > thirtyDaysAgoMs,
  ).length;

  if (recentRemovals > params.listSize && params.listSize > 0) {
    return "list_declining";
  }

  return "healthy";
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getStartOfMonthMs(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}
