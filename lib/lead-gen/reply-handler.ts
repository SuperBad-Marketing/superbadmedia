import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { replyDrafts } from "@/lib/db/schema/reply-drafts";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import { isBlockedFromOutreach, addDncEmail } from "./dnc";
import { SUPERBAD_SENDER } from "./sender";
import type { ViabilityProfile } from "./types";
import type { ReplyClassificationType } from "@/lib/db/schema/reply-drafts";

const PROMPT_VERSION = "reply-v1";

const NEGATIVE_ACK = "Done. Apologies for the interruption.";

export interface InboundReply {
  candidateId: string;
  replyText: string;
  inReplyToDraftId: string;
}

export interface HandleReplyResult {
  action: "drafted" | "auto_negative" | "auto_responder" | "skipped";
  classification: ReplyClassificationType;
  replyDraftId: string | null;
}

export async function handleInboundReply(
  input: InboundReply,
  dbInstance = defaultDb,
): Promise<HandleReplyResult> {
  const candidate = await dbInstance
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.id, input.candidateId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!candidate) {
    return { action: "skipped", classification: "negative", replyDraftId: null };
  }

  const classification = await classifyReply(input.replyText);

  await dbInstance
    .update(leadCandidates)
    .set({
      last_reply_at_ms: Date.now(),
      reply_status: "replied",
    })
    .where(eq(leadCandidates.id, input.candidateId));

  if (classification === "negative") {
    if (candidate.contact_email) {
      await addDncEmail(candidate.contact_email, "complaint", { reason: "negative_reply", db: dbInstance });
    }
    await dbInstance
      .update(leadCandidates)
      .set({ reply_status: "archived", skipped_at: new Date(), skipped_reason: "negative_reply" })
      .where(eq(leadCandidates.id, input.candidateId));

    await logActivity({
      kind: "candidate_rescored",
      body: `Negative reply from ${candidate.company_name} — auto-DNC + archived`,
      meta: { candidate_id: input.candidateId, classification },
    });

    return { action: "auto_negative", classification, replyDraftId: null };
  }

  if (classification === "auto_responder") {
    await dbInstance
      .update(leadCandidates)
      .set({ reply_status: "awaiting_reply", notes: `Auto-responder received: ${input.replyText.slice(0, 200)}` })
      .where(eq(leadCandidates.id, input.candidateId));

    await logActivity({
      kind: "candidate_rescored",
      body: `Auto-responder from ${candidate.company_name} — noted, will re-queue`,
      meta: { candidate_id: input.candidateId, classification },
    });

    return { action: "auto_responder", classification, replyDraftId: null };
  }

  if (!killSwitches.llm_calls_enabled) {
    return { action: "skipped", classification, replyDraftId: null };
  }

  const originalDraft = await dbInstance
    .select()
    .from(outreachDrafts)
    .where(eq(outreachDrafts.id, input.inReplyToDraftId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const profile = candidate.viability_profile_json as ViabilityProfile;
  const brandProfile = await getSuperbadBrandProfile(dbInstance);

  const systemPrompt = buildReplySystemPrompt(brandProfile, classification, candidate.qualified_track);
  const userPrompt = buildReplyUserPrompt({
    prospectReply: input.replyText,
    classification,
    companyName: candidate.company_name,
    contactName: candidate.contact_name,
    contactRole: candidate.contact_role,
    viabilityProfile: profile,
    originalSubject: originalDraft?.subject ?? null,
    originalBody: originalDraft?.body_markdown ?? null,
    touchKind: originalDraft?.touch_kind ?? "first_touch",
  });

  const startMs = Date.now();
  let rawResponse: string;
  try {
    rawResponse = await invokeLlmText({
      job: "lead-gen-reply-draft",
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 1024,
    });
  } catch {
    return { action: "skipped", classification, replyDraftId: null };
  }

  const parsed = parseReplyResponse(rawResponse);
  if (!parsed) {
    return { action: "skipped", classification, replyDraftId: null };
  }

  const driftResult = await checkBrandVoiceDrift(parsed.bodyMarkdown, brandProfile);

  const draftId = randomUUID();
  await dbInstance.insert(replyDrafts).values({
    id: draftId,
    candidate_id: input.candidateId,
    in_reply_to_draft_id: input.inReplyToDraftId,
    prospect_reply_text: input.replyText,
    prospect_reply_classification: classification,
    subject: parsed.subject,
    body_markdown: parsed.bodyMarkdown,
    model_used: "claude-opus-4-6",
    prompt_version: PROMPT_VERSION,
    generation_ms: Date.now() - startMs,
    drift_check_score: driftResult.score != null ? Math.round(driftResult.score * 100) : null,
    drift_check_flagged: !driftResult.pass,
    status: "pending_approval",
    created_at_ms: Date.now(),
  });

  await dbInstance
    .update(leadCandidates)
    .set({ reply_draft_id: draftId, reply_status: "replied" })
    .where(eq(leadCandidates.id, input.candidateId));

  await logActivity({
    kind: "draft_generated",
    body: `Reply draft generated for ${candidate.company_name} (${classification})`,
    meta: {
      candidate_id: input.candidateId,
      reply_draft_id: draftId,
      classification,
    },
  });

  return { action: "drafted", classification, replyDraftId: draftId };
}

async function classifyReply(text: string): Promise<ReplyClassificationType> {
  if (!killSwitches.llm_calls_enabled) {
    return "question";
  }

  try {
    const result = await invokeLlmText({
      job: "lead-gen-reply-classify",
      prompt: `Classify this email reply into exactly one category.

REPLY:
${text}

Categories:
- positive: Shows interest, wants to learn more, asks to meet, expresses enthusiasm
- question: Asks a specific question about services, pricing, process, or the offer
- objection: Declines, says not interested right now, budget concerns, handles it in-house
- negative: Explicitly asks to stop emailing, remove from list, hostile tone
- auto_responder: Out of office, automated reply, delivery notification

Respond with the category name only, nothing else.`,
      maxTokens: 20,
    });

    const cleaned = result.trim().toLowerCase().replace(/[^a-z_]/g, "");
    const valid: ReplyClassificationType[] = [
      "positive", "question", "objection", "negative", "auto_responder",
    ];
    if (valid.includes(cleaned as ReplyClassificationType)) {
      return cleaned as ReplyClassificationType;
    }
    return "question";
  } catch {
    return "question";
  }
}

function buildReplySystemPrompt(
  brandProfile: Awaited<ReturnType<typeof getSuperbadBrandProfile>>,
  classification: ReplyClassificationType,
  track: string,
): string {
  const trialShootInfo = `Two tiers — Session ($397, 60-90 min on-site, 1 video, 10-15 photos) and Production ($597, up to 2 hours, 2 videos, 20-25 photos). Both include a custom six-week marketing plan and private portal access.
Booking page: https://superbadmedia.com.au/trial-shoot`;

  let classificationGuidance = "";
  if (classification === "positive") {
    classificationGuidance = `This is a POSITIVE reply — they're interested. Be warm, match their energy, answer what they asked. Include the booking link ONLY when the moment feels right — don't force it. The less you say, the sooner they book.`;
  } else if (classification === "question") {
    classificationGuidance = `This is a QUESTION — they want to know something specific. Answer their question directly in 2-3 sentences FIRST, then a soft CTA. Include the booking link if contextually relevant to their question.`;
  } else if (classification === "objection") {
    classificationGuidance = `This is an OBJECTION. Acknowledge it honestly — don't argue, don't dismiss, don't redirect. If there's a natural reframe, offer it gently. Leave the door open. Include the booking link only as a low-pressure "whenever you're ready" option.`;
  }

  return `You are writing a reply to a prospect's email on behalf of Andy Robinson, founder of SuperBad Marketing (Melbourne, Australia).

BRAND VOICE:
${brandProfile.voiceDescription}
Tone markers: ${brandProfile.toneMarkers.join(", ")}
${brandProfile.avoidWords?.length ? `Words to avoid: ${brandProfile.avoidWords.join(", ")}` : ""}

SENDER IDENTITY:
Name: ${SUPERBAD_SENDER.display_name}
Email: ${SUPERBAD_SENDER.local_part}@${SUPERBAD_SENDER.domain}

PROSPECT TRACK: ${track === "saas" ? "SaaS subscription products" : "Creative + performance retainer"}

TRIAL SHOOT (retainer track primary CTA):
${trialShootInfo}

${classificationGuidance}

RULES:
- Write as Andy, first person. Same voice as the outreach — dry, observational, real.
- Match their energy. If they wrote two sentences, you write two sentences.
- Answer their actual question FIRST before adding anything else.
- Don't repeat the observation from the original outreach email. They read it. Move forward.
- Don't pitch. They showed interest — deepen the conversation.
- The booking link is the primary CTA but only include it when the moment is right. Judge this yourself.
- Don't push a specific tier — the booking page handles that. $397 is the anchor if you mention price.
- No follow-up language: "following up", "checking in", "bumping this" are banned.
- No fake urgency. No false scarcity.
- If they raised an objection, acknowledge it honestly before responding. Never dismiss.

OUTPUT FORMAT:
Respond with a JSON object only — no prose, no markdown fences:
{"subject": "...", "body_markdown": "..."}`;
}

interface ReplyPromptInput {
  prospectReply: string;
  classification: ReplyClassificationType;
  companyName: string;
  contactName: string | null;
  contactRole: string | null;
  viabilityProfile: ViabilityProfile;
  originalSubject: string | null;
  originalBody: string | null;
  touchKind: string;
}

function buildReplyUserPrompt(input: ReplyPromptInput): string {
  const sections: string[] = [];

  sections.push(`PROSPECT: ${input.companyName}`);
  if (input.contactName) {
    sections.push(`CONTACT: ${input.contactName}${input.contactRole ? ` (${input.contactRole})` : ""}`);
  }

  sections.push(`\nTHEIR REPLY (classified as ${input.classification}):\n${input.prospectReply}`);

  if (input.originalSubject && input.originalBody) {
    sections.push(`\nORIGINAL OUTREACH EMAIL (${input.touchKind}):\nSubject: ${input.originalSubject}\n${input.originalBody}`);
  }

  sections.push(`\nVIABILITY PROFILE:\n${JSON.stringify(input.viabilityProfile, null, 2)}`);

  const wc = input.viabilityProfile.website_content;
  if (wc?.distilled_brief) {
    sections.push(`\nBUSINESS BRIEF:\n${wc.distilled_brief}`);
    if (wc.services_offered.length > 0) {
      sections.push(`Services: ${wc.services_offered.join(", ")}`);
    }
  }

  sections.push(`\nGenerate the reply now.`);
  return sections.join("\n");
}

function parseReplyResponse(
  raw: string,
): { subject: string; bodyMarkdown: string } | null {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      subject?: unknown;
      body_markdown?: unknown;
    };
    if (typeof parsed.subject !== "string" || typeof parsed.body_markdown !== "string") {
      return null;
    }
    if (!parsed.subject.trim() || !parsed.body_markdown.trim()) {
      return null;
    }
    return {
      subject: parsed.subject.trim(),
      bodyMarkdown: parsed.body_markdown.trim(),
    };
  } catch {
    return null;
  }
}
