import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  invite_drafts,
  type InviteDraftRow,
} from "@/lib/db/schema/invite-drafts";
import { candidates } from "@/lib/db/schema/candidates";
import { sendEmail } from "@/lib/channels/email/send";
import { transitionCandidateStage } from "./transition-candidate-stage";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import { evaluateInviteSendGate } from "./invite-gate";
import type { DraftInviteResult } from "./draft-invite";
import type { CandidateRow } from "@/lib/db/schema/candidates";
import type { InviteHoldReason } from "@/lib/db/schema/invite-drafts";

const SUPERBAD_VOICE_PROFILE = {
  voiceDescription: "dry, observational, self-deprecating, slow burn",
  toneMarkers: ["dry", "direct", "Melbourne wit", "short sentences"],
  avoidWords: ["synergy", "leverage", "solutions", "exciting opportunity"],
  targetAudience: "creative freelancers",
};

export interface ProcessInviteInput {
  candidate: CandidateRow;
  draft: DraftInviteResult;
  roleBriefId: string | null;
  by: string | null;
}

export interface ProcessInviteOutput {
  draftId: string;
  autoSent: boolean;
  holdReason: InviteHoldReason | null;
  emailMessageId?: string;
}

export async function processInviteDraft(
  input: ProcessInviteInput,
): Promise<ProcessInviteOutput> {
  const { candidate, draft, roleBriefId, by } = input;
  const now = Date.now();

  const driftResult = await checkBrandVoiceDrift(
    draft.body,
    SUPERBAD_VOICE_PROFILE,
  );

  if (!driftResult.pass) {
    const draftId = randomUUID();
    await db.insert(invite_drafts).values({
      id: draftId,
      candidate_id: candidate.id,
      role_brief_id: roleBriefId,
      subject: draft.subject,
      body: draft.body,
      confidence: draft.confidence,
      drift_check_score: driftResult.score,
      drift_check_pass: false,
      status: "pending_review",
      hold_reason: "drift_check_failed",
      created_at_ms: now,
      updated_at_ms: now,
    });
    return { draftId, autoSent: false, holdReason: "drift_check_failed" };
  }

  const gate = await evaluateInviteSendGate({
    candidateId: candidate.id,
    roleBriefId,
    confidence: draft.confidence,
    engagementType: candidate.engagement_type,
  });

  const draftId = randomUUID();

  if (gate.autoSend) {
    const emailResult = await sendEmail({
      to: candidate.email!,
      subject: draft.subject,
      body: draft.body,
      classification: "hiring_invite",
      purpose: `Invite ${candidate.name} to apply`,
      tags: [
        { name: "hiring", value: "invite" },
        { name: "candidate_id", value: candidate.id },
      ],
    });

    const sentAtMs = emailResult.sent ? Date.now() : null;

    await db.insert(invite_drafts).values({
      id: draftId,
      candidate_id: candidate.id,
      role_brief_id: roleBriefId,
      subject: draft.subject,
      body: draft.body,
      confidence: draft.confidence,
      drift_check_score: driftResult.score,
      drift_check_pass: true,
      status: emailResult.sent ? "sent" : "pending_review",
      hold_reason: emailResult.sent ? null : "low_confidence",
      sent_at_ms: sentAtMs,
      email_message_id: emailResult.messageId ?? null,
      created_at_ms: now,
      updated_at_ms: now,
    });

    if (emailResult.sent) {
      transitionCandidateStage(candidate.id, "invited", {
        by,
        meta: {
          invite_draft_id: draftId,
          confidence: draft.confidence,
          auto_sent: true,
        },
      });
    }

    return {
      draftId,
      autoSent: emailResult.sent,
      holdReason: emailResult.sent ? null : ("low_confidence" as const),
      emailMessageId: emailResult.messageId,
    };
  }

  await db.insert(invite_drafts).values({
    id: draftId,
    candidate_id: candidate.id,
    role_brief_id: roleBriefId,
    subject: draft.subject,
    body: draft.body,
    confidence: draft.confidence,
    drift_check_score: driftResult.score,
    drift_check_pass: true,
    status: "pending_review",
    hold_reason: gate.holdReason as InviteHoldReason,
    created_at_ms: now,
    updated_at_ms: now,
  });

  return {
    draftId,
    autoSent: false,
    holdReason: gate.holdReason as InviteHoldReason,
  };
}

export async function sendInviteDraft(
  draftId: string,
  by: string | null,
): Promise<{ sent: boolean; reason?: string }> {
  const draft = await db.query.invite_drafts.findFirst({
    where: eq(invite_drafts.id, draftId),
  });
  if (!draft) {
    return { sent: false, reason: "Draft not found." };
  }
  if (draft.status === "sent") {
    return { sent: false, reason: "Already sent." };
  }

  const candidate = await db.query.candidates.findFirst({
    where: eq(candidates.id, draft.candidate_id),
  });
  if (!candidate) {
    return { sent: false, reason: "Candidate not found." };
  }
  if (!candidate.email) {
    return { sent: false, reason: "Candidate has no email." };
  }

  const emailResult = await sendEmail({
    to: candidate.email,
    subject: draft.subject,
    body: draft.body,
    classification: "hiring_invite",
    purpose: `Invite ${candidate.name} to apply`,
    tags: [
      { name: "hiring", value: "invite" },
      { name: "candidate_id", value: candidate.id },
    ],
  });

  if (!emailResult.sent) {
    return {
      sent: false,
      reason: emailResult.reason ?? "Email send failed.",
    };
  }

  const now = Date.now();
  await db
    .update(invite_drafts)
    .set({
      status: "sent",
      hold_reason: null,
      sent_at_ms: now,
      email_message_id: emailResult.messageId ?? null,
      updated_at_ms: now,
    })
    .where(eq(invite_drafts.id, draftId))
    .run();

  if (candidate.stage === "sourced") {
    transitionCandidateStage(candidate.id, "invited", {
      by,
      meta: {
        invite_draft_id: draftId,
        manual_send: true,
      },
    });
  }

  return { sent: true };
}
