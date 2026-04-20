import type { AmbientSlot } from "@/lib/db/schema/ambient-copy-cache";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift, type BrandDnaProfile } from "@/lib/ai/drift-check";
import { killSwitches } from "@/lib/kill-switches";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";

export interface GenerateInVoiceParams {
  slot: AmbientSlot | string;
  context: Record<string, unknown>;
  brandDnaProfileId?: string;
}

export interface GenerateInVoiceResult {
  text: string;
  driftCheckScore: number | null;
  passedDriftCheck: boolean;
}

const SLOT_INSTRUCTIONS: Record<string, string> = {
  empty_state:
    "Write a single dry, observational line for an empty state in a business platform. The screen has no data yet. Be witty, not helpful.",
  error_page:
    "Write a single dry line for an error page (404/500). Acknowledge the break without apology. Deadpan.",
  loading_copy:
    "Write a brief dry loading message (under 10 words). Something is taking a moment. Be observational, never apologetic.",
  success_toast:
    "Write a single dry confirmation line after a successful action. Acknowledge without celebration. Understated.",
  placeholder_text:
    "Write a short dry placeholder for an input field or empty filter. Observational, never instructional.",
  morning_brief:
    "Write an opening line for a daily operational brief. Dry, observational, sets the tone for the day without forced optimism.",
};

function buildPrompt(slot: string, context: Record<string, unknown>): string {
  const instruction =
    SLOT_INSTRUCTIONS[slot] ??
    `Write a single dry, observational line for the "${slot}" surface slot. SuperBad voice: understated, Melbourne wit, never explains the joke.`;

  const contextStr = Object.keys(context).length > 0
    ? `\nContext: ${JSON.stringify(context)}`
    : "";

  return `${instruction}${contextStr}

Rules:
- One line only, under 80 characters preferred
- Dry, observational, self-deprecating tone
- Never use: synergy, leverage, solutions, stakeholder, ecosystem
- Never explain the joke
- No exclamation marks
- No emojis

Respond with the line only — no quotes, no prefix, no explanation.`;
}

export async function generateInVoice(
  params: GenerateInVoiceParams,
): Promise<GenerateInVoiceResult> {
  if (!killSwitches.llm_calls_enabled) {
    return {
      text: `[voice placeholder: ${params.slot}]`,
      driftCheckScore: null,
      passedDriftCheck: true,
    };
  }

  const prompt = buildPrompt(params.slot, params.context);
  const text = await invokeLlmText({
    job: "sd-generate-in-voice",
    prompt,
    maxTokens: 100,
  });

  let profile: BrandDnaProfile;
  try {
    profile = await getSuperbadBrandProfile();
  } catch {
    return { text, driftCheckScore: null, passedDriftCheck: true };
  }

  const driftResult = await checkBrandVoiceDrift(text, profile);

  if (!driftResult.pass) {
    const retryText = await invokeLlmText({
      job: "sd-generate-in-voice",
      prompt: `${prompt}\n\nPrevious attempt was off-brand. Be drier, more understated, more Melbourne.`,
      maxTokens: 100,
    });

    const retryDrift = await checkBrandVoiceDrift(retryText, profile);
    return {
      text: retryDrift.pass ? retryText : text,
      driftCheckScore: retryDrift.pass ? retryDrift.score : driftResult.score,
      passedDriftCheck: retryDrift.pass,
    };
  }

  return {
    text,
    driftCheckScore: driftResult.score,
    passedDriftCheck: true,
  };
}
