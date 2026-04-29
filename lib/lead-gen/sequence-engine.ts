/**
 * Sequence engine — processes active sequences that are due for their
 * next touch, generates follow-up drafts, executes sends (including
 * auto-send for graduated tracks), and promotes candidates to deals on
 * first send.
 *
 * Spec §11.2, §11.3, §13.1. Owner: LG-9.
 *
 * The sequence engine is the orchestrator for:
 *   - Follow-up scheduling (cadence: 4 / 7 / 10 days per §11.3)
 *   - Warmup cap enforcement before every send
 *   - Quiet window gate on automated sends
 *   - DNC check at send time
 *   - Deal promotion via `createDealFromLead()` at first-send time
 *   - Autonomy wiring: fires `probation_send_completed` / `auto_send_completed`
 *   - Auto-send delay enforcement via `AUTO_SEND_DELAY_MS` (LG-8 patch)
 */

import { randomUUID } from "node:crypto";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { outreachSequences } from "@/lib/db/schema/outreach-sequences";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import { isWithinQuietWindow } from "@/lib/channels/email/quiet-window";
import { isBlockedFromOutreach } from "./dnc";
import { enforceWarmupCap, recordWarmupSend } from "./warmup";
import { generateDraft, type GenerateDraftInput } from "./draft-generator";
import { getAutonomyRow, transitionAutonomyState, getAutoSendDelayMs } from "./autonomy";
import { SUPERBAD_SENDER, SUPERBAD_FROM_STRING } from "./sender";
import { createDealFromLead } from "@/lib/crm/create-deal-from-lead";
import { transitionDealStage } from "@/lib/crm/transition-deal-stage";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import settingsRegistry from "@/lib/settings";
import { createUnsubscribeUrl } from "./unsubscribe-token";
import type { ViabilityProfile } from "./types";

// §11.3 — Cadence constants (tune in v1.1 based on real data)
const CADENCE_TOUCH_2_DAYS = 4;
const CADENCE_TOUCH_3_DAYS = 7;
const CADENCE_TOUCH_4_PLUS_DAYS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getNextTouchDueMs(
  lastTouchAt: number,
  touchesSent: number,
): number {
  let cadenceDays: number;
  if (touchesSent <= 1) cadenceDays = CADENCE_TOUCH_2_DAYS;
  else if (touchesSent === 2) cadenceDays = CADENCE_TOUCH_3_DAYS;
  else cadenceDays = CADENCE_TOUCH_4_PLUS_DAYS;
  return lastTouchAt + cadenceDays * MS_PER_DAY;
}

export interface SequenceRunResult {
  processed: number;
  draftsGenerated: number;
  autoSendsScheduled: number;
  skippedWarmup: number;
  skippedQuietWindow: number;
  skippedDnc: number;
  sequencesStopped: number;
}

/**
 * Run the sequence scheduler: find active sequences whose next touch is due,
 * enforce gates, generate follow-up drafts, and route through autonomy.
 */
export async function runSequenceScheduler(
  dbInstance = defaultDb,
  nowMs = Date.now(),
): Promise<SequenceRunResult> {
  const result: SequenceRunResult = {
    processed: 0,
    draftsGenerated: 0,
    autoSendsScheduled: 0,
    skippedWarmup: 0,
    skippedQuietWindow: 0,
    skippedDnc: 0,
    sequencesStopped: 0,
  };

  if (!killSwitches.outreach_send_enabled) return result;

  const dueSequences = await dbInstance
    .select()
    .from(outreachSequences)
    .where(
      and(
        eq(outreachSequences.status, "active"),
        isNotNull(outreachSequences.next_touch_due_at),
        lte(outreachSequences.next_touch_due_at, new Date(nowMs)),
      ),
    );

  for (const seq of dueSequences) {
    result.processed++;

    // Gate: warmup cap
    const warmup = await enforceWarmupCap(dbInstance);
    if (!warmup.can_send) {
      result.skippedWarmup++;
      continue;
    }

    // Gate: quiet window (automated sends are gated per §13.3 exception)
    const inWindow = await isWithinQuietWindow();
    if (!inWindow) {
      result.skippedQuietWindow++;
      continue;
    }

    // Resolve the candidate for this sequence's deal
    const sends = await dbInstance
      .select({
        draft_id: outreachSends.draft_id,
      })
      .from(outreachSends)
      .where(eq(outreachSends.sequence_id, seq.id))
      .limit(1);

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

    // Gate: DNC check
    const dncResult = await isBlockedFromOutreach(
      candidate.contact_email,
      undefined,
    );
    if (dncResult.blocked) {
      const stopReason =
        dncResult.reason === "email"
          ? "stopped_unsubscribe"
          : "stopped_bounce";
      await dbInstance
        .update(outreachSequences)
        .set({
          status: stopReason as "stopped_unsubscribe" | "stopped_bounce",
          stopped_reason: `DNC: ${dncResult.reason}`,
        })
        .where(eq(outreachSequences.id, seq.id));

      result.skippedDnc++;
      result.sequencesStopped++;
      continue;
    }

    // Gather prior touches for context
    const priorSends = await dbInstance
      .select()
      .from(outreachSends)
      .where(eq(outreachSends.sequence_id, seq.id));

    const priorDraftIds = priorSends.map((s) => s.draft_id);
    const priorDrafts =
      priorDraftIds.length > 0
        ? await dbInstance
            .select({
              id: outreachDrafts.id,
              subject: outreachDrafts.subject,
              body_markdown: outreachDrafts.body_markdown,
            })
            .from(outreachDrafts)
            .where(
              eq(outreachDrafts.status, "sent"),
            )
        : [];

    // Filter to only drafts that belong to this sequence's sends
    const priorDraftMap = new Map(priorDrafts.map((d) => [d.id, d]));
    const priorTouches = priorSends
      .filter((s) => priorDraftMap.has(s.draft_id))
      .map((s) => {
        const d = priorDraftMap.get(s.draft_id)!;
        const sentAt =
          s.sent_at instanceof Date
            ? s.sent_at.toISOString()
            : new Date(s.sent_at as number).toISOString();
        return { subject: d.subject, body: d.body_markdown, sent_at: sentAt };
      });

    const touchIndex = seq.touches_sent + 1;

    // Generate follow-up draft
    const standingBrief = await settingsRegistry.get(
      "lead_generation.standing_brief",
    );

    const engagementHistory = priorSends.map((s, i) => ({
      touchIndex: i + 1,
      opened: s.open_count > 0,
      openCount: s.open_count,
      clicked: s.click_count > 0,
    }));

    const draftInput: GenerateDraftInput = {
      track: seq.track as "saas" | "retainer",
      touchKind: "follow_up",
      touchIndex,
      viabilityProfile:
        candidate.viability_profile_json as ViabilityProfile,
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

    result.draftsGenerated++;

    // Check autonomy: auto-send or hold for approval
    const autonomy = await getAutonomyRow(seq.track as "saas" | "retainer");
    if (
      autonomy.mode === "auto_send" ||
      autonomy.mode === "probation"
    ) {
      // Schedule auto-send with configurable delay per §12.H
      const autoSendDelayMs = await getAutoSendDelayMs();
      await enqueueTask({
        task_type: "auto_send_execute",
        runAt: nowMs + autoSendDelayMs,
        payload: {
          draft_id: draftOutcome.draft.draftId,
          sequence_id: seq.id,
          candidate_id: candidateId,
          autonomy_mode: autonomy.mode,
        },
        idempotencyKey: `auto_send:${draftOutcome.draft.draftId}`,
      });

      await dbInstance
        .update(outreachDrafts)
        .set({
          status: "approved_queued",
          approval_kind: "auto_send",
          approved_at: new Date(),
        })
        .where(eq(outreachDrafts.id, draftOutcome.draft.draftId));

      result.autoSendsScheduled++;
    }
    // else: draft stays in pending_approval for manual review
  }

  return result;
}

export interface SendDraftResult {
  sent: boolean;
  messageId?: string;
  reason?: string;
}

/**
 * Execute the actual send for an approved/auto-send draft. Creates the
 * `outreach_sends` row, updates sequence state, promotes candidate to deal
 * on first send, and fires autonomy events.
 */
export async function executeSend(
  draftId: string,
  sequenceId: string,
  candidateId: string,
  autonomyMode: "manual" | "probation" | "auto_send",
  dbInstance = defaultDb,
): Promise<SendDraftResult> {
  const [draft] = await dbInstance
    .select()
    .from(outreachDrafts)
    .where(eq(outreachDrafts.id, draftId))
    .limit(1);

  if (!draft) return { sent: false, reason: "draft_not_found" };
  if (draft.status !== "approved_queued") {
    return { sent: false, reason: `invalid_status:${draft.status}` };
  }

  const [candidate] = await dbInstance
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.id, candidateId))
    .limit(1);

  if (!candidate?.contact_email) {
    return { sent: false, reason: "no_contact_email" };
  }

  const [seq] = await dbInstance
    .select()
    .from(outreachSequences)
    .where(eq(outreachSequences.id, sequenceId))
    .limit(1);

  if (!seq) return { sent: false, reason: "sequence_not_found" };

  // Final warmup check
  const warmup = await enforceWarmupCap(dbInstance);
  if (!warmup.can_send) {
    return { sent: false, reason: "warmup_cap_reached" };
  }

  // Final DNC check (belt-and-braces at send time per §12.1)
  const dncResult = await isBlockedFromOutreach(candidate.contact_email);
  if (dncResult.blocked) {
    return { sent: false, reason: `dnc:${dncResult.reason}` };
  }

  // Build HTML body from markdown
  const htmlBody = markdownToHtml(draft.body_markdown);

  // Generate HMAC-signed unsubscribe URL per §12.L
  const unsubUrl = createUnsubscribeUrl({
    email: candidate.contact_email,
    candidate_id: candidateId,
    issued_at: Date.now(),
  });

  const sendResult = await sendEmail({
    to: candidate.contact_email,
    subject: draft.subject,
    body: htmlBody + renderUnsubscribeFooter(unsubUrl),
    classification: "outreach",
    purpose: `lead_gen_${draft.touch_kind}_touch_${draft.touch_index}`,
    replyTo: SUPERBAD_SENDER.reply_to,
    headers: {
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [
      { name: "track", value: seq.track },
      { name: "touch_kind", value: draft.touch_kind },
      { name: "touch_index", value: String(draft.touch_index) },
    ],
  });

  if (!sendResult.sent) {
    return { sent: false, reason: sendResult.reason };
  }

  // Record send
  const sendId = randomUUID();
  const nowMs = Date.now();

  await dbInstance.insert(outreachSends).values({
    id: sendId,
    draft_id: draftId,
    sequence_id: sequenceId,
    deal_id: seq.deal_id,
    resend_message_id: sendResult.messageId ?? randomUUID(),
    sent_at: new Date(nowMs),
  });

  // Update draft status
  await dbInstance
    .update(outreachDrafts)
    .set({ status: "sent" })
    .where(eq(outreachDrafts.id, draftId));

  // Update sequence state
  const nextDueMs = getNextTouchDueMs(nowMs, seq.touches_sent + 1);
  await dbInstance
    .update(outreachSequences)
    .set({
      touches_sent: seq.touches_sent + 1,
      last_touch_at: new Date(nowMs),
      next_touch_due_at: new Date(nextDueMs),
    })
    .where(eq(outreachSequences.id, sequenceId));

  // Record warmup send
  await recordWarmupSend(dbInstance);

  // §13.1 — Promote candidate to deal on first send
  if (!candidate.promoted_to_deal_id && draft.touch_kind === "first_touch") {
    try {
      const dealResult = createDealFromLead({
        company: {
          name: candidate.company_name,
          domain: candidate.domain ?? undefined,
          billing_mode: "stripe",
        },
        contact: {
          name: candidate.contact_name ?? candidate.company_name,
          email: candidate.contact_email,
          role: candidate.contact_role ?? undefined,
        },
        source: `lead_gen_${candidate.sourced_from}`,
      });

      if (dealResult.deal) {
        await dbInstance
          .update(leadCandidates)
          .set({
            promoted_to_deal_id: dealResult.deal.id,
            promoted_at: new Date(),
          })
          .where(eq(leadCandidates.id, candidateId));

        await dbInstance
          .update(outreachSequences)
          .set({ deal_id: dealResult.deal.id })
          .where(eq(outreachSequences.id, sequenceId));

        await dbInstance
          .update(outreachDrafts)
          .set({ deal_id: dealResult.deal.id })
          .where(eq(outreachDrafts.id, draftId));

        await dbInstance
          .update(outreachSends)
          .set({ deal_id: dealResult.deal.id })
          .where(eq(outreachSends.id, sendId));

        // Auto-advance lead → contacted: first outreach already sent
        try {
          transitionDealStage(
            dealResult.deal.id,
            "contacted",
            {
              by: "system:sequence_engine",
              meta: { source: "first_outreach_send", send_id: sendId },
            },
            dbInstance,
          );
        } catch {
          // Non-fatal — deal may already be past 'lead' stage
        }
      }
    } catch {
      // Deal creation failure is non-fatal — the send already went out
    }
  }

  // Fire autonomy events (PATCHES_OWED: lg_8_auto_send_probation_send_completed)
  if (autonomyMode === "probation") {
    await transitionAutonomyState(seq.track as "saas" | "retainer", {
      type: "probation_send_completed",
    });
  } else if (autonomyMode === "auto_send") {
    await transitionAutonomyState(seq.track as "saas" | "retainer", {
      type: "auto_send_completed",
    });
  }

  await logActivity({
    kind: "outreach_sent",
    dealId: seq.deal_id,
    body: `Sent ${draft.touch_kind} (touch ${draft.touch_index}) to ${candidate.contact_email}`,
    createdBy: `system:sequence_engine`,
    meta: {
      send_id: sendId,
      draft_id: draftId,
      sequence_id: sequenceId,
      candidate_id: candidateId,
      touch_kind: draft.touch_kind,
      touch_index: draft.touch_index,
      track: seq.track,
      autonomy_mode: autonomyMode,
    },
  });

  return { sent: true, messageId: sendResult.messageId };
}

function markdownToHtml(markdown: string): string {
  return markdown
    .split("\n\n")
    .map((p) => `<p>${p.trim()}</p>`)
    .join("\n");
}

function renderUnsubscribeFooter(unsubUrl: string): string {
  return `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#9ca3af;"><a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a></div>`;
}
