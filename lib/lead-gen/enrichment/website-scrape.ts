import * as cheerio from "cheerio";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

type TeamSizeSignal = ViabilityProfile["website"] extends
  | { team_size_signal: infer T }
  | undefined
  ? T
  : never;
type PricingTier = ViabilityProfile["website"] extends
  | { stated_pricing_tier: infer T }
  | undefined
  ? T
  : never;

const TEAM_KEYWORDS: Record<string, TeamSizeSignal> = {
  "founder": "solo",
  "solo": "solo",
  "freelance": "solo",
  "team of 2": "small",
  "team of 3": "small",
  "team of 4": "small",
  "team of 5": "small",
  "small team": "small",
  "boutique": "small",
  "team of 1": "solo",
  "staff of": "medium",
  "employees": "medium",
  "our team": "medium",
  "meet the team": "small",
};

const PRICING_KEYWORDS: Record<string, PricingTier> = {
  "$": "budget",
  "affordable": "budget",
  "cheap": "budget",
  "low cost": "budget",
  "competitive pricing": "budget",
  "premium": "premium",
  "enterprise": "premium",
  "custom quote": "premium",
  "bespoke": "premium",
  "luxury": "premium",
  "mid-tier": "mid",
  "mid tier": "mid",
  "packages from": "mid",
  "starting from": "mid",
};

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "SuperBadBot/1.0 (+https://superbadmedia.com.au)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function detectTeamSize(html: string, text: string): TeamSizeSignal {
  const lower = (html + " " + text).toLowerCase();
  for (const [keyword, signal] of Object.entries(TEAM_KEYWORDS)) {
    if (lower.includes(keyword)) return signal;
  }
  return "unknown";
}

function detectPricingTier(html: string, text: string): PricingTier {
  const lower = (html + " " + text).toLowerCase();
  for (const [keyword, tier] of Object.entries(PRICING_KEYWORDS)) {
    if (lower.includes(keyword)) return tier;
  }
  return "unknown";
}

/**
 * Enrich with website signals by scraping root, /about, /team, /pricing pages.
 * Uses cheerio to parse content. No external_call_log (free fetch, no cost tracking).
 *
 * @param domain - Normalised domain (e.g. "acme.com.au"). Null → returns {}.
 */
export async function enrichWebsiteScrape(
  domain: string | null,
): Promise<Partial<ViabilityProfile>> {
  if (!domain) return {};

  const base = `https://${domain}`;
  const pages = [
    { path: "/", name: "root" },
    { path: "/about", name: "about" },
    { path: "/about-us", name: "about" },
    { path: "/team", name: "team" },
    { path: "/our-team", name: "team" },
    { path: "/pricing", name: "pricing" },
    { path: "/prices", name: "pricing" },
  ] as const;

  const fetched: Record<string, string> = {};

  await Promise.all(
    pages.map(async ({ path, name }) => {
      if (fetched[name]) return;
      const html = await tryFetch(`${base}${path}`);
      if (html) fetched[name] = html;
    }),
  );

  const hasAboutPage = Boolean(fetched["about"]);
  const hasPricingPage = Boolean(fetched["pricing"]);

  const teamHtml = fetched["team"] ?? fetched["about"] ?? fetched["root"] ?? "";
  const teamText = teamHtml ? cheerio.load(teamHtml).text() : "";

  const pricingHtml = fetched["pricing"] ?? fetched["root"] ?? "";
  const pricingText = pricingHtml ? cheerio.load(pricingHtml).text() : "";

  const team_size_signal = detectTeamSize(teamHtml, teamText);
  const stated_pricing_tier = detectPricingTier(pricingHtml, pricingText);

  return {
    website: {
      has_about_page: hasAboutPage,
      has_pricing_page: hasPricingPage,
      team_size_signal,
      stated_pricing_tier,
      domain_age_years: null,
      pagespeed_performance_score: null,
    },
  };
}
