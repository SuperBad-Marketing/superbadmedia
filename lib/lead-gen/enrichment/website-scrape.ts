/**
 * Website scrape enrichment — cheerio-based HTML parsing.
 * Populates website.has_about_page, has_pricing_page, team_size_signal, stated_pricing_tier.
 * Does NOT log to external_call_log (free fetch, no cost tracking needed).
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import * as cheerio from "cheerio";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const FETCH_TIMEOUT_MS = 10_000;

type TeamSizeSignal = NonNullable<ViabilityProfile["website"]>["team_size_signal"];
type PricingTier = NonNullable<ViabilityProfile["website"]>["stated_pricing_tier"];

export async function enrichWebsiteScrape(
  domain: string | null,
): Promise<Partial<ViabilityProfile>> {
  if (!domain) return {};

  const base = `https://${domain}`;

  const [root, about, team, pricing] = await Promise.allSettled([
    fetchPage(base),
    fetchPage(`${base}/about`),
    fetchPage(`${base}/team`),
    fetchPage(`${base}/pricing`),
  ]);

  const rootHtml = root.status === "fulfilled" ? root.value : null;
  const aboutHtml = about.status === "fulfilled" ? about.value : null;
  const teamHtml = team.status === "fulfilled" ? team.value : null;
  const pricingHtml = pricing.status === "fulfilled" ? pricing.value : null;

  const hasAboutPage = !!aboutHtml || hasAboutLink(rootHtml);
  const hasPricingPage = !!pricingHtml || hasPricingLink(rootHtml);

  const allHtml = [rootHtml, aboutHtml, teamHtml].filter(Boolean).join(" ");
  const teamSize = inferTeamSize(allHtml);
  const pricingTier = inferPricingTier([rootHtml, pricingHtml].filter(Boolean).join(" "));

  return {
    website: {
      domain_age_years: null,
      pagespeed_performance_score: null,
      has_about_page: hasAboutPage,
      has_pricing_page: hasPricingPage,
      team_size_signal: teamSize,
      stated_pricing_tier: pricingTier,
    },
  };
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; enrichment-bot/1.0)" },
    });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

function hasAboutLink(html: string | null): boolean {
  if (!html) return false;
  const $ = cheerio.load(html);
  return $("a[href*='/about']").length > 0 || $("a[href*='about-us']").length > 0;
}

function hasPricingLink(html: string | null): boolean {
  if (!html) return false;
  const $ = cheerio.load(html);
  return $("a[href*='/pricing']").length > 0 || $("a[href*='plans']").length > 0;
}

function inferTeamSize(html: string): TeamSizeSignal {
  if (!html) return "unknown";
  const lower = html.toLowerCase();
  // Look for explicit team size signals in text
  const soloSignals = ["founder", "solo", "freelance", "just me", "i am", "i'm a"];
  const smallSignals = ["small team", "our team of", "team of 2", "team of 3", "team of 4", "team of 5"];
  const mediumSignals = ["team of 6", "team of 7", "team of 8", "team of 9", "team of 10",
    "10 people", "12 people", "15 people", "20 staff", "25 staff"];
  const largeSignals = ["50 staff", "100 staff", "200 employees", "enterprise", "global team"];

  if (largeSignals.some((s) => lower.includes(s))) return "large";
  if (mediumSignals.some((s) => lower.includes(s))) return "medium";
  if (smallSignals.some((s) => lower.includes(s))) return "small";
  if (soloSignals.some((s) => lower.includes(s))) return "solo";

  // Count headings in team/about pages as a proxy
  const $ = cheerio.load(html);
  const teamCards = $(".team, .staff, .people, .crew, .members").find("h2, h3, li").length;
  if (teamCards >= 20) return "large";
  if (teamCards >= 8) return "medium";
  if (teamCards >= 2) return "small";
  if (teamCards === 1) return "solo";

  return "unknown";
}

function inferPricingTier(html: string): PricingTier {
  if (!html) return "unknown";
  const lower = html.toLowerCase();

  // Currency signals — look for explicit price mentions
  const budgetSignals = ["$49", "$99", "$199", "affordable", "budget", "cheap", "low cost", "from $"];
  const premiumSignals = ["$2,000", "$3,000", "$5,000", "$10,000", "premium", "enterprise", "bespoke",
    "custom quote", "contact us for pricing", "let's talk"];
  const midSignals = ["$500", "$1,000", "$1,500", "$800", "$600", "professional", "standard plan"];

  if (premiumSignals.some((s) => lower.includes(s))) return "premium";
  if (midSignals.some((s) => lower.includes(s))) return "mid";
  if (budgetSignals.some((s) => lower.includes(s))) return "budget";

  return "unknown";
}
