/**
 * Cold outreach draft generator — wraps the Anthropic messages API to
 * produce a subject + body for a candidate given their ViabilityProfile.
 *
 * Uses the Anthropic REST API directly via fetch() (ESLint discipline:
 * lib/lead-gen is not in the lib/ai/ carve-out, so @anthropic-ai/sdk
 * cannot be imported here — FOUNDATIONS §11.6). Model selection routes
 * through the central model registry (`lib/ai/models.ts`).
 *
 * Gated behind `lead_gen_enabled` + `llm_calls_enabled` kill-switches.
 * Logs every LLM call to `external_call_log`.
 *
 * PATCHES_OWED: model registry slug "lead-gen-outreach-draft" is currently
 * mapped to "opus" — spec §8 calls for Haiku-tier for cost discipline on
 * bulk first_touch drafts. Update lib/ai/models.ts when the registry is
 * next in-scope (outside LG-9 whitelist).
 *
 * Owner: LG-9. Consumer: orchestrator step 10.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { db as defaultDb } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import { ANTHROPIC_API_BASE, ANTHROPIC_VERSION_HEADER } from "@/lib/integrations/vendors/anthropic";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

export interface OutreachSend {
  id: string;
  sent_at: number;
  touch_kind: "first_touch" | "follow_up" | "stale_nudge";
  subject: string;
}

export interface BlogPost {
  title: string;
  url: string;
}

export interface GenerateDraftArgs {
  track: "saas" | "retainer";
  touchKind: "first_touch" | "follow_up" | "stale_nudge";
  touchIndex: number;
  viabilityProfile: ViabilityProfile;
  standingBrief: string;
  manualBriefOverride?: string;
  priorTouches: OutreachSend[];
  recentBlogPosts: BlogPost[];
  contactInfo: {
    name?: string;
    email: string;
    role?: string;
    company: string;
  };
  nudgeFeedback?: string;
}

export interface GeneratedDraft {
  subject: string;
  bodyMarkdown: string;
  modelUsed: string;
  promptVersion: string;
  generationMs: number;
}

interface AnthropicTextBlock {
  type: "text";
  text: string;
}

interface AnthropicMessagesResponse {
  content?: AnthropicTextBlock[];
  error?: { message: string };
}

const PROMPT_VERSION = "v1";
const SYSTEM_PROMPT_PATH = join(process.cwd(), "lib/lead-gen/prompts/outreach-system.md");

let cachedSystemPrompt: string | undefined;

async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  cachedSystemPrompt = await readFile(SYSTEM_PROMPT_PATH, "utf-8");
  return cachedSystemPrompt;
}

function buildUserMessage(args: GenerateDraftArgs): string {
  const { track, touchKind, touchIndex, viabilityProfile, standingBrief, contactInfo, priorTouches, nudgeFeedback } = args;

  const lines: string[] = [
    `Track: ${track}`,
    `Touch kind: ${touchKind} (index ${touchIndex})`,
    "",
    `Company: ${contactInfo.company}`,
    contactInfo.name ? `Contact name: ${contactInfo.name}` : "Contact name: unknown",
    contactInfo.role ? `Contact role: ${contactInfo.role}` : "",
    `Email: ${contactInfo.email}`,
    "",
    "Business profile (ViabilityProfile):",
    JSON.stringify(viabilityProfile, null, 2),
  ];

  if (standingBrief) {
    lines.push("", "SuperBad standing brief:", standingBrief);
  }

  if (priorTouches.length > 0) {
    lines.push("", `Prior touches (${priorTouches.length}):`);
    for (const t of priorTouches) {
      lines.push(`  - ${t.touch_kind} sent ${new Date(t.sent_at).toISOString().slice(0, 10)}: "${t.subject}"`);
    }
  }

  if (nudgeFeedback) {
    lines.push("", "Nudge feedback from Andy:", nudgeFeedback);
  }

  return lines.filter((l) => l !== undefined).join("\n");
}

/**
 * Generate a cold outreach draft for a qualified candidate.
 * Returns subject + body markdown with Spam Act footer placeholder.
 */
export async function generateDraft(
  args: GenerateDraftArgs,
  dbInstance = defaultDb,
): Promise<GeneratedDraft> {
  if (!killSwitches.lead_gen_enabled || !killSwitches.llm_calls_enabled) {
    return {
      subject: "[draft skipped — kill switch]",
      bodyMarkdown: "Draft generation is currently disabled.",
      modelUsed: "none",
      promptVersion: PROMPT_VERSION,
      generationMs: 0,
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      subject: "[draft skipped — no API key]",
      bodyMarkdown: "ANTHROPIC_API_KEY is not configured.",
      modelUsed: "none",
      promptVersion: PROMPT_VERSION,
      generationMs: 0,
    };
  }

  const systemPrompt = await loadSystemPrompt();
  const userMessage = buildUserMessage(args);
  const modelId = modelFor("lead-gen-outreach-draft");

  const startMs = Date.now();
  let subject = "";
  let body = "";
  let fetchError: string | undefined;

  try {
    const res = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION_HEADER,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = (await res.json()) as AnthropicMessagesResponse;

    if (!res.ok || data.error) {
      fetchError = data.error?.message ?? `Anthropic API error: ${res.status}`;
    } else {
      const text = data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";
      const json = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "");
      const parsed = JSON.parse(json) as { subject?: string; body?: string };
      subject = typeof parsed.subject === "string" ? parsed.subject : "";
      body = typeof parsed.body === "string" ? parsed.body : "";
    }
  } catch (err) {
    fetchError = `Draft generation error: ${String(err)}`;
  }

  const generationMs = Date.now() - startMs;

  await dbInstance.insert(external_call_log).values({
    id: crypto.randomUUID(),
    job: "anthropic:lead-gen-outreach-draft",
    actor_type: "internal",
    units: JSON.stringify({
      track: args.track,
      touch_kind: args.touchKind,
      touch_index: args.touchIndex,
      model: modelId,
      duration_ms: generationMs,
      error: fetchError,
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchError) {
    return {
      subject: "[draft generation failed]",
      bodyMarkdown: `Error: ${fetchError}`,
      modelUsed: modelId,
      promptVersion: PROMPT_VERSION,
      generationMs,
    };
  }

  return {
    subject,
    bodyMarkdown: body,
    modelUsed: modelId,
    promptVersion: PROMPT_VERSION,
    generationMs,
  };
}
