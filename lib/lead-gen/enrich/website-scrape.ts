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
import type { AnyNode } from "domhandler";
import { logExternalCall } from "@/lib/observatory";
import type { ViabilityProfile } from "../types";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 512_000; // 500KB cap per page

export interface ScrapedContact {
  email: string;
  name: string | null;
  role: string | null;
  source_page: string;
}

export interface WebsiteScrapeResult {
  has_about_page: boolean;
  has_pricing_page: boolean;
  team_size_signal: "solo" | "small" | "medium" | "large" | "unknown";
  stated_pricing_tier: "unknown" | "budget" | "mid" | "premium";
  scraped_contacts: ScrapedContact[];
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
  const allContacts: ScrapedContact[] = [];

  try {
    const homepage = await safeFetch(baseUrl);

    if (homepage) {
      const $ = cheerio.load(homepage);
      const links = extractNavLinks($, baseUrl);

      const aboutUrl = links.find((l) =>
        /\b(about|team|our-team|who-we-are|about-us)\b/i.test(l),
      );
      const pricingUrl = links.find((l) =>
        /\b(pricing|prices|plans|packages|rates|cost)\b/i.test(l),
      );
      const contactUrl = links.find((l) =>
        /\b(contact|get-in-touch|reach-us|enquire|enquiry|connect)\b/i.test(l),
      );

      hasAboutPage = !!aboutUrl;
      hasPricingPage = !!pricingUrl;

      extractContacts($, homepage, "homepage", domain, allContacts);

      if (aboutUrl) {
        const aboutHtml = await safeFetch(aboutUrl);
        if (aboutHtml) {
          teamSizeSignal = inferTeamSize(aboutHtml);
          const $about = cheerio.load(aboutHtml);
          extractContacts($about, aboutHtml, "about", domain, allContacts);
        }
      }

      if (pricingUrl) {
        const pricingHtml = await safeFetch(pricingUrl);
        if (pricingHtml) {
          pricingTier = inferPricingTier(pricingHtml);
        }
      }

      if (contactUrl) {
        const contactHtml = await safeFetch(contactUrl);
        if (contactHtml) {
          const $contact = cheerio.load(contactHtml);
          extractContacts($contact, contactHtml, "contact", domain, allContacts);
        }
      }

      if (teamSizeSignal === "unknown") {
        teamSizeSignal = inferTeamSize(homepage);
      }
      if (pricingTier === "unknown") {
        pricingTier = inferPricingTier(homepage);
      }
    }

    logExternalCall({ job: "website.scrape", actorType: "internal", units: { pages_fetched: 4 }, estimatedCostAud: 0 }).catch(() => {});

    return {
      has_about_page: hasAboutPage,
      has_pricing_page: hasPricingPage,
      team_size_signal: teamSizeSignal,
      stated_pricing_tier: pricingTier,
      scraped_contacts: dedupeContacts(allContacts),
    };
  } catch (err) {
    logExternalCall({ job: "website.scrape", actorType: "internal", units: { pages_fetched: 4 }, estimatedCostAud: 0 }).catch(() => {});
    return {
      has_about_page: false,
      has_pricing_page: false,
      team_size_signal: "unknown",
      stated_pricing_tier: "unknown",
      scraped_contacts: [],
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

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const JUNK_EMAIL_PREFIXES = new Set([
  "noreply", "no-reply", "support", "help", "billing", "sales",
  "admin", "webmaster", "postmaster", "mailer-daemon", "donotreply",
  "unsubscribe", "newsletter", "notifications", "updates",
]);

const ROLE_KEYWORDS: Record<string, string> = {
  founder: "Founder",
  "co-founder": "Co-Founder",
  ceo: "CEO",
  owner: "Owner",
  director: "Director",
  "managing director": "Managing Director",
  principal: "Principal",
  manager: "Manager",
  "marketing manager": "Marketing Manager",
  "general manager": "General Manager",
};

function extractContacts(
  $: cheerio.CheerioAPI,
  html: string,
  sourcePage: string,
  domain: string,
  out: ScrapedContact[],
): void {
  // 1. mailto: links — best signal, often paired with a name
  $("a[href^='mailto:']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const email = href.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (isJunkEmail(email)) return;

    const surroundingText = $(el).parent().text().trim();
    const name = inferNameNearEmail($, el, surroundingText);
    const role = inferRoleFromContext(surroundingText);
    out.push({ email, name, role, source_page: sourcePage });
  });

  // 2. Emails in visible text (not in scripts/styles)
  const bodyText = stripHtml(html);
  const textEmails = bodyText.match(EMAIL_RE) ?? [];
  for (const raw of textEmails) {
    const email = raw.toLowerCase();
    if (isJunkEmail(email)) continue;
    if (out.some((c) => c.email === email)) continue;
    out.push({ email, name: null, role: null, source_page: sourcePage });
  }
}

function isJunkEmail(email: string): boolean {
  const local = email.split("@")[0];
  if (JUNK_EMAIL_PREFIXES.has(local)) return true;
  if (/^(info|hello|contact|enquir|team|office|reception)@/i.test(email)) return false;
  if (/\.(png|jpg|svg|gif|webp|css|js)$/i.test(email)) return true;
  return false;
}

function inferNameNearEmail(
  $: cheerio.CheerioAPI,
  el: AnyNode,
  surroundingText: string,
): string | null {
  const parent = $(el).closest("div, li, td, section, article");
  const heading = parent.find("h1, h2, h3, h4, h5, h6, strong, b").first().text().trim();
  if (heading && heading.length < 60 && !heading.includes("@")) {
    const cleaned = heading.replace(/[^a-zA-Z\s'-]/g, "").trim();
    if (cleaned.split(/\s+/).length >= 2 && cleaned.split(/\s+/).length <= 4) {
      return cleaned;
    }
  }

  // Check surrounding text for a name pattern (2-4 capitalised words before the email)
  const before = surroundingText.split("@")[0];
  const nameMatch = before.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*$/);
  if (nameMatch) return nameMatch[1];

  return null;
}

function inferRoleFromContext(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [keyword, label] of Object.entries(ROLE_KEYWORDS)) {
    if (lower.includes(keyword)) return label;
  }
  return null;
}

function dedupeContacts(contacts: ScrapedContact[]): ScrapedContact[] {
  const seen = new Map<string, ScrapedContact>();
  for (const c of contacts) {
    const existing = seen.get(c.email);
    if (!existing) {
      seen.set(c.email, c);
    } else {
      // Prefer the entry with more data
      if (!existing.name && c.name) existing.name = c.name;
      if (!existing.role && c.role) existing.role = c.role;
    }
  }
  return [...seen.values()];
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

