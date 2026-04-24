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

  const brandProfile = await getSuperbadBrandProfile(dbInstance);
  const voiceExamples = await loadVoiceExamples(dbInstance);
  const systemPrompt = buildSystemPrompt(brandProfile, input, voiceExamples);
  const userPrompt = buildUserPrompt(input);

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
    const regenPrompt = buildUserPrompt(input, driftResult.notes);
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
    return "FIRST TOUCH: 2-3 sentences only. One observation about their business, one value prop, one soft CTA. Respect their time — earn the right to exist in their inbox.";
  }

  const hasEngagement = input.engagementHistory.some((e) => e.opened || e.clicked);

  if (hasEngagement) {
    const clicked = input.engagementHistory.some((e) => e.clicked);
    if (clicked) {
      return "ENGAGED FOLLOW-UP (clicked prior email): 2-3 short paragraphs. They've shown real interest — reference what they engaged with, add substance, make the next step concrete.";
    }
    return "ENGAGED FOLLOW-UP (opened prior email): 1-2 short paragraphs. They read your last one — build on it with a new angle or specific insight. Still concise but you've earned a bit more room.";
  }

  return "COLD FOLLOW-UP (no opens detected): 2-3 sentences max. Different angle, different hook, same brevity. If the last approach didn't land, try a completely different entry point.";
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

RULES:
- Write as Andy, first person. Dry, observational, never corporate.
- Every email is unique to this prospect. No templates. No placeholder variables.
- Reference specific signals from the viability profile ONLY if they are present. Do NOT invent or hallucinate specifics.
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
