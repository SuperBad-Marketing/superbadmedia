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
  phone: string | null;
  source_page: string;
}

export interface ScrapedPhone {
  number: string;
  source_page: string;
}

export interface WebsiteScrapeResult {
  has_about_page: boolean;
  has_pricing_page: boolean;
  team_size_signal: "solo" | "small" | "medium" | "large" | "unknown";
  stated_pricing_tier: "unknown" | "budget" | "mid" | "premium";
  scraped_contacts: ScrapedContact[];
  scraped_phones: ScrapedPhone[];
  error?: string;
}

const FALLBACK_ABOUT_PATHS = ["/about", "/about-us", "/our-team", "/team", "/who-we-are"];
const FALLBACK_CONTACT_PATHS = ["/contact", "/contact-us", "/get-in-touch", "/enquire", "/enquiry"];
const FALLBACK_PRICING_PATHS = ["/pricing", "/prices", "/packages", "/plans"];

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
  const allPhones: ScrapedPhone[] = [];
  let pagesFetched = 0;

  try {
    const homepage = await safeFetch(baseUrl);
    if (homepage) pagesFetched++;

    if (homepage) {
      const $ = cheerio.load(homepage);
      const links = extractNavLinks($, baseUrl);

      let aboutUrl = links.find((l) =>
        /\b(about|team|our-team|who-we-are|about-us)\b/i.test(l),
      );
      let pricingUrl = links.find((l) =>
        /\b(pricing|prices|plans|packages|rates|cost)\b/i.test(l),
      );
      let contactUrl = links.find((l) =>
        /\b(contact|get-in-touch|reach-us|enquire|enquiry|connect)\b/i.test(l),
      );

      // Fallback: try common URL paths when nav detection fails
      if (!aboutUrl) aboutUrl = (await probeFirstValid(baseUrl, FALLBACK_ABOUT_PATHS)) ?? undefined;
      if (!contactUrl) contactUrl = (await probeFirstValid(baseUrl, FALLBACK_CONTACT_PATHS)) ?? undefined;
      if (!pricingUrl) pricingUrl = (await probeFirstValid(baseUrl, FALLBACK_PRICING_PATHS)) ?? undefined;

      hasAboutPage = !!aboutUrl;
      hasPricingPage = !!pricingUrl;

      extractStructuredContacts($, "homepage", allContacts, allPhones);
      extractContacts($, homepage, "homepage", domain, allContacts);
      extractPhones($, homepage, "homepage", allPhones);

      if (aboutUrl) {
        const aboutHtml = await safeFetch(aboutUrl);
        if (aboutHtml) {
          pagesFetched++;
          teamSizeSignal = inferTeamSize(aboutHtml);
          const $about = cheerio.load(aboutHtml);
          extractStructuredContacts($about, "about", allContacts, allPhones);
          extractContacts($about, aboutHtml, "about", domain, allContacts);
          extractPhones($about, aboutHtml, "about", allPhones);
        }
      }

      if (pricingUrl) {
        const pricingHtml = await safeFetch(pricingUrl);
        if (pricingHtml) {
          pagesFetched++;
          pricingTier = inferPricingTier(pricingHtml);
        }
      }

      if (contactUrl) {
        const contactHtml = await safeFetch(contactUrl);
        if (contactHtml) {
          pagesFetched++;
          const $contact = cheerio.load(contactHtml);
          extractStructuredContacts($contact, "contact", allContacts, allPhones);
          extractContacts($contact, contactHtml, "contact", domain, allContacts);
          extractPhones($contact, contactHtml, "contact", allPhones);
        }
      }

      if (teamSizeSignal === "unknown") {
        teamSizeSignal = inferTeamSize(homepage);
      }
      if (pricingTier === "unknown") {
        pricingTier = inferPricingTier(homepage);
      }
    }

    logExternalCall({ job: "website.scrape", actorType: "internal", units: { pages_fetched: pagesFetched }, estimatedCostAud: 0 }).catch(() => {});

    const dedupedContacts = dedupeContacts(allContacts);
    const dedupedPhones = dedupePhones(allPhones);

    // Cross-attach: if we found phones but contacts have no phone, attach the best one
    if (dedupedPhones.length > 0 && dedupedContacts.length > 0) {
      for (const contact of dedupedContacts) {
        if (!contact.phone) {
          const samePagePhone = dedupedPhones.find((p) => p.source_page === contact.source_page);
          contact.phone = samePagePhone?.number ?? dedupedPhones[0].number;
        }
      }
    }

    return {
      has_about_page: hasAboutPage,
      has_pricing_page: hasPricingPage,
      team_size_signal: teamSizeSignal,
      stated_pricing_tier: pricingTier,
      scraped_contacts: dedupedContacts,
      scraped_phones: dedupedPhones,
    };
  } catch (err) {
    logExternalCall({ job: "website.scrape", actorType: "internal", units: { pages_fetched: pagesFetched }, estimatedCostAud: 0 }).catch(() => {});
    return {
      has_about_page: false,
      has_pricing_page: false,
      team_size_signal: "unknown",
      stated_pricing_tier: "unknown",
      scraped_contacts: [],
      scraped_phones: [],
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
 * Extract navigation links from a page. Checks nav, header, footer, and
 * common menu class patterns. Resolves relative URLs.
 */
function extractNavLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: string[] = [];
  const selectors = [
    "nav a[href]",
    "header a[href]",
    "footer a[href]",
    ".menu a[href]",
    ".navigation a[href]",
    "[role='navigation'] a[href]",
    "[role='contentinfo'] a[href]",
    ".footer a[href]",
    "#footer a[href]",
    ".site-footer a[href]",
  ];
  $(selectors.join(", ")).each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const resolved = new URL(href, baseUrl).href;
      links.push(resolved);
    } catch {
      // Malformed URL — skip
    }
  });
  return [...new Set(links)];
}

/**
 * HEAD-probe a list of fallback paths and return the first that responds 200.
 */
async function probeFirstValid(baseUrl: string, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    const url = `${baseUrl}${path}`;
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(3_000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SuperBadBot/1.0; +https://superbadmedia.com.au)" },
        redirect: "follow",
      });
      if (response.ok) return url;
    } catch {
      // Timeout or network error — try next
    }
  }
  return null;
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

// Obfuscated email patterns: name [at] domain [dot] com, name (at) domain (dot) com
const OBFUSCATED_EMAIL_RE = /[a-zA-Z0-9._%+\-]+\s*[\[({\s]at[\])}\s]\s*[a-zA-Z0-9.\-]+\s*[\[({\s]dot[\])}\s]\s*[a-zA-Z]{2,}/gi;

// Australian phone: 04xx, (0x) xxxx, +61, 13xx, 1300, 1800
const AU_PHONE_RE = /(?:\+61\s?\d[\s.\-]?\d{4}[\s.\-]?\d{4}|(?:\(0\d\)|0\d)[\s.\-]?\d{4}[\s.\-]?\d{4}|04\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}|1[38]00[\s.\-]?\d{3}[\s.\-]?\d{3}|13[\s.\-]?\d{2}[\s.\-]?\d{2})/g;

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

/**
 * Extract contact info from schema.org JSON-LD and meta tags.
 * Many WordPress/Squarespace sites embed structured data via Yoast, RankMath, etc.
 */
function extractStructuredContacts(
  $: cheerio.CheerioAPI,
  sourcePage: string,
  contacts: ScrapedContact[],
  phones: ScrapedPhone[],
): void {
  // JSON-LD blocks
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      if (!raw) return;
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        extractFromJsonLdNode(item, sourcePage, contacts, phones);
      }
    } catch {
      // Malformed JSON-LD — skip
    }
  });

  // Open Graph / meta fallbacks
  const ogEmail = $('meta[property="og:email"]').attr("content")?.trim().toLowerCase();
  if (ogEmail && ogEmail.includes("@") && !isJunkEmail(ogEmail) && !contacts.some((c) => c.email === ogEmail)) {
    contacts.push({ email: ogEmail, name: null, role: null, phone: null, source_page: sourcePage });
  }
}

function extractFromJsonLdNode(
  node: Record<string, unknown>,
  sourcePage: string,
  contacts: ScrapedContact[],
  phones: ScrapedPhone[],
): void {
  if (!node || typeof node !== "object") return;

  const email = typeof node.email === "string" ? node.email.replace(/^mailto:/i, "").trim().toLowerCase() : null;
  const telephone = typeof node.telephone === "string" ? node.telephone.trim() : null;
  const name = typeof node.name === "string" ? node.name.trim() : null;
  const jobTitle = typeof node.jobTitle === "string" ? node.jobTitle.trim() : null;

  if (email && email.includes("@") && !isJunkEmail(email) && !contacts.some((c) => c.email === email)) {
    contacts.push({ email, name, role: jobTitle, phone: telephone, source_page: sourcePage });
  }
  if (telephone && !phones.some((p) => normalisePhone(p.number) === normalisePhone(telephone))) {
    phones.push({ number: telephone, source_page: sourcePage });
  }

  // Recurse into contactPoint, founder, employee, member, author
  for (const key of ["contactPoint", "founder", "employee", "member", "author", "owns"]) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) extractFromJsonLdNode(c as Record<string, unknown>, sourcePage, contacts, phones);
    } else if (child && typeof child === "object") {
      extractFromJsonLdNode(child as Record<string, unknown>, sourcePage, contacts, phones);
    }
  }
}

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
    if (out.some((c) => c.email === email)) return;

    const surroundingText = $(el).parent().text().trim();
    const name = inferNameNearEmail($, el, surroundingText);
    const role = inferRoleFromContext(surroundingText);
    out.push({ email, name, role, phone: null, source_page: sourcePage });
  });

  // 2. Emails in visible text (not in scripts/styles)
  const bodyText = stripHtml(html);
  const textEmails = bodyText.match(EMAIL_RE) ?? [];
  for (const raw of textEmails) {
    const email = raw.toLowerCase();
    if (isJunkEmail(email)) continue;
    if (out.some((c) => c.email === email)) continue;
    out.push({ email, name: null, role: null, phone: null, source_page: sourcePage });
  }

  // 3. Obfuscated emails: "name [at] domain [dot] com" → name@domain.com
  const obfuscated = bodyText.match(OBFUSCATED_EMAIL_RE) ?? [];
  for (const raw of obfuscated) {
    const email = raw
      .replace(/\s*[\[({\s]at[\])}\s]\s*/gi, "@")
      .replace(/\s*[\[({\s]dot[\])}\s]\s*/gi, ".")
      .trim()
      .toLowerCase();
    if (!email.includes("@") || isJunkEmail(email)) continue;
    if (out.some((c) => c.email === email)) continue;
    out.push({ email, name: null, role: null, phone: null, source_page: sourcePage });
  }
}

/**
 * Extract phone numbers from tel: links and visible text.
 */
function extractPhones(
  $: cheerio.CheerioAPI,
  html: string,
  sourcePage: string,
  out: ScrapedPhone[],
): void {
  // 1. tel: links
  $("a[href^='tel:']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const number = href.replace(/^tel:/i, "").trim();
    if (number.length < 8) return;
    if (!out.some((p) => normalisePhone(p.number) === normalisePhone(number))) {
      out.push({ number, source_page: sourcePage });
    }
  });

  // 2. Phone patterns in visible text
  const bodyText = stripHtml(html);
  const textPhones = bodyText.match(AU_PHONE_RE) ?? [];
  for (const raw of textPhones) {
    const number = raw.trim();
    if (!out.some((p) => normalisePhone(p.number) === normalisePhone(number))) {
      out.push({ number, source_page: sourcePage });
    }
  }
}

function normalisePhone(phone: string): string {
  return phone.replace(/[\s.\-()]/g, "");
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
      if (!existing.name && c.name) existing.name = c.name;
      if (!existing.role && c.role) existing.role = c.role;
      if (!existing.phone && c.phone) existing.phone = c.phone;
    }
  }
  return [...seen.values()];
}

function dedupePhones(phones: ScrapedPhone[]): ScrapedPhone[] {
  const seen = new Map<string, ScrapedPhone>();
  for (const p of phones) {
    const key = normalisePhone(p.number);
    if (!seen.has(key)) seen.set(key, p);
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

