/**
 * Domain age enrichment adapter.
 *
 * Uses the RDAP (Registration Data Access Protocol) bootstrap service to
 * fetch domain registration date without requiring an API key.
 * Logs to external_call_log (job: "whois:domain_lookup").
 *
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const RDAP_BOOTSTRAP = "https://rdap.org/domain";

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

interface RdapResponse {
  events?: RdapEvent[];
}

function computeAgeYears(registrationDate: string): number | null {
  try {
    const reg = new Date(registrationDate);
    if (isNaN(reg.getTime())) return null;
    const now = new Date();
    let years = now.getFullYear() - reg.getFullYear();
    const monthDiff = now.getMonth() - reg.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < reg.getDate())) {
      years--;
    }
    return years >= 0 ? years : null;
  } catch {
    return null;
  }
}

/**
 * Enrich a candidate with domain age derived from WHOIS/RDAP registration date.
 *
 * @param domain - Normalised domain (e.g. "acme.com.au"). Null returns {}.
 */
export async function enrichDomainAge(
  domain: string | null,
): Promise<Partial<ViabilityProfile>> {
  if (!domain) return {};

  const startMs = Date.now();
  let domainAgeYears: number | null = null;
  let fetchErrorMsg: string | undefined;

  try {
    const response = await fetch(`${RDAP_BOOTSTRAP}/${encodeURIComponent(domain)}`);

    if (!response.ok) {
      fetchErrorMsg = `RDAP HTTP ${response.status}`;
    } else {
      const data = (await response.json()) as RdapResponse;
      const regEvent = data.events?.find(
        (e) => e.eventAction === "registration",
      );
      if (regEvent?.eventDate) {
        domainAgeYears = computeAgeYears(regEvent.eventDate);
      }
    }
  } catch (err) {
    fetchErrorMsg = `RDAP fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "whois:domain_lookup",
    actor_type: "internal",
    units: JSON.stringify({
      domain,
      duration_ms: Date.now() - startMs,
      ...(fetchErrorMsg ? { error: fetchErrorMsg } : {}),
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchErrorMsg) {
    return { fetch_errors: { domain_age: fetchErrorMsg } };
  }

  return {
    website: {
      domain_age_years: domainAgeYears,
      pagespeed_performance_score: null,
      has_about_page: false,
      has_pricing_page: false,
      team_size_signal: "unknown",
      stated_pricing_tier: "unknown",
    },
  };
}
