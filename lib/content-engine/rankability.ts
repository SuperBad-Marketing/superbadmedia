/**
 * Content Engine — rankability scoring (spec §2.1 Stage 1, Q5).
 *
 * Two-part scoring:
 *   1. Domain authority heuristic — static list of ~500 high-authority
 *      domains. The fewer high-authority competitors in the top 10,
 *      the more rankable the keyword.
 *   2. Content gap analysis — fetch + cheerio on top 3 ranking pages,
 *      Haiku Claude call identifies underserved angles.
 *
 * Combined into a 0–100 rankability score.
 *
 * Owner: CE-2. Consumer: `runKeywordResearch()` in `research.ts`.
 */
import * as cheerio from "cheerio";
import { invokeLlmText } from "@/lib/ai/invoke";
import type { SerpSnapshot, SerpResult } from "./research";

// Loaded once at module init — ~500 domains, small enough for a Set.
import highAuthorityDomainsJson from "@/data/high-authority-domains.json";
const HIGH_AUTHORITY_DOMAINS = new Set<string>(
  highAuthorityDomainsJson as string[],
);

export interface RankabilityResult {
  score: number;
  contentGaps: ContentGap[];
}

export interface ContentGap {
  angle: string;
  reasoning: string;
}

/**
 * Score a keyword's rankability from its SERP snapshot.
 *
 * Returns a 0–100 score and a list of content gaps.
 */
export async function scoreKeywordRankability(
  keyword: string,
  serp: SerpSnapshot,
): Promise<RankabilityResult> {
  const authorityScore = computeAuthorityScore(serp.results);

  const top3 = serp.results.slice(0, 3);
  const contentGaps = await analyseContentGaps(keyword, top3);

  // Gap bonus: more gaps found = more opportunity (0–30 points)
  const gapBonus = Math.min(contentGaps.length * 10, 30);

  const score = Math.min(Math.round(authorityScore + gapBonus), 100);

  return { score, contentGaps };
}

/**
 * Domain authority heuristic. Counts how many of the top 10 SERP
 * results are from high-authority domains. Fewer = more rankable.
 *
 * Score range: 0–70 (leaves room for gap bonus on top).
 *
 * - 0 high-authority results: 70 points (wide open)
 * - 10 high-authority results: 0 points (totally locked out)
 */
export function computeAuthorityScore(results: SerpResult[]): number {
  if (results.length === 0) return 70;

  const highAuthCount = results.filter((r) =>
    isHighAuthority(r.domain),
  ).length;

  // Linear scale: each high-authority result reduces score by 7
  return Math.max(0, 70 - highAuthCount * 7);
}

/**
 * Check if a domain (or any parent domain) is in the high-authority list.
 * E.g., "blog.google.com" matches "google.com".
 */
export function isHighAuthority(domain: string): boolean {
  const cleaned = domain.toLowerCase().replace(/^www\./, "");

  if (HIGH_AUTHORITY_DOMAINS.has(cleaned)) return true;

  // Check parent domains: "blog.foo.com" → "foo.com"
  const parts = cleaned.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (HIGH_AUTHORITY_DOMAINS.has(parent)) return true;
  }

  return false;
}

/**
 * Content gap analysis via fetch + cheerio + Haiku.
 *
 * Fetches and extracts text from the top 3 SERP results, then asks
 * Haiku to identify underserved angles that a new article could cover.
 */
export async function analyseContentGaps(
  keyword: string,
  top3: SerpResult[],
): Promise<ContentGap[]> {
  const pageContents: string[] = [];

  for (const result of top3) {
    try {
      const content = await fetchAndExtractText(result.link);
      if (content) {
        pageContents.push(
          `## ${result.title} (${result.domain})\n${content}`,
        );
      }
    } catch {
      // Skip pages that fail to fetch — degraded gap analysis is
      // better than no gap analysis.
    }
  }

  if (pageContents.length === 0) {
    // Can't do gap analysis without any page content
    return [];
  }

  const prompt = buildGapAnalysisPrompt(keyword, pageContents);

  try {
    const raw = await invokeLlmText({
      job: "content-score-keyword-rankability",
      prompt,
      maxTokens: 1024,
    });

    return parseGapAnalysisResponse(raw);
  } catch {
    // LLM failure → empty gaps (conservative — still queues based on
    // authority score alone).
    return [];
  }
}

/**
 * Fetch a URL and extract its main text content using cheerio.
 * Strips nav, footer, sidebar, script, style elements.
 * Truncates to ~2000 chars to keep LLM context manageable.
 */
export async function fetchAndExtractText(
  url: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SuperBadBot/1.0; content-research)",
      },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove non-content elements
    $(
      "script, style, nav, footer, header, aside, .sidebar, .menu, .nav, .footer, .header, .advertisement, .ad, [role=navigation], [role=banner], [role=contentinfo]",
    ).remove();

    // Extract main content (prefer article/main elements)
    let text = "";
    const mainEl = $("article, main, [role=main]").first();
    if (mainEl.length) {
      text = mainEl.text();
    } else {
      text = $("body").text();
    }

    // Clean up whitespace
    text = text.replace(/\s+/g, " ").trim();

    // Truncate to ~2000 chars
    return text.slice(0, 2000) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildGapAnalysisPrompt(
  keyword: string,
  pageContents: string[],
): string {
  return `You are an SEO content strategist. Analyse the following top-ranking pages for the keyword "${keyword}" and identify 1-3 content gaps — angles, subtopics, or perspectives that are underserved or missing entirely. These gaps represent opportunities for a new article to rank by covering what competitors don't.

TOP-RANKING PAGES:
${pageContents.join("\n\n---\n\n")}

Respond in this exact JSON format (no markdown fencing):
[
  {
    "angle": "brief description of the underserved angle",
    "reasoning": "why this gap exists and why covering it would help rank"
  }
]

If no meaningful gaps exist, respond with an empty array: []`;
}

function parseGapAnalysisResponse(raw: string): ContentGap[] {
  try {
    // Strip potential markdown code fences
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (g: unknown): g is { angle: string; reasoning: string } =>
          typeof g === "object" &&
          g !== null &&
          typeof (g as Record<string, unknown>).angle === "string" &&
          typeof (g as Record<string, unknown>).reasoning === "string",
      )
      .slice(0, 3);
  } catch {
    return [];
  }
}
