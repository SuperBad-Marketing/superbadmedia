import { randomUUID } from "node:crypto";
import { eq, and, lt, inArray } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { replyDrafts } from "@/lib/db/schema/reply-drafts";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import { createDiscountCode } from "./discount-codes";
import { isBlockedFromOutreach } from "./dnc";
import { SUPERBAD_SENDER } from "./sender";
import type { ViabilityProfile } from "./types";
import type { ReplyClassificationType } from "@/lib/db/schema/reply-drafts";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const NUDGE_1_DAYS = 3;
const NUDGE_2_DAYS = 7;
const SOFT_CLOSE_DAYS = 14;
const LONG_TAIL_DAYS = 60;

const PROMPT_VERSION_NUDGE = "reply-nudge-v1";
const PROMPT_VERSION_LONG_TAIL = "reply-long-tail-v1";

export interface DropOffRunResult {
  nudge1Generated: number;
  nudge2Generated: number;
  softCloseGenerated: number;
  longTailGenerated: number;
  archivedWarmDormant: number;
  archivedFinal: number;
  skipped: number;
}

/**
 * Scan candidates with sent reply drafts that haven't received a follow-up
 * response. Generate the next drop-off touch based on elapsed time.
 *
 * Called by the daily orchestrator — not a webhook handler.
 */
export async function processDropOffSequence(
  dbInstance = defaultDb,
  nowMs = Date.now(),
): Promise<DropOffRunResult> {
  const result: DropOffRunResult = {
    nudge1Generated: 0,
    nudge2Generated: 0,
    softCloseGenerated: 0,
    longTailGenerated: 0,
    archivedWarmDormant: 0,
    archivedFinal: 0,
    skipped: 0,
  };

  if (!killSwitches.llm_calls_enabled) return result;

  const eligibleStatuses = [
    "replied",
    "drop_off_1",
    "drop_off_2",
    "drop_off_3",
    "warm_dormant",
  ];

  const candidates = await dbInstance
    .select()
    .from(leadCandidates)
    .where(inArray(leadCandidates.reply_status, eligibleStatuses));

  for (const candidate of candidates) {
    if (!candidate.contact_email) {
      result.skipped++;
      continue;
    }

    const dncCheck = await isBlockedFromOutreach(candidate.contact_email);
    if (dncCheck.blocked) {
      result.skipped++;
      continue;
    }

    const lastSentDraft = await getLastSentReplyDraft(candidate.id, dbInstance);
    if (!lastSentDraft) {
      result.skipped++;
      continue;
    }

    const daysSinceSent = (nowMs - lastSentDraft.sent_at_ms!) / MS_PER_DAY;
    const status = candidate.reply_status;

    if (status === "replied" && daysSinceSent >= NUDGE_1_DAYS) {
      const ok = await generateNudgeDraft({
        candidate,
        lastSentDraft,
        nudgeStep: 1,
        dbInstance,
        nowMs,
      });
      if (ok) {
        await dbInstance
          .update(leadCandidates)
          .set({ reply_status: "drop_off_1" })
          .where(eq(leadCandidates.id, candidate.id));
        result.nudge1Generated++;
      } else {
        result.skipped++;
      }
    } else if (status === "drop_off_1" && daysSinceSent >= NUDGE_2_DAYS - NUDGE_1_DAYS) {
      const ok = await generateNudgeDraft({
        candidate,
        lastSentDraft,
        nudgeStep: 2,
        dbInstance,
        nowMs,
      });
      if (ok) {
        await dbInstance
          .update(leadCandidates)
          .set({ reply_status: "drop_off_2" })
          .where(eq(leadCandidates.id, candidate.id));
        result.nudge2Generated++;
      } else {
        result.skipped++;
      }
    } else if (status === "drop_off_2" && daysSinceSent >= SOFT_CLOSE_DAYS - NUDGE_2_DAYS) {
      const ok = await generateNudgeDraft({
        candidate,
        lastSentDraft,
        nudgeStep: 3,
        dbInstance,
        nowMs,
      });
      if (ok) {
        await dbInstance
          .update(leadCandidates)
          .set({ reply_status: "drop_off_3" })
          .where(eq(leadCandidates.id, candidate.id));
        result.softCloseGenerated++;
      } else {
        result.skipped++;
      }
    } else if (status === "drop_off_3" && daysSinceSent >= 0) {
      await dbInstance
        .update(leadCandidates)
        .set({ reply_status: "warm_dormant" })
        .where(eq(leadCandidates.id, candidate.id));

      await logActivity({
        kind: "candidate_rescored",
        body: `${candidate.company_name} → warm_dormant after soft close with no response`,
        meta: { candidate_id: candidate.id },
      });

      result.archivedWarmDormant++;
    } else if (status === "warm_dormant") {
      const originalReplyDraft = await getOriginalReplyDraft(candidate.id, dbInstance);
      const daysSinceOriginalReply = originalReplyDraft?.sent_at_ms
        ? (nowMs - originalReplyDraft.sent_at_ms) / MS_PER_DAY
        : null;

      if (daysSinceOriginalReply != null && daysSinceOriginalReply >= LONG_TAIL_DAYS) {
        const ok = await generateLongTailDraft({
          candidate,
          dbInstance,
          nowMs,
        });
        if (ok) {
          await dbInstance
            .update(leadCandidates)
            .set({ reply_status: "long_tail_sent" })
            .where(eq(leadCandidates.id, candidate.id));
          result.longTailGenerated++;
        } else {
          result.skipped++;
        }
      }
    }
  }

  // Archive candidates whose long-tail touch went unanswered
  const longTailSent = await dbInstance
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.reply_status, "long_tail_sent"));

  for (const candidate of longTailSent) {
    const lastDraft = await getLastSentReplyDraft(candidate.id, dbInstance);
    if (!lastDraft?.sent_at_ms) continue;

    const daysSinceLongTail = (nowMs - lastDraft.sent_at_ms) / MS_PER_DAY;
    if (daysSinceLongTail >= NUDGE_2_DAYS) {
      await dbInstance
        .update(leadCandidates)
        .set({
          reply_status: "archived",
          skipped_at: new Date(nowMs),
          skipped_reason: "long_tail_no_response",
        })
        .where(eq(leadCandidates.id, candidate.id));

      await logActivity({
        kind: "candidate_rescored",
        body: `${candidate.company_name} → archived after long-tail touch with no response`,
        meta: { candidate_id: candidate.id },
      });

      result.archivedFinal++;
    }
  }

  return result;
}

async function getLastSentReplyDraft(
  candidateId: string,
  dbInstance: typeof defaultDb,
) {
  return dbInstance
    .select()
    .from(replyDrafts)
    .where(
      and(
        eq(replyDrafts.candidate_id, candidateId),
        eq(replyDrafts.status, "sent"),
      ),
    )
    .orderBy(replyDrafts.created_at_ms)
    .then((rows) => rows.at(-1) ?? null);
}

async function getOriginalReplyDraft(
  candidateId: string,
  dbInstance: typeof defaultDb,
) {
  return dbInstance
    .select()
    .from(replyDrafts)
    .where(
      and(
        eq(replyDrafts.candidate_id, candidateId),
        eq(replyDrafts.status, "sent"),
      ),
    )
    .orderBy(replyDrafts.created_at_ms)
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

interface NudgeInput {
  candidate: typeof leadCandidates.$inferSelect;
  lastSentDraft: typeof replyDrafts.$inferSelect;
  nudgeStep: 1 | 2 | 3;
  dbInstance: typeof defaultDb;
  nowMs: number;
}

async function generateNudgeDraft(input: NudgeInput): Promise<boolean> {
  const { candidate, lastSentDraft, nudgeStep, dbInstance, nowMs } = input;

  const profile = candidate.viability_profile_json as ViabilityProfile;
  const brandProfile = await getSuperbadBrandProfile(dbInstance);

  const originalClassification = lastSentDraft.prospect_reply_classification as ReplyClassificationType;

  const systemPrompt = buildNudgeSystemPrompt(brandProfile, nudgeStep, originalClassification, candidate.qualified_track);
  const userPrompt = buildNudgeUserPrompt({
    nudgeStep,
    companyName: candidate.company_name,
    contactName: candidate.contact_name,
    originalReply: lastSentDraft.prospect_reply_text,
    originalClassification,
    lastSentSubject: lastSentDraft.subject,
    lastSentBody: lastSentDraft.body_markdown,
    viabilityProfile: profile,
  });

  const startMs = Date.now();
  let rawResponse: string;
  try {
    rawResponse = await invokeLlmText({
      job: "lead-gen-reply-nudge",
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 1024,
    });
  } catch {
    return false;
  }

  const parsed = parseNudgeResponse(rawResponse);
  if (!parsed) return false;

  const driftResult = await checkBrandVoiceDrift(parsed.bodyMarkdown, brandProfile);

  const draftId = randomUUID();
  await dbInstance.insert(replyDrafts).values({
    id: draftId,
    candidate_id: candidate.id,
    in_reply_to_draft_id: null,
    prospect_reply_text: lastSentDraft.prospect_reply_text,
    prospect_reply_classification: originalClassification,
    subject: parsed.subject,
    body_markdown: parsed.bodyMarkdown,
    model_used: "claude-opus-4-6",
    prompt_version: PROMPT_VERSION_NUDGE,
    generation_ms: Date.now() - startMs,
    drift_check_score: driftResult.score != null ? Math.round(driftResult.score * 100) : null,
    drift_check_flagged: !driftResult.pass,
    status: "pending_approval",
    created_at_ms: nowMs,
  });

  await dbInstance
    .update(leadCandidates)
    .set({ reply_draft_id: draftId })
    .where(eq(leadCandidates.id, candidate.id));

  const stepLabels = { 1: "Nudge 1 (day 3)", 2: "Nudge 2 (day 7)", 3: "Soft close (day 14)" } as const;

  await logActivity({
    kind: "draft_generated",
    body: `${stepLabels[nudgeStep]} draft for ${candidate.company_name}`,
    meta: {
      candidate_id: candidate.id,
      reply_draft_id: draftId,
      nudge_step: nudgeStep,
    },
  });

  return true;
}

interface LongTailInput {
  candidate: typeof leadCandidates.$inferSelect;
  dbInstance: typeof defaultDb;
  nowMs: number;
}

async function generateLongTailDraft(input: LongTailInput): Promise<boolean> {
  const { candidate, dbInstance, nowMs } = input;

  const profile = candidate.viability_profile_json as ViabilityProfile;
  const brandProfile = await getSuperbadBrandProfile(dbInstance);

  const priceIncreased = hasPriceIncreased(candidate);

  let discountCode: string | null = null;
  let discountExpiresAtMs: number | null = null;

  if (priceIncreased && candidate.quoted_session_price_cents) {
    const result = await createDiscountCode(
      candidate.id,
      "session",
      candidate.quoted_session_price_cents,
      dbInstance,
    );
    discountCode = result.code;
    discountExpiresAtMs = result.expiresAtMs;
  }

  const systemPrompt = buildLongTailSystemPrompt(brandProfile, candidate.qualified_track, {
    priceIncreased,
    quotedSessionCents: candidate.quoted_session_price_cents,
    discountCode,
  });
  const userPrompt = buildLongTailUserPrompt({
    companyName: candidate.company_name,
    contactName: candidate.contact_name,
    viabilityProfile: profile,
    priceIncreased,
    quotedSessionCents: candidate.quoted_session_price_cents,
    discountCode,
    discountExpiresAtMs,
  });

  const startMs = Date.now();
  let rawResponse: string;
  try {
    rawResponse = await invokeLlmText({
      job: "lead-gen-reply-long-tail",
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 1024,
    });
  } catch {
    return false;
  }

  const parsed = parseNudgeResponse(rawResponse);
  if (!parsed) return false;

  const driftResult = await checkBrandVoiceDrift(parsed.bodyMarkdown, brandProfile);

  const draftId = randomUUID();
  await dbInstance.insert(replyDrafts).values({
    id: draftId,
    candidate_id: candidate.id,
    in_reply_to_draft_id: null,
    prospect_reply_text: "",
    prospect_reply_classification: "positive",
    subject: parsed.subject,
    body_markdown: parsed.bodyMarkdown,
    model_used: "claude-opus-4-6",
    prompt_version: PROMPT_VERSION_LONG_TAIL,
    generation_ms: Date.now() - startMs,
    drift_check_score: driftResult.score != null ? Math.round(driftResult.score * 100) : null,
    drift_check_flagged: !driftResult.pass,
    status: "pending_approval",
    created_at_ms: nowMs,
  });

  await dbInstance
    .update(leadCandidates)
    .set({ reply_draft_id: draftId })
    .where(eq(leadCandidates.id, candidate.id));

  await logActivity({
    kind: "draft_generated",
    body: `Long-tail (day 60) draft for ${candidate.company_name}${priceIncreased ? ` — price hold code ${discountCode}` : ""}`,
    meta: {
      candidate_id: candidate.id,
      reply_draft_id: draftId,
      discount_code: discountCode,
      price_increased: priceIncreased,
    },
  });

  return true;
}

const CURRENT_SESSION_PRICE_CENTS = 39700;

function hasPriceIncreased(
  candidate: typeof leadCandidates.$inferSelect,
): boolean {
  if (!candidate.quoted_session_price_cents) return false;
  return candidate.quoted_session_price_cents < CURRENT_SESSION_PRICE_CENTS;
}

function buildNudgeSystemPrompt(
  brandProfile: Awaited<ReturnType<typeof getSuperbadBrandProfile>>,
  nudgeStep: 1 | 2 | 3,
  classification: ReplyClassificationType,
  track: string,
): string {
  let stepGuidance = "";
  if (nudgeStep === 1) {
    stepGuidance = `NUDGE 1 (day 3): They went quiet after your reply. Don't "check in." Add something new — a different angle on what they originally replied about. Short. One new thought, one soft CTA if natural.`;
  } else if (nudgeStep === 2) {
    stepGuidance = `NUDGE 2 (day 7): Second silence. Different approach entirely. If they asked about the shoot → share proof from a similar business. If they were curious about pricing → reframe value. Don't reference the silence.`;
  } else {
    stepGuidance = `SOFT CLOSE (day 14): Last touch. Warm exit. "The offer's there whenever the timing's right." Include the booking link one final time. Leave the door open, don't push through it.`;
  }

  return `You are writing a follow-up email on behalf of Andy Robinson, founder of SuperBad Marketing (Melbourne, Australia). The prospect replied to an outreach email but went quiet after Andy's response.

BRAND VOICE:
${brandProfile.voiceDescription}
Tone markers: ${brandProfile.toneMarkers.join(", ")}
${brandProfile.avoidWords?.length ? `Words to avoid: ${brandProfile.avoidWords.join(", ")}` : ""}

SENDER IDENTITY:
Name: ${SUPERBAD_SENDER.display_name}
Email: ${SUPERBAD_SENDER.local_part}@${SUPERBAD_SENDER.domain}

PROSPECT TRACK: ${track === "saas" ? "SaaS subscription products" : "Creative + performance retainer"}
ORIGINAL REPLY CLASSIFICATION: ${classification}

TRIAL SHOOT (retainer track primary CTA):
Two tiers — Session ($397, 60-90 min on-site, 1 video, 10-15 photos) and Production ($597, up to 2 hours, 2 videos, 20-25 photos). Both include a custom six-week marketing plan and private portal access.
Booking page: https://superbadmedia.com.au/trial-shoot

${stepGuidance}

RULES:
- Write as Andy. Same voice as the outreach and reply — dry, observational, real.
- NEVER say "following up", "checking in", "bumping this", "as I mentioned", "just wanted to."
- Don't reference the silence or how long it's been. Just add value.
- Match the length of the original conversation. If they wrote short, you write short.
- No fake urgency. No false scarcity.
- The booking link is https://superbadmedia.com.au/trial-shoot — include only when contextually natural.

OUTPUT FORMAT:
Respond with a JSON object only — no prose, no markdown fences:
{"subject": "...", "body_markdown": "..."}`;
}

interface NudgePromptInput {
  nudgeStep: 1 | 2 | 3;
  companyName: string;
  contactName: string | null;
  originalReply: string;
  originalClassification: ReplyClassificationType;
  lastSentSubject: string;
  lastSentBody: string;
  viabilityProfile: ViabilityProfile;
}

function buildNudgeUserPrompt(input: NudgePromptInput): string {
  const sections: string[] = [];

  sections.push(`PROSPECT: ${input.companyName}`);
  if (input.contactName) {
    sections.push(`CONTACT: ${input.contactName}`);
  }

  sections.push(`\nTHEIR ORIGINAL REPLY (classified as ${input.originalClassification}):\n${input.originalReply}`);
  sections.push(`\nLAST EMAIL WE SENT (no response to this):\nSubject: ${input.lastSentSubject}\n${input.lastSentBody}`);

  const wc = input.viabilityProfile.website_content;
  if (wc?.distilled_brief) {
    sections.push(`\nBUSINESS BRIEF:\n${wc.distilled_brief}`);
    if (wc.services_offered.length > 0) {
      sections.push(`Services: ${wc.services_offered.join(", ")}`);
    }
  }

  sections.push(`\nGenerate nudge ${input.nudgeStep} now.`);
  return sections.join("\n");
}

function buildLongTailSystemPrompt(
  brandProfile: Awaited<ReturnType<typeof getSuperbadBrandProfile>>,
  track: string,
  pricing: {
    priceIncreased: boolean;
    quotedSessionCents: number | null;
    discountCode: string | null;
  },
): string {
  let pricingGuidance = "";
  if (pricing.priceIncreased && pricing.quotedSessionCents && pricing.discountCode) {
    const quotedDollars = pricing.quotedSessionCents / 100;
    const currentDollars = CURRENT_SESSION_PRICE_CENTS / 100;
    pricingGuidance = `
PRICE HOLD:
Session tier has gone from $${quotedDollars} to $${currentDollars} since we last spoke. Honour the old price for 7 days with this code.
Discount code: ${pricing.discountCode}
Booking link with code: https://superbadmedia.com.au/trial-shoot?code=${pricing.discountCode}

Frame it as: "We've put our prices up since we last spoke — Session is $${currentDollars} now. Happy to honour the $${quotedDollars} if you book in the next week. After that it's the new price."
This is a courtesy with a real boundary — not fake urgency. The hold has a real deadline.`;
  }

  return `You are writing a long-tail re-engagement email on behalf of Andy Robinson, founder of SuperBad Marketing (Melbourne, Australia). This prospect showed interest ~60 days ago but went quiet. This is the last touch — it must bring genuinely new information, not "remember me."

BRAND VOICE:
${brandProfile.voiceDescription}
Tone markers: ${brandProfile.toneMarkers.join(", ")}
${brandProfile.avoidWords?.length ? `Words to avoid: ${brandProfile.avoidWords.join(", ")}` : ""}

SENDER IDENTITY:
Name: ${SUPERBAD_SENDER.display_name}
Email: ${SUPERBAD_SENDER.local_part}@${SUPERBAD_SENDER.domain}

PROSPECT TRACK: ${track === "saas" ? "SaaS subscription products" : "Creative + performance retainer"}

TRIAL SHOOT:
Two tiers — Session ($397, 60-90 min) and Production ($597, up to 2 hours). Both include a 6-week marketing plan and private portal.
Booking page: https://superbadmedia.com.au/trial-shoot
${pricingGuidance}

RULES:
- This must open with something genuinely new — a new observation about their business, new work you've done, a real update. Not "it's been a while."
- NEVER say "following up", "checking in", "bumping this", "it's been a while", "I know it's been some time."
- Write as Andy. Dry, real, brief. Two-three sentences max for the new observation.
- If a price hold applies, mention it naturally — it's a favour with a deadline, not pressure.
- Include the booking link (with discount code if applicable).
- No fake urgency. The only urgency is the 7-day code expiry, which is real.

OUTPUT FORMAT:
Respond with a JSON object only — no prose, no markdown fences:
{"subject": "...", "body_markdown": "..."}`;
}

interface LongTailPromptInput {
  companyName: string;
  contactName: string | null;
  viabilityProfile: ViabilityProfile;
  priceIncreased: boolean;
  quotedSessionCents: number | null;
  discountCode: string | null;
  discountExpiresAtMs: number | null;
}

function buildLongTailUserPrompt(input: LongTailPromptInput): string {
  const sections: string[] = [];

  sections.push(`PROSPECT: ${input.companyName}`);
  if (input.contactName) {
    sections.push(`CONTACT: ${input.contactName}`);
  }

  const wc = input.viabilityProfile.website_content;
  if (wc?.distilled_brief) {
    sections.push(`\nBUSINESS BRIEF:\n${wc.distilled_brief}`);
    if (wc.services_offered.length > 0) {
      sections.push(`Services: ${wc.services_offered.join(", ")}`);
    }
  }

  if (input.priceIncreased && input.discountCode && input.discountExpiresAtMs) {
    const expiryDate = new Date(input.discountExpiresAtMs).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    sections.push(`\nPRICE HOLD DETAILS:`);
    sections.push(`Code: ${input.discountCode}`);
    sections.push(`Expires: ${expiryDate}`);
    sections.push(`Original price: $${(input.quotedSessionCents ?? 0) / 100}`);
    sections.push(`Current price: $${CURRENT_SESSION_PRICE_CENTS / 100}`);
  }

  sections.push(`\nGenerate the long-tail re-engagement email now.`);
  return sections.join("\n");
}

function parseNudgeResponse(
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
