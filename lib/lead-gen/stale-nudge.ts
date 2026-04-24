/**
 * Stale nudge generator — finds candidates whose sequences ended
 * via engagement cutoff (stopped_engagement) with no recent activity,
 * and generates a re-engagement stale_nudge draft for Andy's approval.
 *
 * Runs weekly via self-perpetuating scheduled task.
 *
 * Owner: LG-10. Spec: lead-generation.md §4.2, §8.1 (stale_nudge touch_kind).
 */

import { eq, and, lt, isNull } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { outreachSequences } from "@/lib/db/schema/outreach-sequences";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { isBlockedFromOutreach } from "./dnc";
import { generateDraft, type GenerateDraftInput } from "./draft-generator";
import settingsRegistry from "@/lib/settings";
import type { ViabilityProfile } from "./types";

const STALE_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface StaleNudgeResult {
  candidatesChecked: number;
  nudgesGenerated: number;
  skippedDnc: number;
  skippedAlreadyNudged: number;
}

/**
 * Find candidates with stopped_engagement sequences that ended ≥30 days
 * ago (no recent sends), generate a stale_nudge draft for each.
 */
export async function generateStaleNudges(
  dbInstance = defaultDb,
  nowMs = Date.now(),
): Promise<StaleNudgeResult> {
  const result: StaleNudgeResult = {
    candidatesChecked: 0,
    nudgesGenerated: 0,
    skippedDnc: 0,
    skippedAlreadyNudged: 0,
  };

  if (!killSwitches.outreach_send_enabled) return result;

  const staleCutoff = new Date(nowMs - STALE_WINDOW_DAYS * MS_PER_DAY);

  // Find sequences that stopped due to engagement cutoff, at least 30 days ago
  const staleSequences = await dbInstance
    .select()
    .from(outreachSequences)
    .where(
      and(
        eq(outreachSequences.status, "stopped_engagement"),
      ),
    );

  for (const seq of staleSequences) {
    result.candidatesChecked++;

    // Check that the last send was ≥30 days ago
    const sends = await dbInstance
      .select()
      .from(outreachSends)
      .where(eq(outreachSends.sequence_id, seq.id));

    if (sends.length === 0) continue;

    const lastSend = sends.reduce((latest, s) => {
      const sentMs = s.sent_at instanceof Date ? s.sent_at.getTime() : (s.sent_at as number);
      const latestMs = latest.sent_at instanceof Date ? latest.sent_at.getTime() : (latest.sent_at as number);
      return sentMs > latestMs ? s : latest;
    });

    const lastSentMs = lastSend.sent_at instanceof Date
      ? lastSend.sent_at.getTime()
      : (lastSend.sent_at as number);

    if (lastSentMs > staleCutoff.getTime()) continue;

    // Check if a stale_nudge draft already exists for this sequence
    const existingNudge = await dbInstance
      .select({ id: outreachDrafts.id })
      .from(outreachDrafts)
      .where(
        and(
          eq(outreachDrafts.sequence_id, seq.id),
          eq(outreachDrafts.touch_kind, "stale_nudge"),
        ),
      )
      .limit(1);

    if (existingNudge.length > 0) {
      result.skippedAlreadyNudged++;
      continue;
    }

    // Resolve the candidate
    const [firstSendDraft] = sends.length > 0
      ? await dbInstance
          .select({ candidate_id: outreachDrafts.candidate_id })
          .from(outreachDrafts)
          .where(eq(outreachDrafts.id, sends[0].draft_id))
          .limit(1)
      : [null];

    const candidateId = firstSendDraft?.candidate_id;
    if (!candidateId) continue;

    const [candidate] = await dbInstance
      .select()
      .from(leadCandidates)
      .where(eq(leadCandidates.id, candidateId))
      .limit(1);

    if (!candidate?.contact_email) continue;

    // DNC check
    const dncResult = await isBlockedFromOutreach(candidate.contact_email);
    if (dncResult.blocked) {
      result.skippedDnc++;
      continue;
    }

    // Gather prior touches for context
    const priorDraftIds = sends.map((s) => s.draft_id);
    const priorDrafts =
      priorDraftIds.length > 0
        ? await dbInstance
            .select({
              id: outreachDrafts.id,
              subject: outreachDrafts.subject,
              body_markdown: outreachDrafts.body_markdown,
            })
            .from(outreachDrafts)
            .where(eq(outreachDrafts.status, "sent"))
        : [];

    const priorDraftMap = new Map(priorDrafts.map((d) => [d.id, d]));
    const priorTouches = sends
      .filter((s) => priorDraftMap.has(s.draft_id))
      .map((s) => {
        const d = priorDraftMap.get(s.draft_id)!;
        const sentAt =
          s.sent_at instanceof Date
            ? s.sent_at.toISOString()
            : new Date(s.sent_at as number).toISOString();
        return { subject: d.subject, body: d.body_markdown, sent_at: sentAt };
      });

    const standingBrief = await settingsRegistry.get(
      "lead_generation.standing_brief",
    );

    const engagementHistory = sends.map((s, i) => ({
      touchIndex: i + 1,
      opened: s.open_count > 0,
      openCount: s.open_count,
      clicked: s.click_count > 0,
    }));

    const draftInput: GenerateDraftInput = {
      track: seq.track as "saas" | "retainer",
      touchKind: "stale_nudge",
      touchIndex: seq.touches_sent + 1,
      viabilityProfile: candidate.viability_profile_json as ViabilityProfile,
      standingBrief: typeof standingBrief === "string" ? standingBrief : "",
      priorTouches,
      engagementHistory,
      recentBlogPosts: [],
      contactInfo: {
        name: candidate.contact_name ?? undefined,
        email: candidate.contact_email,
        role: candidate.contact_role ?? undefined,
        company: candidate.company_name,
      },
      candidateId,
    };

    const draftOutcome = await generateDraft(draftInput, dbInstance);
    if (!draftOutcome.ok) continue;

    // Link draft to sequence
    await dbInstance
      .update(outreachDrafts)
      .set({
        sequence_id: seq.id,
        deal_id: seq.deal_id,
      })
      .where(eq(outreachDrafts.id, draftOutcome.draft.draftId));

    await logActivity({
      kind: "outreach_sent",
      dealId: seq.deal_id,
      body: `Stale nudge draft generated for ${candidate.contact_email}`,
      createdBy: "system:stale_nudge_generator",
      meta: {
        candidate_id: candidateId,
        sequence_id: seq.id,
        draft_id: draftOutcome.draft.draftId,
      },
    });

    result.nudgesGenerated++;
  }

  return result;
}
