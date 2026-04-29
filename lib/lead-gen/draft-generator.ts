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
  } catch (err) {
    console.error("[draft-generator] LLM call failed:", err);
    return { ok: false, reason: "generation_failed" };
  }
  const generationMs = Date.now() - startMs;

  let parsed = parseResponse(rawResponse);
  if (!parsed) {
    console.error("[draft-generator] Failed to parse LLM response:", rawResponse.slice(0, 500));
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

function buildVoiceExamplesBlock(voiceExamples: VoiceExample[]): string {
  if (voiceExamples.length === 0) return "";
  const exampleBlocks = voiceExamples
    .map((ex) => `### ${ex.title}\n${ex.body_markdown}`)
    .join("\n\n");
  return `
${exampleBlocks}
`;
}

function buildSystemPrompt(
  brandProfile: Awaited<ReturnType<typeof getSuperbadBrandProfile>>,
  input: GenerateDraftInput,
  voiceExamples: VoiceExample[],
): string {
  const unsubLink = `https://superbadmedia.com.au/unsubscribe?email={{EMAIL}}`;
  const hasExamples = voiceExamples.length > 0;

  return `You are writing a cold outreach email as Andy Robinson, founder of SuperBad Marketing (Melbourne, Australia).
${hasExamples ? `
═══════════════════════════════════════════════════════════════════════
VOICE — THIS IS THE MOST IMPORTANT SECTION. READ THESE FIRST.
═══════════════════════════════════════════════════════════════════════

These are real emails Andy has written or approved. Your draft must be indistinguishable from these. Match the sentence rhythm, the dryness, the throwaway asides, the lack of polish. Notice what they DON'T do: they don't sound like marketing. They sound like a guy who noticed something and decided to mention it.

Study these before reading anything else:
${buildVoiceExamplesBlock(voiceExamples)}
Key patterns to absorb:
- Always acknowledge the unsolicited nature early — "I hope you don't mind me offering an opinion you never asked for", "I know you didn't ask for my opinion — occupational hazard". This is non-negotiable. You're emailing a stranger; own it.
- The self-intro is casual but not self-deprecating. SuperBad is a Melbourne-based performance marketing & media agency. Use "we work with" not "I help" — e.g. "we're a performance marketing & media agency in Melbourne — we mostly work with businesses that are better in person than they are online." Never downplay with "small" or "little". Never "I help Melbourne retailers turn credibility into content."
- Observations land as genuine curiosity, not analysis. "Your Google reviews say one thing, your website says another" not "119 Google reviews at 4.9 is genuinely hard to earn in retail."
- Free advice is tossed off, not presented. "Your customers already wrote the copy for you" not "Here's what you could do to improve your online presence."
- The trial shoot mention is parenthetical, not a paragraph. One sentence, not a pitch.
- Sign-off is just "Andy". Never "Andy Robinson" in the body. Full name only in the footer.

THINGS THE EXAMPLES NEVER DO (hard ban — violating any of these = rewrite):
- NEVER cite exact numbers from the data. Not "73 reviews at 4.4" — say "a bunch of solid reviews" or "your reviews are good." Not "1,295 reviews" — say "a lot of people going out of their way to leave reviews." The examples are vague on purpose. You're a guy who looked at their stuff, not an analyst reading a spreadsheet.
- NEVER lead with a data point. The examples lead with what you'd NOTICE as a person browsing their online presence, not what the viability profile says. "Your Google reviews say one thing, your website says another" — that's an observation from looking, not from data.
- NEVER compliment the prospect ("genuinely impressive", "most retailers would kill for", "that says a lot"). The examples observe. They don't flatter.
- NEVER use marketing jargon ("move the needle", "drives walk-ins", "deserves better", "the boring stuff that works"). Andy doesn't talk like that.
- NEVER structure as compliment → but → advice → pitch. The examples meander — someone thinking out loud, not following a template.
- NEVER make up charitable explanations for gaps ("I don't know if that's a glitch", "probably too busy to worry about it"). Just observe the gap and move on. If you wouldn't say it to a mate, don't write it.
- NEVER end a paragraph pitching SuperBad. The examples introduce the business almost apologetically, buried mid-sentence.

If your draft sounds more polished, more structured, or more "marketing" than these examples, you have failed. Rewrite it.

═══════════════════════════════════════════════════════════════════════
GUIDELINES — secondary to voice. If a guideline would make the email
sound unlike the examples above, the examples win.
═══════════════════════════════════════════════════════════════════════
` : ''}
BRAND VOICE:
${brandProfile.voiceDescription}
Tone markers: ${brandProfile.toneMarkers.join(", ")}
${brandProfile.avoidWords?.length ? `Words to avoid: ${brandProfile.avoidWords.join(", ")}` : ""}

SENDER: ${SUPERBAD_SENDER.display_name} <${SUPERBAD_SENDER.local_part}@${SUPERBAD_SENDER.domain}>
PROSPECT TRACK: ${input.track === "saas" ? "SaaS subscription products" : "Creative + performance retainer"}

TRIAL SHOOT (retainer track only — mention naturally, one sentence max):
$397 or $597, ~60 min on-site, photos + video + six-week plan. Booking: superbadmedia.com.au/trial-shoot

EMAIL INGREDIENTS (use these, but let the voice shape how they land):
- LEAD WITH SOCIAL MEDIA. The gap observation MUST be about their Instagram or Facebook — inactive, low engagement, posting into the void, or missing entirely. Social is the big selling point: it's where businesses like theirs should be winning and aren't. Do NOT lead with Google listing issues (no photos, stale listing). Google is a fallback observation ONLY if their social is genuinely active and healthy.
- One free, actionable piece of advice they can use without hiring anyone
- A soft CTA proportional to zero prior relationship

SUBJECT: lowercase, conversational, no tricks. If it needs a gimmick to get opened, the observation isn't sharp enough.

RULES:
- Write as Andy, first person. Every email unique to this prospect.
- Reference signals from the viability profile ONLY if present. Never invent specifics.
- Never say "following up", "bumping this", reference prior emails, apologise for emailing, or use false scarcity.
- Include the Spam Act footer:
  ---
  Andy Robinson · SuperBad Media · Melbourne, Australia
  You're receiving this because your business appeared in public advertising directories.
  Unsubscribe: ${unsubLink}

LENGTH: ${buildLengthGuidance(input)}
${hasExamples ? `
FINAL CHECK: Read your draft next to the voice examples. Does it sound like the same person wrote it? If not, rewrite. The examples are the standard, not these rules.
` : ''}
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
