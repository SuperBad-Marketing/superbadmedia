import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

// RDAP is the ICANN standard successor to WHOIS — free and key-free.
// rdap.org acts as a universal router to the correct RDAP server per TLD.
const RDAP_BASE = "https://rdap.org/domain";

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

interface RdapResponse {
  events?: RdapEvent[];
  errorCode?: number;
}

function yearsFromDate(isoDate: string): number {
  const created = new Date(isoDate);
  const now = new Date();
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  return Math.floor((now.getTime() - created.getTime()) / msPerYear);
}

/**
 * Enrich with domain age via RDAP (free, key-free ICANN protocol).
 * Logs to external_call_log (job: "whois:domain_lookup").
 *
 * @param domain - Normalised domain (e.g. "acme.com.au"). Null → returns {}.
 */
export async function enrichDomainAge(
  domain: string | null,
): Promise<Partial<ViabilityProfile>> {
  if (!domain) return {};

  const startMs = Date.now();
  let domainAgeYears: number | null = null;
  let fetchError: string | undefined;

  try {
    // Strip subdomains: RDAP expects the registerable domain.
    const registerable = domain.split(".").slice(-2).join(".");
    const response = await fetch(`${RDAP_BASE}/${registerable}`, {
      headers: { Accept: "application/rdap+json" },
      redirect: "follow",
    });

    if (!response.ok) {
      fetchError = `RDAP HTTP ${response.status} for ${registerable}`;
    } else {
      const data = (await response.json()) as RdapResponse;
      if (data.errorCode != null) {
        fetchError = `RDAP error ${data.errorCode} for ${registerable}`;
      } else {
        const registrationEvent = data.events?.find(
          (e) => e.eventAction === "registration",
        );
        if (registrationEvent?.eventDate) {
          domainAgeYears = yearsFromDate(registrationEvent.eventDate);
        }
      }
    }
  } catch (err) {
    fetchError = `RDAP fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "whois:domain_lookup",
    actor_type: "internal",
    units: JSON.stringify({ domain, duration_ms: Date.now() - startMs }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchError) {
    return { fetch_errors: { domain_age: fetchError } };
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
