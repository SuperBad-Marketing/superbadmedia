import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates, type CandidateRow } from "@/lib/db/schema/candidates";
import { invokeLlmText } from "@/lib/ai/invoke";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import { transitionCandidateStage } from "./transition-candidate-stage";
import { createCandidateArchive, updateCandidate } from "./queries";
import { killSwitches } from "@/lib/kill-switches";

export type HiringReplyIntent =
  | "positive"
  | "objection"
  | "question"
  | "negative"
  | "auto_responder";

export interface HiringReplyClassification {
  intent: HiringReplyIntent;
  reason: string;
}

export interface RouteHiringReplyInput {
  candidateId: string;
  replyBody: string;
  threadClassification: "hiring_invite" | "hiring_followup_question";
}

export interface RouteHiringReplyResult {
  intent: HiringReplyIntent;
  action: string;
  candidateId: string;
}

export async function classifyHiringReply(
  replyBody: string,
  context: { candidateName: string; threadType: string },
): Promise<HiringReplyClassification> {
  if (!killSwitches.llm_calls_enabled) {
    return { intent: "question", reason: "LLM disabled — defaulting to Andy queue" };
  }

  const prompt = `Classify this inbound email reply from a candidate (${context.candidateName}) on a ${context.threadType} thread.

Reply text:
"""
${replyBody.slice(0, 2000)}
"""

Classify as exactly one of:
- positive: interested, wants to proceed, asks how to apply
- objection: pushes back on rate, timing, scope, or fit
- question: asks for more info without clear positive/negative signal
- negative: explicitly declines, not interested
- auto_responder: out-of-office, vacation auto-reply, delivery notification

Respond with JSON: {"intent": "<classification>", "reason": "<one sentence>"}`;

  try {
    const raw = await invokeLlmText({
      job: "hiring-reply-classify",
      prompt,
      maxTokens: 100,
    });

    const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const validIntents: HiringReplyIntent[] = [
      "positive", "objection", "question", "negative", "auto_responder",
    ];

    if (validIntents.includes(parsed.intent)) {
      return { intent: parsed.intent, reason: parsed.reason ?? "" };
    }
  } catch {
    // fall through to safe default
  }

  return { intent: "question", reason: "Classification failed — routing to Andy" };
}

export async function routeHiringReply(
  input: RouteHiringReplyInput,
): Promise<RouteHiringReplyResult> {
  const candidate = await db.query.candidates.findFirst({
    where: eq(candidates.id, input.candidateId),
  });
  if (!candidate) {
    return { intent: "question", action: "candidate_not_found", candidateId: input.candidateId };
  }

  if (input.threadClassification === "hiring_followup_question") {
    return handleFollowupReply(candidate, input.replyBody);
  }

  const classification = await classifyHiringReply(input.replyBody, {
    candidateName: candidate.name,
    threadType: input.threadClassification,
  });

  switch (classification.intent) {
    case "positive":
      return handlePositiveReply(candidate, classification);
    case "negative":
      return handleNegativeReply(candidate, classification);
    case "auto_responder":
      return handleAutoResponder(candidate);
    case "objection":
    case "question":
    default:
      return handleAndyQueue(candidate, classification);
  }
}

async function handleFollowupReply(
  candidate: CandidateRow,
  replyBody: string,
): Promise<RouteHiringReplyResult> {
  await updateCandidate(candidate.id, {
    application_followup_reply: replyBody.slice(0, 5000),
    followup_status: "replied",
  });

  await logActivity({
    kind: "candidate_followup_received",
    body: `${candidate.name} replied to follow-up question.`,
    meta: { candidate_id: candidate.id, reply_length: replyBody.length },
  });

  return { intent: "positive", action: "followup_reply_stored", candidateId: candidate.id };
}

async function handlePositiveReply(
  candidate: CandidateRow,
  classification: HiringReplyClassification,
): Promise<RouteHiringReplyResult> {
  if (candidate.email && candidate.stage === "invited") {
    await sendEmail({
      to: candidate.email,
      subject: "Here's the link to apply",
      body: buildApplyLinkBody(candidate.name),
      classification: "hiring_invite",
      purpose: `Apply-link reply for ${candidate.name}`,
      tags: [
        { name: "candidate_id", value: candidate.id },
        { name: "type", value: "hiring_apply_link" },
      ],
    });
  }

  await logActivity({
    kind: "candidate_followup_received",
    body: `${candidate.name} replied positively to invite — apply link sent.`,
    meta: {
      candidate_id: candidate.id,
      intent: classification.intent,
      reason: classification.reason,
    },
  });

  return { intent: "positive", action: "apply_link_sent", candidateId: candidate.id };
}

async function handleNegativeReply(
  candidate: CandidateRow,
  classification: HiringReplyClassification,
): Promise<RouteHiringReplyResult> {
  if (candidate.stage !== "archived") {
    await createCandidateArchive({
      candidate_id: candidate.id,
      stage_when_archived: candidate.stage,
      disposition_direction: "they_withdrew",
      reason_code: "they_declined",
      reason_free_text: "They declined",
      reflection_text: classification.reason,
    });

    transitionCandidateStage(candidate.id, "archived", {
      by: "system:reply_intelligence",
      meta: {
        intent: "negative",
        reason: classification.reason,
        auto_archived: true,
      },
    });
  }

  await logActivity({
    kind: "candidate_archived",
    body: `${candidate.name} declined via reply — auto-archived.`,
    meta: {
      candidate_id: candidate.id,
      intent: classification.intent,
      reason: classification.reason,
    },
  });

  return { intent: "negative", action: "auto_archived", candidateId: candidate.id };
}

async function handleAutoResponder(
  candidate: CandidateRow,
): Promise<RouteHiringReplyResult> {
  return { intent: "auto_responder", action: "ignored", candidateId: candidate.id };
}

async function handleAndyQueue(
  candidate: CandidateRow,
  classification: HiringReplyClassification,
): Promise<RouteHiringReplyResult> {
  await logActivity({
    kind: "candidate_followup_received",
    body: `${candidate.name} replied (${classification.intent}) — routed to Andy.`,
    meta: {
      candidate_id: candidate.id,
      intent: classification.intent,
      reason: classification.reason,
    },
  });

  return { intent: classification.intent, action: "andy_queue", candidateId: candidate.id };
}

function buildApplyLinkBody(name: string): string {
  const firstName = name.split(" ")[0];
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1A1A18; max-width: 520px;">
  <p>Hey ${firstName},</p>
  <p>Good to hear. Here's where you can put your details in:</p>
  <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/apply" style="color: #D4A574; text-decoration: underline;">Apply here</a></p>
  <p>Takes about 2 minutes. No cover letter.</p>
  <p style="color: #807F73; font-size: 14px; margin-top: 32px;">SuperBad</p>
</div>`;
}
