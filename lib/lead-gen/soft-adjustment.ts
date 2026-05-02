/**
 * Haiku-tier soft adjustment — reads the viability profile + both track
 * scores + standing brief and returns a ±10 nudge with rationale.
 *
 * Spec Q4/Q5: bounded to [-10, +10], never pushes a 0-score candidate
 * into qualification. Runs post-enrichment, after rule-based scoring,
 * before track assignment is finalised and candidate is created.
 *
 * Owner: Lead Generation spec §6.
 */

import { invokeLlmText } from "@/lib/ai/invoke";
import { killSwitches } from "@/lib/kill-switches";
import type { ViabilityProfile } from "./types";

const SOFT_ADJUSTMENT_MIN = -10;
const SOFT_ADJUSTMENT_MAX = 10;

export interface SoftAdjustmentResult {
  adjustment: number;
  rationale: string;
}

export async function computeSoftAdjustment(args: {
  profile: ViabilityProfile;
  companyName: string;
  saasScore: number;
  retainerScore: number;
  standingBrief: string;
}): Promise<SoftAdjustmentResult> {
  if (!killSwitches.llm_calls_enabled) {
    return { adjustment: 0, rationale: "llm_calls_disabled" };
  }

  if (!args.standingBrief.trim()) {
    return { adjustment: 0, rationale: "no_standing_brief" };
  }

  try {
    const raw = await invokeLlmText({
      job: "lead-gen-soft-adjustment",
      prompt: buildPrompt(args),
      maxTokens: 256,
      actorType: "prospect",
    });

    return parseResponse(raw);
  } catch {
    return { adjustment: 0, rationale: "llm_call_failed" };
  }
}

function buildPrompt(args: {
  profile: ViabilityProfile;
  companyName: string;
  saasScore: number;
  retainerScore: number;
  standingBrief: string;
}): string {
  return `You are a lead-qualification analyst for a performance marketing agency. Given a prospect's viability profile and current rule-based scores, decide whether the scores fairly reflect this prospect's fit — or whether qualitative signals in the profile warrant a small adjustment.

PROSPECT: ${args.companyName}

CURRENT SCORES:
- SaaS track: ${args.saasScore}/100
- Retainer track: ${args.retainerScore}/100

STANDING BRIEF (what we're looking for):
${args.standingBrief}

VIABILITY PROFILE:
${JSON.stringify(args.profile, null, 2)}

RULES:
- Return an integer adjustment from -10 to +10. This nudges BOTH track scores equally.
- Positive adjustment: the profile shows qualitative fit that the rules undercount (e.g. niche alignment with our brief, strong brand signals, clear marketing budget despite low ad spend, complementary services).
- Negative adjustment: the profile shows qualitative red flags the rules miss (e.g. agency/competitor, MLM signals, highly regulated industry we can't serve, strong in-house team that won't need us).
- 0 is a valid and common answer — only adjust when the qualitative read clearly diverges from the quantitative score.
- Never adjust to compensate for missing data — if signals are absent, the rules already score conservatively.

Respond with a JSON object only — no prose, no markdown fences:
{"adjustment": <integer -10 to 10>, "rationale": "<one sentence>"}`;
}

function parseResponse(raw: string): SoftAdjustmentResult {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      adjustment?: unknown;
      rationale?: unknown;
    };

    if (
      typeof parsed.adjustment !== "number" ||
      typeof parsed.rationale !== "string"
    ) {
      return { adjustment: 0, rationale: "parse_error: missing fields" };
    }

    const clamped = Math.max(
      SOFT_ADJUSTMENT_MIN,
      Math.min(SOFT_ADJUSTMENT_MAX, Math.round(parsed.adjustment)),
    );

    return { adjustment: clamped, rationale: parsed.rationale.trim() };
  } catch {
    return { adjustment: 0, rationale: "parse_error" };
  }
}
