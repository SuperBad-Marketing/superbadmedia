/**
 * Website scrape enrichment — team size, service list, pricing tier signals.
 *
 * Fetches the candidate's homepage, about page, and pricing page via
 * plain HTTP + cheerio parsing. No headless browser — keeps it fast and
 * cheap. Extracts signals that PageSpeed can't: team size language,
 * pricing language, and page existence.
 *
 * Owner: LG-3. Consumer: enrichment orchestrator.
 */

import * as cheerio from "cheerio";
import { logExternalCall } from "@/lib/observatory";
import type { ViabilityProfile } from "../types";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 512_000; // 500KB cap per page

export interface WebsiteScrapeResult {
  has_about_page: boolean;
  has_pricing_page: boolean;
  team_size_signal: "solo" | "small" | "medium" | "large" | "unknown";
  stated_pricing_tier: "unknown" | "budget" | "mid" | "premium";
  error?: string;
}

/**
 * Scrape a candidate's website for team size, pricing, and page signals.
 *
 * @param domain Bare domain (no protocol).
 * @returns Structured signals for the ViabilityProfile.website fields.
 */
export async function scrapeWebsite(
  domain: string,
): Promise<WebsiteScrapeResult> {
  const start = Date.now();
  const baseUrl = `https://${domain}`;

  let hasAboutPage = false;
  let hasPricingPage = false;
  let teamSizeSignal: WebsiteScrapeResult["team_size_signal"] = "unknown";
  let pricingTier: WebsiteScrapeResult["stated_pricing_tier"] = "unknown";

  try {
    // Fetch homepage to discover nav links
    const homepage = await safeFetch(baseUrl);

    if (homepage) {
      const $ = cheerio.load(homepage);
      const links = extractNavLinks($, baseUrl);

      // Check for about and pricing pages in navigation
      const aboutUrl = links.find((l) =>
        /\b(about|team|our-team|who-we-are|about-us)\b/i.test(l),
      );
      const pricingUrl = links.find((l) =>
        /\b(pricing|prices|plans|packages|rates|cost)\b/i.test(l),
      );

      hasAboutPage = !!aboutUrl;
      hasPricingPage = !!pricingUrl;

      // Scrape about page for team size signals
      if (aboutUrl) {
        const aboutHtml = await safeFetch(aboutUrl);
        if (aboutHtml) {
          teamSizeSignal = inferTeamSize(aboutHtml);
        }
      }

      // Scrape pricing page for pricing tier signals
      if (pricingUrl) {
        const pricingHtml = await safeFetch(pricingUrl);
        if (pricingHtml) {
          pricingTier = inferPricingTier(pricingHtml);
        }
      }

      // Fallback: check homepage text for team and pricing signals
      if (teamSizeSignal === "unknown") {
        teamSizeSignal = inferTeamSize(homepage);
      }
      if (pricingTier === "unknown") {
        pricingTier = inferPricingTier(homepage);
      }
    }

    const duration = Date.now() - start;
    logExternalCall({ job: "website.scrape", actorType: "internal", units: { pages_fetched: 3 }, estimatedCostAud: 0 }).catch(() => {});

    return {
      has_about_page: hasAboutPage,
      has_pricing_page: hasPricingPage,
      team_size_signal: teamSizeSignal,
      stated_pricing_tier: pricingTier,
    };
  } catch (err) {
    const duration = Date.now() - start;
    logExternalCall({ job: "website.scrape", actorType: "internal", units: { pages_fetched: 3 }, estimatedCostAud: 0 }).catch(() => {});
    return {
      has_about_page: false,
      has_pricing_page: false,
      team_size_signal: "unknown",
      stated_pricing_tier: "unknown",
      error: `Website scrape failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Fetch a URL with timeout and size cap. Returns HTML string or null.
 */
async function safeFetch(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SuperBadBot/1.0; +https://superbadmedia.com.au)",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_BYTES) {
      return new TextDecoder().decode(buffer.slice(0, MAX_BODY_BYTES));
    }

    return new TextDecoder().decode(buffer);
  } catch {
    return null;
  }
}

/**
 * Extract navigation links from a page. Resolves relative URLs.
 */
function extractNavLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: string[] = [];
  $("nav a[href], header a[href], .menu a[href], .navigation a[href]").each(
    (_, el) => {
      const href = $(el).attr("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      try {
        const resolved = new URL(href, baseUrl).href;
        links.push(resolved);
      } catch {
        // Malformed URL — skip
      }
    },
  );
  return [...new Set(links)];
}

/**
 * Infer team size from page text content.
 */
export function inferTeamSize(
  html: string,
): WebsiteScrapeResult["team_size_signal"] {
  const text = stripHtml(html).toLowerCase();

  // Look for explicit team member counts or team page patterns
  const teamCountMatch = text.match(
    /(\d+)\+?\s*(team\s*members?|employees?|staff|people|specialists?|experts?)/i,
  );

  if (teamCountMatch) {
    const count = parseInt(teamCountMatch[1], 10);
    if (count <= 1) return "solo";
    if (count <= 5) return "small";
    if (count <= 25) return "medium";
    return "large";
  }

  // Look for solo operator signals
  if (
    /\b(sole\s*trader|solopreneur|one[- ]?man|one[- ]?woman|freelanc\w*|independent\s*consultant|solo\s*founder)\b/i.test(
      text,
    )
  ) {
    return "solo";
  }

  // Look for "our team" language suggesting >1
  if (/\b(our\s*team|meet\s*the\s*team|our\s*people|our\s*staff)\b/i.test(text)) {
    return "small"; // Conservative — "our team" is at least 2
  }

  // Look for department/division language suggesting larger org
  if (
    /\b(departments?|divisions?|offices?\s*in|global\s*team|headquarters)\b/i.test(
      text,
    )
  ) {
    return "large";
  }

  return "unknown";
}

/**
 * Infer pricing tier from page text content.
 */
export function inferPricingTier(
  html: string,
): WebsiteScrapeResult["stated_pricing_tier"] {
  const text = stripHtml(html).toLowerCase();

  // Look for explicit price amounts (AUD or generic $)
  const priceMatches = text.match(/\$\s*([\d,]+)/g);
  if (priceMatches && priceMatches.length > 0) {
    const prices = priceMatches
      .map((p) => parseInt(p.replace(/[$,\s]/g, ""), 10))
      .filter((n) => !isNaN(n) && n > 0);

    if (prices.length > 0) {
      const median = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];
      if (median < 100) return "budget";
      if (median < 500) return "mid";
      return "premium";
    }
  }

  // Look for premium language
  if (
    /\b(premium|luxury|bespoke|tailored|custom\s*quot|enterprise|high[- ]?end)\b/i.test(
      text,
    )
  ) {
    return "premium";
  }

  // Look for budget language
  if (
    /\b(affordable|cheap|budget|low[- ]?cost|free\s*trial|starting\s*from\s*\$?\d{1,2}\b)\b/i.test(
      text,
    )
  ) {
    return "budget";
  }

  return "unknown";
}

/**
 * Strip HTML tags and normalise whitespace for text analysis.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Merge website scrape result into a partial ViabilityProfile.
 */
export function applyWebsiteScrapeToProfile(
  profile: Partial<ViabilityProfile>,
  result: WebsiteScrapeResult,
): Partial<ViabilityProfile> {
  return {
    ...profile,
    website: {
      domain_age_years: profile.website?.domain_age_years ?? null,
      pagespeed_performance_score:
        profile.website?.pagespeed_performance_score ?? null,
      has_about_page: result.has_about_page,
      has_pricing_page: result.has_pricing_page,
      team_size_signal: result.team_size_signal,
      stated_pricing_tier: result.stated_pricing_tier,
    },
    fetch_errors: result.error
      ? { ...profile.fetch_errors, website_scrape: result.error }
      : profile.fetch_errors,
  };
}

