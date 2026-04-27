import { invokeLlmText } from "@/lib/ai/invoke";
import type { DiscoveredCandidate } from "./types";

export interface IcpPrefilterResult {
  pass: boolean;
  rationale: string;
}

/**
 * Lightweight Haiku call that evaluates whether a discovered candidate
 * is worth the cost of full enrichment. Runs BEFORE the enrichment
 * pipeline to cut spend on obvious non-fits.
 *
 * Uses only the basic signals available post-discovery: company name,
 * domain, source, category, ad presence, and Maps rating/reviews.
 */
export async function prefilterCandidate(
  candidate: DiscoveredCandidate,
  brief: string,
  trackPriority: string,
): Promise<IcpPrefilterResult> {
  const signals = buildSignalSummary(candidate);

  const prompt = `You are an ICP (Ideal Customer Profile) pre-qualifier for a marketing agency.

STANDING BRIEF:
${brief}

TRACK PRIORITY: ${trackPriority}

CANDIDATE:
- Company: ${candidate.company_name}
- Domain: ${candidate.domain ?? "unknown"}
- Source: ${candidate.source}
${signals}

Based on the brief and available signals, should this candidate proceed to full enrichment and scoring?

Respond with EXACTLY one line in this format:
PASS: [one sentence reason]
or
FAIL: [one sentence reason]

Be generous — only FAIL candidates that are clearly outside the target profile (wrong industry, too small/large for the track, no web presence when one is expected, obviously irrelevant business type). When in doubt, PASS.`;

  try {
    const response = await invokeLlmText({
      job: "lead-gen-icp-prefilter",
      prompt,
      maxTokens: 100,
      actorType: "internal",
    });

    const trimmed = response.trim();
    if (trimmed.startsWith("PASS")) {
      return { pass: true, rationale: trimmed.slice(5).trim() };
    }
    if (trimmed.startsWith("FAIL")) {
      return { pass: false, rationale: trimmed.slice(5).trim() };
    }

    return { pass: true, rationale: "Unparseable response — defaulting to pass" };
  } catch {
    return { pass: true, rationale: "Prefilter error — defaulting to pass" };
  }
}

/**
 * Batch prefilter for efficiency — runs up to 5 candidates in parallel.
 */
export async function prefilterCandidates(
  candidates: DiscoveredCandidate[],
  brief: string,
  trackPriority: string,
): Promise<Map<DiscoveredCandidate, IcpPrefilterResult>> {
  const results = new Map<DiscoveredCandidate, IcpPrefilterResult>();
  const batchSize = 5;

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((c) => prefilterCandidate(c, brief, trackPriority)),
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status === "fulfilled") {
        results.set(batch[j], result.value);
      } else {
        results.set(batch[j], { pass: true, rationale: "Prefilter error — defaulting to pass" });
      }
    }
  }

  return results;
}

function buildSignalSummary(candidate: DiscoveredCandidate): string {
  const lines: string[] = [];
  const p = candidate.partial_profile;

  if (p.meta_ads) {
    lines.push(`- Meta Ads: ${p.meta_ads.active_ad_count} active ads, spend bracket: ${p.meta_ads.estimated_spend_bracket}`);
  }
  if (p.google_ads) {
    lines.push(`- Google Ads: ${p.google_ads.active_creative_count} creatives, campaigns active: ${p.google_ads.has_active_campaigns}`);
  }
  if (p.maps) {
    lines.push(`- Maps: ${p.maps.category}, rating ${p.maps.rating ?? "unknown"}, ${p.maps.review_count} reviews`);
  }

  return lines.length > 0 ? lines.join("\n") : "- No additional signals available";
}
