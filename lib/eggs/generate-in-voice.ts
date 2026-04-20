import type { AmbientSlot } from "@/lib/db/schema/ambient-copy-cache";

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

/**
 * Single shared primitive for all voice-generated copy.
 * Routes through the brand-voice drift check (§11.5).
 *
 * SD-2 will implement the full LLM call + drift check pipeline.
 * This stub returns placeholder text for type safety and testing.
 */
export async function generateInVoice(
  params: GenerateInVoiceParams,
): Promise<GenerateInVoiceResult> {
  return {
    text: `[voice placeholder: ${params.slot}]`,
    driftCheckScore: null,
    passedDriftCheck: true,
  };
}
