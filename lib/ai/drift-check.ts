/**
 * Brand-voice drift grader — Haiku-tier LLM check.
 *
 * Called before sending AI-drafted outreach or sequence emails to confirm
 * the draft matches the client's BrandDnaProfile. Returns a numeric score
 * and pass/fail so the caller can decide whether to send or regenerate.
 *
 * Gated by two kill switches:
 *   - `llm_calls_enabled` (global LLM gate)
 *   - `drift_check_enabled` (drift-grader-specific gate)
 *
 * Both must be `true` for a real LLM call to fire. When either is off,
 * returns `{ pass: true, score: 1.0, notes: "skipped (kill switch)" }`.
 *
 * Settings read:
 *   - `email.drift_check_threshold` — minimum score for `pass = true` (default 0.7)
 *
 * ESLint carve-out: `lib/ai/` is excluded from `no-direct-anthropic-import`
 * so this file may import `@anthropic-ai/sdk` directly.
 */
import Anthropic from "@anthropic-ai/sdk";
import { killSwitches } from "@/lib/kill-switches";
import settingsRegistry from "@/lib/settings";
import { modelFor } from "@/lib/ai/models";

export interface BrandDnaProfile {
  /** Written description of the brand voice (e.g. "dry, direct, Melbourne wit"). */
  voiceDescription: string;
  /** Tone markers — single words or short phrases. */
  toneMarkers: string[];
  /** Words or phrases the brand explicitly avoids. */
  avoidWords?: string[];
  /** Target audience descriptor for context. */
  targetAudience?: string;
}

export interface DriftCheckResult {
  /** True when the draft scores at or above the configured threshold. */
  pass: boolean;
  /** 0.0 (severe drift) to 1.0 (perfect match) */
  score: number;
  /** Optional grader notes explaining the score. */
  notes?: string;
}

const CLIENT_SINGLETON = new Anthropic();

/**
 * Assess whether `draftText` matches `brandDnaProfile` using the
 * `drift-check-grader` Haiku model.
 *
 * @param draftText - The drafted email body to evaluate
 * @param brandDnaProfile - Brand DNA profile to compare against
 * @returns DriftCheckResult with pass/fail, numeric score, and optional notes
 */
export async function checkBrandVoiceDrift(
  draftText: string,
  brandDnaProfile: BrandDnaProfile,
): Promise<DriftCheckResult> {
  // Belt-and-braces kill switch check
  if (!killSwitches.llm_calls_enabled || !killSwitches.drift_check_enabled) {
    return {
      pass: true,
      score: 1.0,
      notes: "drift-check skipped (kill switch — llm_calls_enabled or drift_check_enabled is false)",
    };
  }

  const threshold = await settingsRegistry.get("email.drift_check_threshold");
  const modelId = modelFor("drift-check-grader");

  const profileSummary = [
    `Voice: ${brandDnaProfile.voiceDescription}`,
    `Tone markers: ${brandDnaProfile.toneMarkers.join(", ")}`,
    brandDnaProfile.avoidWords?.length
      ? `Avoid: ${brandDnaProfile.avoidWords.join(", ")}`
      : null,
    brandDnaProfile.targetAudience
      ? `Audience: ${brandDnaProfile.targetAudience}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are a brand-voice consistency checker. Score how well the draft email matches the brand profile.

BRAND PROFILE:
${profileSummary}

DRAFT EMAIL:
${draftText}

Respond with a JSON object only — no prose, no markdown:
{
  "score": <number 0.0-1.0>,
  "notes": "<one sentence explanation>"
}

score 1.0 = perfect match, 0.0 = completely off-brand.`;

  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: 128,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content.find((b) => b.type === "text")?.text?.trim() ?? "";

  let score = 0.0;
  let notes: string | undefined;

  try {
    // Strip possible markdown code fences
    const json = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(json) as { score?: unknown; notes?: unknown };
    score = typeof parsed.score === "number" ? Math.max(0, Math.min(1, parsed.score)) : 0.0;
    notes = typeof parsed.notes === "string" ? parsed.notes : undefined;
  } catch {
    notes = `parse error — raw response: ${text.slice(0, 200)}`;
  }

  return { pass: score >= threshold, score, notes };
}
