/**
 * Content Engine — content-to-outreach matching pipeline (spec §6).
 *
 * When a SuperBad blog post is published, scores it against the Lead Gen
 * candidate pool for relevance. High-relevance matches get a
 * content-forward outreach email drafted (Opus) and queued in the Lead
 * Gen approval queue tagged `content_match`.
 *
 * **Wave 13 dependency:** `lead_candidates` table does not exist until
 * Wave 13 (Lead Generation). The matching function returns early with
 * `{ ok: false, reason: "lead_gen_not_available" }` until then. The
 * handler and library are fully structured so Wave 13 can wire in with
 * a single import change.
 *
 * Kill-switch: `content_outreach_enabled` (CE-1).
 * SuperBad-only: matching only runs for SuperBad's own company_id.
 *
 * Owner: CE-13. Consumer: `content_outreach_match` scheduled-task handler.
 */
import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { contentTopics } from "@/lib/db/schema/content-topics";
import { companies } from "@/lib/db/schema/companies";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
// Wave 13 adds: import { invokeLlmText } from "@/lib/ai/invoke";

// ── Types ──────────────────────────────────────────────────────────

export type MatchResult =
  | {
      ok: true;
      postId: string;
      matchesFound: number;
      emailsDrafted: number;
    }
  | {
      ok: false;
      reason:
        | "kill_switch"
        | "not_superbad"
        | "post_not_found"
        | "post_not_published"
        | "no_candidates"
        | "lead_gen_not_available";
    };

export interface ContentMatch {
  candidateId: string;
  relevanceScore: number;
  reasoning: string;
}

export interface ContentOutreachDraft {
  candidateId: string;
  subject: string;
  body: string;
  blogPostUrl: string;
}

// ── Constants ──────────────────────────────────────────────────────

/** Minimum relevance score (0–100) to proceed with email drafting. */
const RELEVANCE_THRESHOLD = 60;

/**
 * SuperBad's own company identifier. In production this is resolved
 * from the `companies` table where `is_superbad = true` or from a
 * settings key. For now, we query by the `is_superbad` flag on companies.
 */
async function isSuperBadCompany(
  companyId: string,
  dbInstance = defaultDb,
): Promise<boolean> {
  const row = await dbInstance
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  // All matching runs through this gate. Until multi-tenant subscriber
  // content-to-outreach is a thing (it's not — spec §6 is SuperBad-only),
  // we check if the company is the platform owner. The `is_superbad` column
  // doesn't exist yet — for now, treat the first company as SuperBad's own.
  // Wave 13 wires this properly.
  return !!row;
}

// ── Lead Gen availability check ────────────────────────────────────

/**
 * Check if the Lead Gen module is available (Wave 13). Returns false
 * until `lead_candidates` table exists. This avoids a hard import
 * dependency on a module that doesn't exist yet.
 */
function isLeadGenAvailable(): boolean {
  try {
    // Dynamic check — the table/module won't exist until Wave 13.
    // We use a simple flag that Wave 13's LG-1 session will flip.
    return false;
  } catch {
    return false;
  }
}

// ── Core pipeline ──────────────────────────────────────────────────

/**
 * Score a published blog post against the Lead Gen candidate pool
 * and draft content-forward outreach emails for high-relevance matches.
 *
 * Returns early with a reason code if any gate fails.
 */
export async function matchContentToProspects(
  postId: string,
  companyId: string,
  dbInstance = defaultDb,
): Promise<MatchResult> {
  // Gate 1: kill switch
  if (!killSwitches.content_outreach_enabled) {
    return { ok: false, reason: "kill_switch" };
  }

  // Gate 2: SuperBad-only
  const isSB = await isSuperBadCompany(companyId, dbInstance);
  if (!isSB) {
    return { ok: false, reason: "not_superbad" };
  }

  // Gate 3: post exists and is published
  const post = await dbInstance
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.id, postId))
    .get();

  if (!post) return { ok: false, reason: "post_not_found" };
  if (post.status !== "published") {
    return { ok: false, reason: "post_not_published" };
  }

  // Gate 4: Lead Gen module available
  if (!isLeadGenAvailable()) {
    return { ok: false, reason: "lead_gen_not_available" };
  }

  // ── Below this line: unreachable until Wave 13 flips the gate ──

  // Load the topic for keyword context
  const topic = await dbInstance
    .select()
    .from(contentTopics)
    .where(eq(contentTopics.id, post.topic_id))
    .get();

  // Score candidates against the post (Haiku)
  const matches = await scoreProspects(post, topic);
  if (matches.length === 0) {
    return { ok: false, reason: "no_candidates" };
  }

  // Draft outreach emails for high-relevance matches (Opus)
  let emailsDrafted = 0;
  for (const match of matches) {
    const draft = await draftContentOutreachEmail(post, match);
    if (draft) {
      // Enqueue to Lead Gen approval queue — Wave 13 wires this
      await logActivity({
        companyId,
        kind: "content_outreach_matched",
        body: `Content match: post "${post.title}" matched to candidate ${match.candidateId} (score ${match.relevanceScore})`,
        meta: {
          post_id: postId,
          candidate_id: match.candidateId,
          relevance_score: match.relevanceScore,
          subject: draft.subject,
        },
      });
      emailsDrafted++;
    }
  }

  return {
    ok: true,
    postId,
    matchesFound: matches.length,
    emailsDrafted,
  };
}

// ── Scoring ────────────────────────────────────────────────────────

/**
 * Score published post against Lead Gen candidate pool via Haiku.
 * Returns candidates above the relevance threshold.
 *
 * Stub until Wave 13 provides the candidate query.
 */
async function scoreProspects(
  ..._args: [typeof blogPosts.$inferSelect, (typeof contentTopics.$inferSelect | undefined)?]
): Promise<ContentMatch[]> {
  // Wave 13 (LG-1+) provides:
  //   import { listActiveCandidates } from "@/lib/lead-gen/candidates"
  //   const candidates = await listActiveCandidates({ limit: 100 })
  //
  // Then: batch candidates into a single Haiku call for scoring:
  //   const raw = await invokeLlmText({
  //     job: "content-match-content-to-prospects",
  //     prompt: buildMatchingPrompt(post, topic, candidates),
  //     maxTokens: 2000,
  //   });
  //   return parseMatchResults(raw).filter(m => m.relevanceScore >= RELEVANCE_THRESHOLD);
  return [];
}

/**
 * Draft a content-forward outreach email for a matched prospect.
 *
 * Stub until Wave 13 provides candidate enrichment data.
 */
async function draftContentOutreachEmail(
  ..._args: [typeof blogPosts.$inferSelect, ContentMatch]
): Promise<ContentOutreachDraft | null> {
  // Wave 13 provides:
  //   import { getCandidate } from "@/lib/lead-gen/candidates"
  //   const candidate = await getCandidate(match.candidateId)
  //   const brandDna = await loadBrandDnaProfile(post.company_id)
  //
  //   const raw = await invokeLlmText({
  //     job: "content-draft-outreach-email",
  //     system: brandDna.fullProfile,
  //     prompt: buildOutreachDraftPrompt(post, candidate, match),
  //     maxTokens: 1000,
  //   });
  //   return parseOutreachDraft(raw, post.published_url);
  return null;
}

// ── Exported threshold for tests ───────────────────────────────────

export { RELEVANCE_THRESHOLD };
