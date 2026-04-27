/**
 * Outreach draft generator — Opus-tier per-prospect email generation.
 * Spec §8. Every email is generated end-to-end per prospect by LLM (no
 * templates — memory `feedback_outreach_never_templated`).
 *
 * Drift-checked via `checkBrandVoiceDrift()` per §8.4. One auto-regen
 * on drift failure; second failure flags visibly without blocking.
 *
 * Owner: LG-5. Consumer: daily search runner, nudge regeneration.
 */

import { randomUUID } from "node:crypto";
import { eq, asc } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { brand_voice_examples } from "@/lib/db/schema/brand-voice-examples";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import { SUPERBAD_SENDER } from "./sender";
import { fetchFunnelHistory, type FunnelHistory } from "./funnel-history";
import type { ViabilityProfile } from "./types";

const PROMPT_VERSION = "lg5-v1";

export interface GenerateDraftInput {
  track: "saas" | "retainer";
  touchKind: "first_touch" | "follow_up" | "stale_nudge";
  touchIndex: number;
  viabilityProfile: ViabilityProfile;
  standingBrief: string;
  manualBriefOverride?: string;
  priorTouches: Array<{ subject: string; body: string; sent_at?: string }>;
  engagementHistory: Array<{
    touchIndex: number;
    opened: boolean;
    openCount: number;
    clicked: boolean;
  }>;
  recentBlogPosts: Array<{ title: string; url: string }>; // always [] in v1
  contactInfo: {
    name?: string;
    email: string;
    role?: string;
    company: string;
  };
  nudgeFeedback?: string;
  candidateId: string;
}

export interface GenerateDraftResult {
  draftId: string;
  subject: string;
  bodyMarkdown: string;
  modelUsed: string;
  promptVersion: string;
  generationMs: number;
  driftCheckScore: number | null;
  driftCheckRegenerated: boolean;
  driftCheckFlagged: boolean;
}

export type GenerateDraftOutcome =
  | { ok: true; draft: GenerateDraftResult }
  | { ok: false; reason: "kill_switch" | "generation_failed" };

/**
 * Generate an outreach draft, drift-check it, persist to `outreach_drafts`,
 * and link to the candidate via `pending_draft_id`.
 */
export async function generateDraft(
  input: GenerateDraftInput,
  dbInstance = defaultDb,
): Promise<GenerateDraftOutcome> {
  if (!killSwitches.llm_calls_enabled) {
    return { ok: false, reason: "kill_switch" };
  }

  const [brandProfile, voiceExamples, funnelHistory] = await Promise.all([
    getSuperbadBrandProfile(dbInstance),
    loadVoiceExamples(dbInstance),
    fetchFunnelHistory(input.contactInfo.email, dbInstance),
  ]);
  const systemPrompt = buildSystemPrompt(brandProfile, input, voiceExamples);
  const userPrompt = buildUserPrompt(input, undefined, funnelHistory);

  const startMs = Date.now();
  let rawResponse: string;
  try {
    rawResponse = await invokeLlmText({
      job: "lead-gen-outreach-draft",
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 1024,
    });
  } catch {
    return { ok: false, reason: "generation_failed" };
  }
  const generationMs = Date.now() - startMs;

  let parsed = parseResponse(rawResponse);
  if (!parsed) {
    return { ok: false, reason: "generation_failed" };
  }

  // §8.4: Drift check with one auto-regen attempt
  let driftResult = await checkBrandVoiceDrift(parsed.bodyMarkdown, brandProfile);
  let driftRegenerated = false;
  let driftFlagged = false;

  if (!driftResult.pass) {
    // One auto-regen with drift feedback
    const regenPrompt = buildUserPrompt(input, driftResult.notes, funnelHistory);
    try {
      const regenResponse = await invokeLlmText({
        job: "lead-gen-outreach-draft",
        system: systemPrompt,
        prompt: regenPrompt,
        maxTokens: 1024,
      });
      const regenParsed = parseResponse(regenResponse);
      if (regenParsed) {
        parsed = regenParsed;
        driftRegenerated = true;
        driftResult = await checkBrandVoiceDrift(parsed.bodyMarkdown, brandProfile);
        if (!driftResult.pass) {
          driftFlagged = true;
        }
      } else {
        driftFlagged = true;
      }
    } catch {
      driftFlagged = true;
    }
  }

  // Persist draft
  const draftId = randomUUID();
  const modelUsed = "claude-opus-4-6";

  await dbInstance.insert(outreachDrafts).values({
    id: draftId,
    candidate_id: input.candidateId,
    touch_kind: input.touchKind,
    touch_index: input.touchIndex,
    subject: parsed.subject,
    body_markdown: parsed.bodyMarkdown,
    model_used: modelUsed,
    prompt_version: PROMPT_VERSION,
    generation_ms: generationMs,
    drift_check_score: driftResult.score != null ? Math.round(driftResult.score * 100) : null,
    drift_check_regenerated: driftRegenerated,
    drift_check_flagged: driftFlagged,
    status: "pending_approval",
    nudge_thread_json: input.nudgeFeedback
      ? [{ role: "user", content: input.nudgeFeedback }]
      : null,
    created_at: new Date(),
  });

  // Link draft to candidate
  await dbInstance
    .update(leadCandidates)
    .set({ pending_draft_id: draftId })
    .where(eq(leadCandidates.id, input.candidateId));

  await logActivity({
    kind: "draft_generated",
    body: `Outreach draft generated for ${input.contactInfo.company} (${input.track}, ${input.touchKind})`,
    meta: {
      draft_id: draftId,
      candidate_id: input.candidateId,
      track: input.track,
      touch_kind: input.touchKind,
      touch_index: input.touchIndex,
      drift_regenerated: driftRegenerated,
      drift_flagged: driftFlagged,
      generation_ms: generationMs,
    },
  });

  return {
    ok: true,
    draft: {
      draftId,
      subject: parsed.subject,
      bodyMarkdown: parsed.bodyMarkdown,
      modelUsed,
      promptVersion: PROMPT_VERSION,
      generationMs,
      driftCheckScore: driftResult.score != null ? Math.round(driftResult.score * 100) : null,
      driftCheckRegenerated: driftRegenerated,
      driftCheckFlagged: driftFlagged,
    },
  };
}

// ── Voice examples ──────────────────────────────────────────────────────

type VoiceExample = { title: string; body_markdown: string };

async function loadVoiceExamples(
  dbInstance: typeof defaultDb,
): Promise<VoiceExample[]> {
  const rows = await dbInstance
    .select({
      title: brand_voice_examples.title,
      body_markdown: brand_voice_examples.body_markdown,
    })
    .from(brand_voice_examples)
    .where(eq(brand_voice_examples.surface, "outreach"))
    .orderBy(asc(brand_voice_examples.sort_order));
  return rows;
}

// ── Prompt construction ─────────────────────────────────────────────────

function buildLengthGuidance(input: GenerateDraftInput): string {
  if (input.touchKind === "first_touch") {
    return "FIRST TOUCH (touch #1): 3-4 sentences. Gap observation + free win + soft CTA. Earn the right to exist in their inbox by giving value before asking.";
  }

  const isBreakup = input.touchIndex >= 4;
  if (isBreakup) {
    return "BREAKUP TOUCH (last email): 2 sentences max. Acknowledge you're done. No guilt, no 'I've tried reaching you.' Just: this is the last one, no hard feelings, I'm around if you ever want a second opinion. Sign off with just 'Andy' before the footer.";
  }

  const hasEngagement = input.engagementHistory.some((e) => e.opened || e.clicked);

  if (hasEngagement) {
    const clicked = input.engagementHistory.some((e) => e.clicked);
    if (clicked) {
      return "ENGAGED FOLLOW-UP (clicked prior email): 2-3 short paragraphs. They've shown real interest — add substance, make the next step concrete. You've earned room.";
    }
    const openedButNeverReplied = input.touchIndex >= 5;
    if (openedButNeverReplied) {
      return "BONUS TOUCH (opened multiple times, never replied): 2 sentences. Self-aware, dry. Acknowledge they've been reading. 'Happy to have a 10-minute conversation, or happy to keep being the unsolicited voice in your inbox.' Either/or, no pressure.";
    }
    return "ENGAGED FOLLOW-UP (opened prior email): 3-4 sentences. New angle, new observation from a different signal. They read the last one — build on it with a specific insight. Still concise.";
  }

  if (input.touchIndex === 2) {
    return "COLD FOLLOW-UP #2: 3-4 sentences. Completely different signal from touch 1. New observation, new free insight. This email must stand alone — if they never read touch 1, this should still make sense.";
  }

  if (input.touchIndex === 3) {
    return "PROOF TOUCH #3: 3-4 sentences. One sentence of proof — a similar business, a specific result. Connect it to their situation. No case study links, no attachments. The proof earns its place in one sentence.";
  }

  return "COLD FOLLOW-UP: 2-3 sentences max. Different angle, different signal, same brevity. If the last approach didn't land, try a completely different entry point.";
}

function buildSystemPrompt(
  brandProfile: Awaited<ReturnType<typeof getSuperbadBrandProfile>>,
  input: GenerateDraftInput,
  voiceExamples: VoiceExample[],
): string {
  const unsubLink = `https://superbadmedia.com.au/unsubscribe?email={{EMAIL}}`;

  let voiceExamplesBlock = "";
  if (voiceExamples.length > 0) {
    const exampleBlocks = voiceExamples
      .map((ex) => `### ${ex.title}\n${ex.body_markdown}`)
      .join("\n\n");
    voiceExamplesBlock = `\n\nVOICE EXAMPLES — these are real emails Andy has written or approved. Match this tone, structure, and energy. Do not copy them verbatim — use them as a reference for how SuperBad actually sounds:\n\n${exampleBlocks}`;
  }

  return `You are writing cold outreach emails on behalf of Andy Robinson, founder of SuperBad Marketing (Melbourne, Australia).

BRAND VOICE:
${brandProfile.voiceDescription}
Tone markers: ${brandProfile.toneMarkers.join(", ")}
${brandProfile.avoidWords?.length ? `Words to avoid: ${brandProfile.avoidWords.join(", ")}` : ""}${voiceExamplesBlock}

SENDER IDENTITY:
Name: ${SUPERBAD_SENDER.display_name}
Email: ${SUPERBAD_SENDER.local_part}@${SUPERBAD_SENDER.domain}

PROSPECT TRACK: ${input.track === "saas" ? "SaaS subscription products" : "Creative + performance retainer"}

TRIAL SHOOT OFFER:
SuperBad offers a $297 trial shoot — 60 minutes on-site, plus a bespoke 6-week marketing plan. This is the primary offer for the retainer track. Mention it naturally when relevant — it's the low-risk entry point. Don't be salesy about it, but don't hide it either. It's a real thing, worth mentioning.

EMAIL STRUCTURE — Gap + Free Win + Soft CTA:
1. THE GAP: Identify a specific disconnect in their marketing using the viability profile data. Not a compliment, not a criticism — an observation that shows you actually looked. "Your Google reviews say one thing, your website says another."
2. THE FREE WIN: Give them one actionable piece of advice they can use without SuperBad.
   - If the fix takes under 30 minutes and doesn't require strategy, be SPECIFIC: "Move your top 3 Google review quotes onto your homepage — takes 20 minutes."
   - If it's complex/strategic, be DIRECTIONAL: "Your ad spend and your content quality are telling different stories."
3. THE SOFT CTA: Proportional to zero prior relationship. "Worth a conversation if you're curious." Never "book a call" or "let me know when you're free for 30 minutes."

SUBJECT LINE RULES:
- Lowercase, conversational. Like a text from someone you know.
- Vary style by touch: Touch 1 = observation-lead ("87 reviews, 0 instagram posts"). Touch 2 = name-anchor ("quick thought about [business]"). Touch 3 = conversational-plain ("something worth mentioning"). Touch 4 = most human ("last one from me").
- BANNED: fake "re:", fake "fw:", implied prior conversation, question hooks ("Want to know...?"), exclamation marks, ALL CAPS, emoji.
- If the subject needs a trick to get opened, the observation isn't sharp enough. Fix the observation.

RULES:
- Write as Andy, first person. Dry, observational, never corporate.
- Every email is unique to this prospect. No templates. No placeholder variables.
- Reference specific signals from the viability profile ONLY if they are present. Do NOT invent or hallucinate specifics.
- Each follow-up must use a DIFFERENT observation from a different signal — never repeat or rephrase the same gap.
- Never say "following up", "bumping this", "as I mentioned", or reference prior emails. Each email stands alone.
- Never apologise for emailing. Never use false scarcity. Never open with a question hook.
- Include the Spam Act footer at the end of the body:
  ---
  Andy Robinson · SuperBad Media · Melbourne, Australia
  You're receiving this because your business appeared in public advertising directories.
  Unsubscribe: ${unsubLink}
- No attachments, no images, no HTML formatting beyond basic markdown.

LENGTH — adapts to touch type and engagement:
${buildLengthGuidance(input)}

OUTPUT FORMAT:
Respond with a JSON object only — no prose, no markdown fences:
{"subject": "...", "body_markdown": "..."}`;
}

function buildUserPrompt(
  input: GenerateDraftInput,
  driftFeedback?: string,
  funnelHistory?: FunnelHistory | null,
): string {
  const sections: string[] = [];

  sections.push(`PROSPECT: ${input.contactInfo.company}`);
  if (input.contactInfo.name) {
    sections.push(`CONTACT: ${input.contactInfo.name}${input.contactInfo.role ? ` (${input.contactInfo.role})` : ""}`);
  }
  sections.push(`EMAIL: ${input.contactInfo.email}`);

  sections.push(`\nBRIEF: ${input.manualBriefOverride ?? input.standingBrief}`);

  sections.push(`\nTOUCH: ${input.touchKind} (touch #${input.touchIndex})`);

  sections.push(`\nVIABILITY PROFILE:\n${JSON.stringify(input.viabilityProfile, null, 2)}`);

  const wc = input.viabilityProfile.website_content;
  if (wc?.distilled_brief) {
    sections.push(`\nDEEP ENRICHMENT — BUSINESS BRIEF:\n${wc.distilled_brief}`);
    if (wc.services_offered.length > 0) {
      sections.push(`Services: ${wc.services_offered.join(", ")}`);
    }
    if (wc.unique_selling_points.length > 0) {
      sections.push(`USPs: ${wc.unique_selling_points.join(", ")}`);
    }
  }

  const fb = input.viabilityProfile.facebook;
  const li = input.viabilityProfile.linkedin;
  const tt = input.viabilityProfile.tiktok;
  const deepSignals: string[] = [];
  if (fb?.has_active_page) deepSignals.push(`Facebook: ${fb.follower_count ?? "?"} followers`);
  if (li?.has_active_page) deepSignals.push(`LinkedIn: ${li.employee_count_range ?? "?"} employees, ${li.industry ?? "unknown industry"}`);
  if (tt?.has_active_profile) deepSignals.push(`TikTok: ${tt.follower_count ?? "?"} followers`);
  if (deepSignals.length > 0) {
    sections.push(`\nSOCIAL PRESENCE:\n${deepSignals.join("\n")}`);
  }

  if (funnelHistory) {
    sections.push(`\nFUNNEL HISTORY (this prospect previously started the trial shoot funnel and dropped off):`);
    sections.push(`Business: ${funnelHistory.businessName} (${funnelHistory.shape})`);
    sections.push(`Questionnaire sections completed: ${funnelHistory.sectionsCompleted}`);
    sections.push(`Abandoned: ${funnelHistory.daysSinceAbandonment} days ago`);
    if (funnelHistory.signalTags.length > 0) {
      sections.push(`Signal tags: ${funnelHistory.signalTags.join(", ")}`);
    }
    sections.push(`SMS replies during abandon sequence: ${funnelHistory.hadSmsReplies ? "yes" : "none"}`);
    if (funnelHistory.questionnaireSummary) {
      sections.push(`Questionnaire answers: ${JSON.stringify(funnelHistory.questionnaireSummary)}`);
    }
  }

  if (input.priorTouches.length > 0) {
    sections.push(`\nPRIOR TOUCHES (${input.priorTouches.length}):`);
    for (const touch of input.priorTouches) {
      sections.push(`Subject: ${touch.subject}\n${touch.body}\n---`);
    }
  }

  if (input.engagementHistory.length > 0) {
    sections.push(`\nENGAGEMENT SIGNALS:`);
    for (const e of input.engagementHistory) {
      const signals: string[] = [];
      if (e.opened) signals.push(`opened ${e.openCount}x`);
      if (e.clicked) signals.push("clicked");
      if (signals.length === 0) signals.push("no engagement");
      sections.push(`Touch #${e.touchIndex}: ${signals.join(", ")}`);
    }
  }

  if (input.recentBlogPosts.length > 0) {
    sections.push(`\nRECENT SUPERBAD BLOG POSTS (reference if relevant):`);
    for (const post of input.recentBlogPosts) {
      sections.push(`- ${post.title}: ${post.url}`);
    }
  }

  if (input.nudgeFeedback) {
    sections.push(`\nANDY'S FEEDBACK ON PRIOR DRAFT (incorporate this):\n${input.nudgeFeedback}`);
  }

  if (driftFeedback) {
    sections.push(`\nBRAND VOICE DRIFT DETECTED — PREVIOUS DRAFT FAILED VOICE CHECK:\n${driftFeedback}\nPlease regenerate with closer attention to the brand voice.`);
  }

  sections.push(`\nGenerate the outreach email now.`);

  return sections.join("\n");
}

function parseResponse(
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
