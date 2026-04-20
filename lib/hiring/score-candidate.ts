import { invokeLlmText } from "@/lib/ai/invoke";
import type { PortfolioSignal } from "./portfolio";
import type { RoleBriefRow } from "@/lib/db/schema/role-briefs";

export interface ScoringResult {
  role_brief_id: string;
  role_name: string;
  score: number;
  reasoning: string;
  name_guess: string | null;
}

export async function scoreCandidateAgainstBriefs(
  signal: PortfolioSignal,
  briefs: RoleBriefRow[],
): Promise<ScoringResult[]> {
  if (briefs.length === 0) return [];

  const results = await Promise.all(
    briefs.map((brief) => scoreSingle(signal, brief)),
  );

  return results.sort((a, b) => b.score - a.score);
}

function safeJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  return [];
}

async function scoreSingle(
  signal: PortfolioSignal,
  brief: RoleBriefRow,
): Promise<ScoringResult> {
  const tags = safeJsonArray(brief.extracted_tags_json);
  const doList = safeJsonArray(brief.style_do_list_json);
  const avoidList = safeJsonArray(brief.style_avoid_list_json);

  const prompt = `Score this portfolio against the role brief. Return JSON only, no markdown fences:
{"score": <0.0-1.0>, "reasoning": "<one sentence>", "name_guess": "<person's name from portfolio, or null>"}

ROLE BRIEF: "${brief.role_name}"
Style summary: ${brief.style_summary || "none yet"}
Tags: ${tags.join(", ") || "none"}
Style do: ${doList.join(", ") || "none"}
Style avoid: ${avoidList.join(", ") || "none"}
Engagement: ${brief.engagement_type}
Rate band: ${brief.rate_min_aud ?? "?"}-${brief.rate_max_aud ?? "?"} AUD

CANDIDATE PORTFOLIO:
Platform: ${signal.platform}
URL: ${signal.url}
Bio: ${signal.bio || "not available"}
Tags: ${signal.extracted_tags.join(", ") || "none"}
Samples: ${signal.work_samples.map((s) => `${s.title || s.url} (${s.mediaType})`).join("; ") || "none"}

Score 0.0 = no fit, 1.0 = perfect fit. Weight style alignment, platform relevance, and portfolio quality. If portfolio data is sparse, score conservatively and note it.`;

  const raw = await invokeLlmText({
    job: "hiring-candidate-score",
    prompt,
    maxTokens: 200,
  });

  try {
    const cleaned = raw.replace(/^```json?\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned);
    return {
      role_brief_id: brief.id,
      role_name: brief.role_name,
      score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
      reasoning: String(parsed.reasoning || ""),
      name_guess:
        parsed.name_guess && parsed.name_guess !== "null"
          ? String(parsed.name_guess)
          : null,
    };
  } catch {
    return {
      role_brief_id: brief.id,
      role_name: brief.role_name,
      score: 0,
      reasoning: "Scoring response could not be parsed.",
      name_guess: null,
    };
  }
}
