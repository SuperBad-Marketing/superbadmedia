/**
 * Hunter.io contact email discovery — the only Hunter API call path in
 * the platform. Resolves a domain to a contact email for outreach.
 *
 * Discovery order:
 *   1. Hunter.io Domain Search — prefer high-confidence contacts with preferred roles.
 *   2. If Hunter returns only low-confidence or no match — pattern inference
 *      from the best available name.
 *   3. If both fail — returns null (orchestrator sets skipped_reason = 'no_contact_email').
 *
 * Gated behind `lead_gen_enabled` kill-switch.
 * Logs every Hunter API call to `external_call_log`.
 *
 * Owner: LG-9. Consumer: orchestrator step 9.
 */

import { db as defaultDb } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { killSwitches } from "@/lib/kill-switches";

const HUNTER_API_BASE = "https://api.hunter.io/v2";
const HIGH_CONFIDENCE_THRESHOLD = 70;

const PREFERRED_ROLES = [
  "founder",
  "ceo",
  "owner",
  "marketing-manager",
  "marketing-director",
  "growth-lead",
];

export interface ContactDiscoveryResult {
  email: string;
  name?: string;
  role?: string;
  email_confidence: "verified" | "inferred";
}

interface HunterContact {
  value: string;
  confidence?: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
}

interface HunterDomainSearchResponse {
  data?: {
    emails?: HunterContact[];
  };
  errors?: Array<{ details: string }>;
}

function normalisedPosition(position: string | null | undefined): string {
  return (position ?? "").toLowerCase().replace(/\s+/g, "-");
}

function isPreferredRole(position: string | null | undefined): boolean {
  const norm = normalisedPosition(position);
  return PREFERRED_ROLES.some((role) => norm.includes(role));
}

function fullName(contact: HunterContact): string | undefined {
  const parts = [contact.first_name, contact.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function inferEmail(firstName: string, lastName: string | null | undefined, domain: string): string {
  // Spec: firstname@domain is the primary guess
  return `${firstName.toLowerCase()}@${domain}`;
}

/**
 * Discover a contact email for the given domain using Hunter.io with
 * pattern-inference fallback.
 *
 * Returns null if no contact can be resolved (both Hunter + inference fail).
 * The caller (orchestrator step 9) is responsible for setting skipped_reason.
 */
export async function discoverContactEmail(
  domain: string,
  dbInstance = defaultDb,
): Promise<ContactDiscoveryResult | null> {
  if (!killSwitches.lead_gen_enabled) return null;

  const apiKey = process.env.HUNTER_IO_API_KEY;
  if (!apiKey) return null;

  const startMs = Date.now();
  let contacts: HunterContact[] = [];
  let fetchError: string | undefined;

  try {
    const url = `${HUNTER_API_BASE}/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`;
    const res = await fetch(url);
    const data = (await res.json()) as HunterDomainSearchResponse;

    if (!res.ok || data.errors?.length) {
      fetchError = data.errors?.[0]?.details ?? `Hunter API error: ${res.status}`;
    } else {
      contacts = data.data?.emails ?? [];
    }
  } catch (err) {
    fetchError = `Hunter fetch error: ${String(err)}`;
  }

  await dbInstance.insert(external_call_log).values({
    id: crypto.randomUUID(),
    job: "hunter:domain-search",
    actor_type: "internal",
    units: JSON.stringify({ domain, duration_ms: Date.now() - startMs, error: fetchError }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (contacts.length === 0) return null;

  // Sort: preferred role first, then by confidence descending
  contacts.sort((a, b) => {
    const aPreferred = isPreferredRole(a.position) ? 1 : 0;
    const bPreferred = isPreferredRole(b.position) ? 1 : 0;
    if (aPreferred !== bPreferred) return bPreferred - aPreferred;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });

  const best = contacts[0];

  // High-confidence verified hit
  if ((best.confidence ?? 0) >= HIGH_CONFIDENCE_THRESHOLD) {
    return {
      email: best.value,
      name: fullName(best),
      role: normalisedPosition(best.position) || undefined,
      email_confidence: "verified",
    };
  }

  // Low-confidence: fall back to pattern inference if we have a first name
  const firstName = best.first_name;
  if (!firstName) return null;

  const inferredEmail = inferEmail(firstName, best.last_name, domain);
  return {
    email: inferredEmail,
    name: fullName(best),
    role: normalisedPosition(best.position) || undefined,
    email_confidence: "inferred",
  };
}
