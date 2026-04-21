/**
 * Contact email discovery via Hunter.io Domain Search + pattern inference
 * fallback. Step 8 of §3.4, spec §7.
 *
 * Owner: LG-5. Consumer: daily search runner.
 */

import { logExternalCall } from "@/lib/observatory";
import { getCredential } from "@/lib/integrations/getCredential";

const HUNTER_API_BASE = "https://api.hunter.io/v2";
const HUNTER_TIMEOUT_MS = 10_000;

const PREFERRED_ROLES = new Set([
  "founder",
  "ceo",
  "owner",
  "marketing-manager",
  "marketing-director",
  "growth-lead",
]);

export interface ContactDiscoveryResult {
  email: string | null;
  name: string | null;
  role: string | null;
  confidence: "verified" | "inferred" | "unknown";
  source: "hunter" | "pattern_inference" | "none";
}

interface HunterEmail {
  value: string;
  type: string | null;
  confidence: number;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  seniority: string | null;
}

interface HunterDomainSearchResponse {
  data?: {
    emails?: HunterEmail[];
    pattern?: string | null;
  };
  errors?: Array<{ details: string }>;
}

/**
 * Discover a contact email for the given domain. Hunter.io is primary;
 * pattern inference is fallback (§7.1 steps 1–5).
 */
export async function discoverContact(
  domain: string,
  companyName: string,
): Promise<ContactDiscoveryResult> {
  const apiKey = await getCredential("hunter-io");

  if (!apiKey) {
    return { email: null, name: null, role: null, confidence: "unknown", source: "none" };
  }

  const startMs = Date.now();
  try {
    const result = await hunterDomainSearch(domain, apiKey);
    const durationMs = Date.now() - startMs;
    logExternalCall({ job: "hunter.domain_search", actorType: "internal", units: { searches: 1, results_returned: result.emails?.length ?? 0 }, estimatedCostAud: 0.03 }).catch(() => {});

    if (result.emails && result.emails.length > 0) {
      const match = pickBestContact(result.emails);
      if (match) {
        return {
          email: match.value,
          name: formatName(match.first_name, match.last_name),
          role: match.position ?? null,
          confidence: match.confidence >= 70 ? "verified" : "inferred",
          source: "hunter",
        };
      }
    }

    // Hunter returned no usable match — try pattern inference
    if (result.pattern) {
      const inferred = inferFromPattern(result.pattern, domain);
      if (inferred) {
        return {
          email: inferred,
          name: null,
          role: null,
          confidence: "inferred",
          source: "pattern_inference",
        };
      }
    }

    return { email: null, name: null, role: null, confidence: "unknown", source: "none" };
  } catch {
    const durationMs = Date.now() - startMs;
    logExternalCall({ job: "hunter.domain_search", actorType: "internal", units: { searches: 1, results_returned: 0 }, estimatedCostAud: 0.03 }).catch(() => {});
    return { email: null, name: null, role: null, confidence: "unknown", source: "none" };
  }
}

async function hunterDomainSearch(
  domain: string,
  apiKey: string,
): Promise<NonNullable<HunterDomainSearchResponse["data"]>> {
  const url = new URL(`${HUNTER_API_BASE}/domain-search`);
  url.searchParams.set("domain", domain);
  url.searchParams.set("api_key", apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HUNTER_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Hunter API ${response.status}`);
    }
    const json = (await response.json()) as HunterDomainSearchResponse;
    if (json.errors?.length) {
      throw new Error(json.errors[0].details);
    }
    return json.data ?? {};
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pick the best contact from Hunter results: prefer decision-makers
 * (closed role list §7.1 step 2), then highest confidence.
 */
function pickBestContact(emails: HunterEmail[]): HunterEmail | null {
  const roleMatches = emails.filter((e) => {
    if (!e.position) return false;
    const normalised = e.position.toLowerCase().replace(/\s+/g, "-");
    return PREFERRED_ROLES.has(normalised);
  });

  const pool = roleMatches.length > 0 ? roleMatches : emails;

  const sorted = [...pool].sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];

  if (!best || best.confidence < 30) return null;
  return best;
}

function formatName(first: string | null, last: string | null): string | null {
  const parts = [first, last].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Pattern inference fallback (§7.1 step 4). Uses Hunter's detected
 * pattern for the domain, or falls back to common patterns.
 */
function inferFromPattern(
  pattern: string,
  domain: string,
): string | null {
  // Hunter patterns look like "{first}" or "{first}.{last}" or "{f}{last}"
  // Without a known contact name, we can't fill patterns that need names.
  // Return null — the candidate will be skipped with no_contact_email.
  // Pattern inference with a real name would require a different input
  // (e.g. from website scrape's team page). For v1, only Hunter's direct
  // matches populate contacts.
  if (pattern.includes("{first}") || pattern.includes("{f}")) {
    return null;
  }

  // Some rare patterns are just "info@" or "contact@"
  if (pattern === "info" || pattern === "contact" || pattern === "hello") {
    return `${pattern}@${domain}`;
  }

  return null;
}

