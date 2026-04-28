import { invokeLlmText } from "@/lib/ai/invoke";
import type { MoodSignal } from "@/lib/db/schema/instagram-competitive";

export async function extractMoodSignal(
  rawText: string,
): Promise<MoodSignal | null> {
  if (rawText.length < 20) return null;

  const prompt = `Analyse the following braindump text for emotional/energy signals. This is Andy, a solo founder of a marketing agency.

TEXT:
${rawText.slice(0, 1500)}

Output valid JSON:
{
  "energy": "high" | "medium" | "low",
  "mood": "one word — e.g. focused, stressed, excited, flat, contemplative, frustrated, energised",
  "confidence": 0.0-1.0
}

Rules:
- "energy" reflects capacity to do complex work right now
- "mood" is the dominant emotional tone — pick the most accurate single word
- "confidence" is how confident you are in this reading (low if text is purely factual/logistical with no emotional signal)
- If the text has no emotional signal at all, return confidence below 0.3
- Be honest, not optimistic — "I'm tired" is low energy, not medium`;

  try {
    const raw = await invokeLlmText({
      job: "braindump-mood-signal",
      prompt,
      maxTokens: 256,
    });

    const cleaned = raw.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned) as {
      energy: string;
      mood: string;
      confidence: number;
    };

    const energy = (["high", "medium", "low"] as const).includes(
      parsed.energy as "high" | "medium" | "low",
    )
      ? (parsed.energy as "high" | "medium" | "low")
      : "medium";

    return {
      energy,
      mood: parsed.mood ?? "neutral",
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      extracted_at_ms: Date.now(),
    };
  } catch {
    return null;
  }
}
