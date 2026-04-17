/**
 * Website scrape enrichment adapter.
 *
 * Fetches the target domain's root, /about, /team, and /pricing pages.
 * Uses cheerio to parse team size signals and pricing tier indicators.
 * No external API — free fetch. Not logged to external_call_log.
 *
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import * as cheerio from "cheerio";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

type TeamSizeSignal = NonNullable<
  ViabilityProfile["website"]
>["team_size_signal"];

type PricingTier = NonNullable<
  ViabilityProfile["website"]
>["stated_pricing_tier"];

const TEAM_KEYWORDS_SOLO = [
  "sole trader",
  "freelancer",
  "independent",
  "just me",
  "owner operated",
];
const TEAM_KEYWORDS_SMALL = ["small team", "boutique", "tight-knit"];
const TEAM_KEYWORDS_MEDIUM = ["growing team", "mid-size"];
const TEAM_KEYWORDS_LARGE = ["enterprise", "global team", "100+", "500+"];

const PRICING_BUDGET_KEYWORDS = ["affordable", "budget", "cheap", "low cost"];
const PRICING_PREMIUM_KEYWORDS = [
  "premium",
  "luxury",
  "high-end",
  "exclusive",
  "bespoke",
];
const PRICING_MID_KEYWORDS = ["competitive rates", "fair pricing", "packages"];

const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; SuperBadBot/1.0; +https://superbadmedia.com.au)";

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS,
    );
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function detectTeamSize(text: string): TeamSizeSignal {
  const lower = text.toLowerCase();
  if (TEAM_KEYWORDS_LARGE.some((k) => lower.includes(k))) return "large";
  if (TEAM_KEYWORDS_MEDIUM.some((k) => lower.includes(k))) return "medium";
  if (TEAM_KEYWORDS_SMALL.some((k) => lower.includes(k))) return "small";
  if (TEAM_KEYWORDS_SOLO.some((k) => lower.includes(k))) return "solo";

  // Count "our team" section headings as a proxy
  const teamCountMatch = lower.match(/\bteam of (\d+)\b/);
  if (teamCountMatch) {
    const n = parseInt(teamCountMatch[1], 10);
    if (n === 1) return "solo";
    if (n <= 5) return "small";
    if (n <= 20) return "medium";
    return "large";
  }

  return "unknown";
}

function detectPricingTier(text: string): PricingTier {
  const lower = text.toLowerCase();
  if (PRICING_PREMIUM_KEYWORDS.some((k) => lower.includes(k)))
    return "premium";
  if (PRICING_BUDGET_KEYWORDS.some((k) => lower.includes(k))) return "budget";
  if (PRICING_MID_KEYWORDS.some((k) => lower.includes(k))) return "mid";
  return "unknown";
}

function extractText($: cheerio.CheerioAPI): string {
  $("script, style, nav, footer, header").remove();
  return $("body").text().replace(/\s+/g, " ").slice(0, 20000);
}

/**
 * Enrich a candidate with website structure and content signals.
 *
 * @param domain - Normalised domain (e.g. "acme.com.au"). Null returns {}.
 */
export async function enrichWebsiteScrape(
  domain: string | null,
): Promise<Partial<ViabilityProfile>> {
  if (!domain) return {};

  const base = `https://${domain}`;

  const [rootHtml, aboutHtml, teamHtml, pricingHtml] = await Promise.all([
    fetchPage(base),
    fetchPage(`${base}/about`),
    fetchPage(`${base}/team`),
    fetchPage(`${base}/pricing`),
  ]);

  const hasAboutPage = !!aboutHtml;
  const hasPricingPage = !!pricingHtml;

  // Combine all available text for signal extraction
  let combinedText = "";
  for (const html of [rootHtml, aboutHtml, teamHtml, pricingHtml]) {
    if (html) {
      const $ = cheerio.load(html);
      combinedText += " " + extractText($);
    }
  }

  const teamSizeSignal = detectTeamSize(combinedText);
  const statedPricingTier = detectPricingTier(combinedText);

  return {
    website: {
      has_about_page: hasAboutPage,
      has_pricing_page: hasPricingPage,
      team_size_signal: teamSizeSignal,
      stated_pricing_tier: statedPricingTier,
      domain_age_years: null,
      pagespeed_performance_score: null,
    },
  };
}
