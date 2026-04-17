/**
 * Content Engine — claimable internal content backlog (spec §14.0).
 *
 * Exposes SuperBad's own internal content backlog so Hiring Pipeline
 * can hand trial tasks to candidates without two candidates working
 * on the same item.
 *
 * Atomicity guaranteed via `UPDATE ... WHERE claimed_by IS NULL`.
 * Columns on `content_topics`: `claimed_by`, `claimed_at_ms`,
 * `claim_budget_cap_aud`, `claim_released_at_ms`, `claim_released_reason`.
 *
 * Owner: CE-13. Consumer: Hiring Pipeline trial-task assignment (Wave 18).
 */
import { eq, and, isNull } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { contentTopics } from "@/lib/db/schema/content-topics";
import { logActivity } from "@/lib/activity-log";

// ── Types ──────────────────────────────────────────────────────────

export interface ContentBacklogItem {
  id: string;
  keyword: string;
  rankabilityScore: number | null;
  outline: unknown;
  status: string;
  createdAtMs: number;
}

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: "already_claimed" | "archived" | "ineligible" };

// ── Public API ─────────────────────────────────────────────────────

/**
 * List content items suitable for a given purpose (e.g. trial tasks).
 * Returns unclaimed topics with outlines that are in `queued` status.
 */
export async function listClaimableContentItems(
  opts: {
    suitableFor: "trial_task";
    limit?: number;
    companyId: string;
  },
  dbInstance = defaultDb,
): Promise<ContentBacklogItem[]> {
  const rows = await dbInstance
    .select({
      id: contentTopics.id,
      keyword: contentTopics.keyword,
      rankability_score: contentTopics.rankability_score,
      outline: contentTopics.outline,
      status: contentTopics.status,
      created_at_ms: contentTopics.created_at_ms,
    })
    .from(contentTopics)
    .where(
      and(
        eq(contentTopics.company_id, opts.companyId),
        eq(contentTopics.status, "queued"),
        isNull(contentTopics.claimed_by),
        isNull(contentTopics.claim_released_at_ms),
      ),
    )
    .limit(opts.limit ?? 10);

  return rows
    .filter((r) => r.outline !== null)
    .map((r) => ({
      id: r.id,
      keyword: r.keyword,
      rankabilityScore: r.rankability_score,
      outline: r.outline,
      status: r.status,
      createdAtMs: r.created_at_ms,
    }));
}

/**
 * Atomically claim a content item for a candidate. Fails if already
 * claimed. Caps per-candidate spend in AUD.
 */
export async function claimInternalContentItem(
  contentId: string,
  candidateId: string,
  budgetCapAud: number,
  dbInstance = defaultDb,
): Promise<ClaimResult> {
  const now = Date.now();

  // Atomic claim: only succeeds if `claimed_by IS NULL`
  const result = dbInstance
    .update(contentTopics)
    .set({
      claimed_by: candidateId,
      claimed_at_ms: now,
      claim_budget_cap_aud: budgetCapAud,
    })
    .where(
      and(
        eq(contentTopics.id, contentId),
        eq(contentTopics.status, "queued"),
        isNull(contentTopics.claimed_by),
      ),
    )
    .run();

  if (result.changes === 0) {
    // Check why it failed
    const row = await dbInstance
      .select({
        status: contentTopics.status,
        claimed_by: contentTopics.claimed_by,
      })
      .from(contentTopics)
      .where(eq(contentTopics.id, contentId))
      .get();

    if (!row) return { ok: false, reason: "ineligible" };
    if (row.claimed_by) return { ok: false, reason: "already_claimed" };
    if (row.status !== "queued") return { ok: false, reason: "archived" };
    return { ok: false, reason: "ineligible" };
  }

  await logActivity({
    kind: "content_topic_researched",
    body: `Content item "${contentId}" claimed by candidate ${candidateId} (budget cap $${budgetCapAud})`,
    meta: { content_id: contentId, candidate_id: candidateId, budget_cap_aud: budgetCapAud },
  });

  return { ok: true };
}

/**
 * Release a claim (candidate declined, withdrew, or clean parting).
 * Frees the item for re-claim.
 */
export async function releaseContentItem(
  contentId: string,
  reason: string,
  dbInstance = defaultDb,
): Promise<void> {
  const now = Date.now();

  dbInstance
    .update(contentTopics)
    .set({
      claimed_by: null,
      claimed_at_ms: null,
      claim_budget_cap_aud: null,
      claim_released_at_ms: now,
      claim_released_reason: reason,
    })
    .where(eq(contentTopics.id, contentId))
    .run();

  await logActivity({
    kind: "content_topic_researched",
    body: `Content item "${contentId}" released: ${reason}`,
    meta: { content_id: contentId, reason },
  });
}
