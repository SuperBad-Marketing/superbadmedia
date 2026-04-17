/**
 * "What we already know about you" paragraph — Opus-tier.
 *
 * Generates the warm, observant summary for the retainer welcome screen.
 * Reads deal notes, quote context, outreach research. Not a data dump —
 * a human paragraph that makes the client feel known before the
 * Brand DNA assessment starts.
 *
 * Owner: OS-1.
 */
import { z } from "zod";
import { invokeLlmText } from "@/lib/ai/invoke";
import { killSwitches } from "@/lib/kill-switches";
import type { BrandDnaProfile } from "@/lib/ai/drift-check";

export interface GenerateWelcomeSummaryInput {
  customerName: string;
  companyName: string;
  /** Deal notes, quote context, outreach research, conversation history */
  dealContext: string;
  /** SuperBad's own Brand DNA profile for voice */
  superbadBrandDna: BrandDnaProfile;
}

const SummarySchema = z.object({
  summary: z.string().min(1).max(1500),
});

export async function generateWelcomeSummary(
  input: GenerateWelcomeSummaryInput,
): Promise<string | null> {
  if (!killSwitches.llm_calls_enabled) {
    return null;
  }

  const voiceBlock = [
    `SuperBad voice: ${input.superbadBrandDna.voiceDescription}`,
    `Tone markers: ${input.superbadBrandDna.toneMarkers.join(", ")}`,
    input.superbadBrandDna.avoidWords?.length
      ? `Avoid: ${input.superbadBrandDna.avoidWords.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are writing a short "what we already know about you" paragraph for a new retainer client's welcome screen at SuperBad Marketing.

${voiceBlock}

CLIENT:
- Name: ${input.customerName}
- Company: ${input.companyName}

CONTEXT FROM SALES PROCESS:
${input.dealContext}

INSTRUCTIONS:
- Write 3-5 sentences. Warm, observant, specific to THIS client.
- Reference something concrete from the context — an observation, a detail, a pattern you noticed.
- Not a data dump. Not a summary of their business plan. A warm greeting that shows you were paying attention.
- Admin-roommate register: perceptive, wry, never pitchy.
- Source hierarchy: client-supplied docs > direct answers > owned web > scrapes > LLM inference. Higher source wins on conflict.

Return valid JSON: { "summary": "..." }`;

  const raw = await invokeLlmText({
    job: "onboarding-welcome-summary",
    prompt,
    maxTokens: 800,
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = SummarySchema.parse(JSON.parse(jsonMatch[0]));
    return parsed.summary;
  } catch {
    return null;
  }
}
