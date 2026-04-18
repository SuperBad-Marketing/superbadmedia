/**
 * Engagement tier evaluator — classifies each send into the 4-tier model
 * after the 24h cooloff window, updates the cutoff counter on the sequence,
 * and triggers reactive rescoring.
 *
 * Spec §11.1, §16.8. Owner: LG-9.
 *
 * Tiers:
 *   1 — click (any click on any link)
 *   2 — full open (dwell ≥ 60s OR multiple opens)
 *   3 — sub-60s open (all opens dwell < 60s, no clicks)
 *   4 — none (no opens, no clicks)
 */

import { eq, and, lt, isNull, isNotNull } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { outreachSequences } from "@/lib/db/schema/outreach-sequences";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { logActivity } from "@/lib/activity-log";
import {
  rescoreCandidate,
  SAAS_FLOOR,
  RETAINER_FLOOR,
  type EngagementEvent,
  type ReplyClassification,
  type FileNote,
} from "./scoring";
import type { ViabilityProfile } from "./types";

const COOLOFF_MS = 24 * 60 * 60 * 1000;
const DWELL_THRESHOLD_SEC = 60;

export type EngagementTier = 1 | 2 | 3 | 4;

export function classifyEngagementTier(send: {
  click_count: number;
  open_count: number;
  first_open_dwell_sec: number | null;
}): EngagementTier {
  if (send.click_count > 0) return 1;
  if (send.open_count > 0) {
    if (
      send.open_count > 1 ||
      (send.first_open_dwell_sec != null &&
        send.first_open_dwell_sec >= DWELL_THRESHOLD_SEC)
    ) {
      return 2;
    }
    return 3;
  }
  return 4;
}

export interface EvaluateEngagementResult {
  evaluated: number;
  sequencesStopped: number;
  rescored: number;
}

/**
 * Evaluate engagement tiers for all sends past the 24h cooloff window
 * that haven't been classified yet. Updates the send row's
 * `engagement_tier`, rolls the sequence cutoff counter, and triggers
 * reactive rescoring on the candidate.
 */
export async function evaluateEngagementTiers(
  dbInstance = defaultDb,
  now = Date.now(),
): Promise<EvaluateEngagementResult> {
  const cooloffCutoff = now - COOLOFF_MS;

  const pendingSends = await dbInstance
    .select()
    .from(outreachSends)
    .where(
      and(
        isNull(outreachSends.engagement_tier),
        lt(outreachSends.sent_at, new Date(cooloffCutoff)),
      ),
    );

  let evaluated = 0;
  let sequencesStopped = 0;
  let rescored = 0;

  for (const send of pendingSends) {
    const tier = classifyEngagementTier({
      click_count: send.click_count,
      open_count: send.open_count,
      first_open_dwell_sec: send.first_open_dwell_sec,
    });

    await dbInstance
      .update(outreachSends)
      .set({ engagement_tier: tier })
      .where(eq(outreachSends.id, send.id));

    // Roll cutoff counter on the sequence
    const [seq] = await dbInstance
      .select()
      .from(outreachSequences)
      .where(eq(outreachSequences.id, send.sequence_id))
      .limit(1);

    if (seq && seq.status === "active") {
      const isNonEngagement = tier === 3 || tier === 4;
      const newCount = isNonEngagement
        ? seq.consecutive_non_engagements + 1
        : 0;

      await dbInstance
        .update(outreachSequences)
        .set({ consecutive_non_engagements: newCount })
        .where(eq(outreachSequences.id, seq.id));

      if (newCount >= seq.cutoff_threshold) {
        await dbInstance
          .update(outreachSequences)
          .set({
            status: "stopped_engagement",
            stopped_reason: `${newCount} consecutive non-engagements`,
          })
          .where(eq(outreachSequences.id, seq.id));

        await logActivity({
          kind: "sequence_stopped_engagement",
          dealId: seq.deal_id,
          body: `Sequence ${seq.id} stopped: ${newCount} consecutive non-engagements`,
          createdBy: "system:engagement_evaluator",
          meta: { sequence_id: seq.id, tier, consecutive: newCount },
        });

        sequencesStopped++;
      }
    }

    // Trigger reactive rescore on the candidate via the draft
    const [draft] = await dbInstance
      .select({ candidate_id: outreachDrafts.candidate_id })
      .from(outreachDrafts)
      .where(eq(outreachDrafts.id, send.draft_id))
      .limit(1);

    if (draft?.candidate_id) {
      const rescoredOk = await rescoreCandidateFromSend(
        draft.candidate_id,
        send.sequence_id,
        dbInstance,
      );
      if (rescoredOk) rescored++;
    }

    evaluated++;
  }

  return { evaluated, sequencesStopped, rescored };
}

async function rescoreCandidateFromSend(
  candidateId: string,
  sequenceId: string,
  dbInstance = defaultDb,
): Promise<boolean> {
  const [candidate] = await dbInstance
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.id, candidateId))
    .limit(1);

  if (!candidate) return false;

  const sends = await dbInstance
    .select()
    .from(outreachSends)
    .where(eq(outreachSends.sequence_id, sequenceId));

  const engagementHistory: EngagementEvent[] = sends
    .filter((s) => s.engagement_tier != null)
    .map((s) => ({
      tier: s.engagement_tier as 1 | 2 | 3 | 4,
      touchIndex: 0,
    }));

  const repliedSends = sends.filter((s) => s.replied_at != null);
  const replyClassifications: ReplyClassification[] = [];
  const hardBounced = sends.some(
    (s) => s.bounced_at != null && s.bounce_kind === "hard",
  );

  const earliestSend = sends.reduce<number | null>((min, s) => {
    const sentMs =
      s.sent_at instanceof Date ? s.sent_at.getTime() : (s.sent_at as number);
    return min === null || sentMs < min ? sentMs : min;
  }, null);

  const earliestReply = repliedSends.reduce<number | null>((min, s) => {
    if (s.replied_at == null) return min;
    const repliedMs =
      s.replied_at instanceof Date
        ? s.replied_at.getTime()
        : (s.replied_at as unknown as number);
    return min === null || repliedMs < min ? repliedMs : min;
  }, null);

  const result = rescoreCandidate({
    currentSaasScore: candidate.saas_score,
    currentRetainerScore: candidate.retainer_score,
    currentTrack: candidate.qualified_track as "saas" | "retainer",
    viabilityProfile: candidate.viability_profile_json as ViabilityProfile,
    engagementHistory,
    replyClassifications,
    touchesSent: sends.length,
    fileNotes: [] as FileNote[],
    hardBounced,
    trackChangeUsed: candidate.track_change_used ?? false,
    earliestReplyMs: earliestReply,
    earliestTouchMs: earliestSend,
  });

  const trackFloor =
    result.qualifiedTrack === "retainer" ? RETAINER_FLOOR : SAAS_FLOOR;
  const belowFloor =
    result.qualifiedTrack !== null &&
    (result.qualifiedTrack === "saas"
      ? result.saasScore < SAAS_FLOOR
      : result.retainerScore < RETAINER_FLOOR);

  await dbInstance
    .update(leadCandidates)
    .set({
      saas_score: result.saasScore,
      retainer_score: result.retainerScore,
      reactive_adjustment: result.rescoreBreakdown.clampedTotal,
      reactive_adjustment_json: result.rescoreBreakdown,
      rescored_at: new Date(),
      rescore_count: (candidate.rescore_count ?? 0) + 1,
      below_floor_after_rescore: belowFloor,
      ...(result.trackChanged
        ? {
            qualified_track: result.qualifiedTrack!,
            track_change_used: true,
            previous_track: candidate.qualified_track as "saas" | "retainer",
            track_changed_at: new Date(),
          }
        : {}),
    })
    .where(eq(leadCandidates.id, candidateId));

  await logActivity({
    kind: "candidate_rescored",
    body: `Rescored candidate ${candidateId}: ${candidate.saas_score}→${result.saasScore} (SaaS), ${candidate.retainer_score}→${result.retainerScore} (Retainer)`,
    createdBy: "system:engagement_evaluator",
    meta: {
      candidate_id: candidateId,
      old_saas: candidate.saas_score,
      new_saas: result.saasScore,
      old_retainer: candidate.retainer_score,
      new_retainer: result.retainerScore,
      breakdown: result.rescoreBreakdown,
    },
  });

  if (result.trackChanged) {
    await dbInstance
      .update(outreachSequences)
      .set({ track: result.qualifiedTrack! })
      .where(eq(outreachSequences.id, sequenceId));

    await logActivity({
      kind: "candidate_track_changed",
      body: `Candidate ${candidateId} track changed: ${candidate.qualified_track} → ${result.qualifiedTrack}`,
      createdBy: "system:engagement_evaluator",
      meta: {
        candidate_id: candidateId,
        old_track: candidate.qualified_track,
        new_track: result.qualifiedTrack,
        breakdown: result.rescoreBreakdown,
      },
    });
  }

  if (belowFloor) {
    await logActivity({
      kind: "candidate_below_floor",
      body: `Candidate ${candidateId} dropped below ${result.qualifiedTrack} floor (${trackFloor}) after rescore`,
      createdBy: "system:engagement_evaluator",
      meta: {
        candidate_id: candidateId,
        track: result.qualifiedTrack,
        score:
          result.qualifiedTrack === "saas"
            ? result.saasScore
            : result.retainerScore,
        floor: trackFloor,
      },
    });
  }

  return true;
}
