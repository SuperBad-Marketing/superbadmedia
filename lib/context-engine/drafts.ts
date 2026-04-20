import { assembleContext } from "./assemble";
import { saveDraft, getDraft, clearDraft } from "./summary";
import { logLlmUsage } from "./usage-log";
import { formatDraftPrompt, formatNudgePrompt, formatReformatPrompt } from "./prompts";
import { invokeLlmTextWithMeta } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift, type BrandDnaProfile } from "@/lib/ai/drift-check";
import { logActivity } from "@/lib/activity-log";
import { killSwitches } from "@/lib/kill-switches";

export interface DraftResult {
  content: string;
  channel: string;
  nudgeHistory: string[];
  driftCheck: { pass: boolean; score: number; notes?: string } | null;
}

function buildBrandDnaProfile(
  brandDna: { signalTags: string | null; prosePortrait: string | null } | null,
): BrandDnaProfile | null {
  if (!brandDna?.prosePortrait && !brandDna?.signalTags) return null;

  let toneMarkers: string[] = [];
  if (brandDna.signalTags) {
    try {
      const parsed = JSON.parse(brandDna.signalTags);
      if (Array.isArray(parsed)) {
        toneMarkers = parsed.map(String).slice(0, 10);
      } else if (typeof parsed === "object" && parsed !== null) {
        toneMarkers = Object.keys(parsed).slice(0, 10);
      }
    } catch {
      toneMarkers = brandDna.signalTags.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
    }
  }

  return {
    voiceDescription: brandDna.prosePortrait?.slice(0, 500) ?? "professional, warm, direct",
    toneMarkers,
  };
}

export async function generateDraft(contactId: string): Promise<DraftResult> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls are disabled (kill switch).");
  }

  const ctx = await assembleContext(contactId, "draft");
  const { system, prompt } = formatDraftPrompt(ctx);

  const result = await invokeLlmTextWithMeta({
    job: "client-context-draft-reply",
    system,
    prompt,
    maxTokens: 1024,
  });

  await logLlmUsage({
    callType: "draft_generation",
    contactId,
    model: "opus",
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  const brandProfile = buildBrandDnaProfile(ctx.brandDna);
  const driftCheck = brandProfile
    ? await checkBrandVoiceDrift(result.text, brandProfile)
    : null;

  const channel = ctx.contact.preferredChannel;
  await saveDraft(contactId, result.text, channel, []);

  await logActivity({
    contactId,
    companyId: ctx.contact.companyId,
    kind: "draft_generated",
    body: `Draft generated for ${channel}`,
    meta: {
      channel,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      driftScore: driftCheck?.score ?? null,
    },
  });

  return {
    content: result.text,
    channel,
    nudgeHistory: [],
    driftCheck,
  };
}

export async function regenerateDraft(
  contactId: string,
  nudge: string,
  previousDraft: string,
  nudgeHistory: string[],
): Promise<DraftResult> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls are disabled (kill switch).");
  }

  const ctx = await assembleContext(contactId, "draft");
  const { system, prompt } = formatNudgePrompt(ctx, previousDraft, nudge, nudgeHistory);

  const result = await invokeLlmTextWithMeta({
    job: "client-context-regenerate-draft-with-nudge",
    system,
    prompt,
    maxTokens: 1024,
  });

  await logLlmUsage({
    callType: "draft_nudge",
    contactId,
    model: "opus",
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  const brandProfile = buildBrandDnaProfile(ctx.brandDna);
  const driftCheck = brandProfile
    ? await checkBrandVoiceDrift(result.text, brandProfile)
    : null;

  const channel = ctx.contact.preferredChannel;
  const updatedHistory = [...nudgeHistory, nudge];
  await saveDraft(contactId, result.text, channel, updatedHistory);

  await logActivity({
    contactId,
    companyId: ctx.contact.companyId,
    kind: "draft_nudged",
    body: `Draft nudged: "${nudge.slice(0, 80)}"`,
    meta: {
      channel,
      nudge,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      driftScore: driftCheck?.score ?? null,
    },
  });

  return {
    content: result.text,
    channel,
    nudgeHistory: updatedHistory,
    driftCheck,
  };
}

export async function reformatDraft(
  contactId: string,
  draftText: string,
  targetChannel: string,
): Promise<DraftResult> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls are disabled (kill switch).");
  }

  const { system, prompt } = formatReformatPrompt(draftText, targetChannel);

  const result = await invokeLlmTextWithMeta({
    job: "client-context-reformat-draft-for-channel",
    system,
    prompt,
    maxTokens: 512,
  });

  await logLlmUsage({
    callType: "draft_reformat",
    contactId,
    model: "haiku",
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  const existingDraft = await getDraft(contactId);
  const nudgeHistory = existingDraft?.nudgeHistory ?? [];
  await saveDraft(contactId, result.text, targetChannel, nudgeHistory);

  await logActivity({
    contactId,
    kind: "draft_channel_switched",
    body: `Draft reformatted for ${targetChannel}`,
    meta: {
      fromChannel: existingDraft?.channel ?? "email",
      toChannel: targetChannel,
    },
  });

  return {
    content: result.text,
    channel: targetChannel,
    nudgeHistory,
    driftCheck: null,
  };
}

export { getDraft, clearDraft };
