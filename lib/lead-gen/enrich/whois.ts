/**
 * WHOIS enrichment — domain age signal.
 *
 * Queries the RDAP (Registration Data Access Protocol) endpoint which is
 * the modern replacement for raw whois. RDAP is free, no API key needed,
 * and returns JSON. Falls back gracefully when the TLD registry doesn't
 * support RDAP or when the domain has privacy protection.
 *
 * Owner: LG-3. Consumer: enrichment orchestrator.
 */

import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "../types";

const RDAP_BOOTSTRAP_BASE = "https://rdap.org/domain";

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

interface RdapResponse {
  events?: RdapEvent[];
  errorCode?: number;
}

export interface WhoisResult {
  domain_age_years: number | null;
  registration_date: string | null;
  error?: string;
}

/**
 * Look up domain registration date via RDAP and compute age in years.
 *
 * @param domain Bare domain (no protocol, no path).
 * @returns Domain age in years (fractional) or null if unavailable.
 */
export async function fetchWhois(domain: string): Promise<WhoisResult> {
  const start = Date.now();

  try {
    const response = await fetch(`${RDAP_BOOTSTRAP_BASE}/${domain}`, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(10_000),
    });
    const duration = Date.now() - start;
    await logCall(duration);

    if (!response.ok) {
      return {
        domain_age_years: null,
        registration_date: null,
        error: `RDAP lookup error: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as RdapResponse;

    if (data.errorCode) {
      return {
        domain_age_years: null,
        registration_date: null,
        error: `RDAP error code: ${data.errorCode}`,
      };
    }

    const registrationEvent = data.events?.find(
      (e) => e.eventAction === "registration",
    );

    if (!registrationEvent?.eventDate) {
      return {
        domain_age_years: null,
        registration_date: null,
        error: "No registration date in RDAP response",
      };
    }

    const regDate = new Date(registrationEvent.eventDate);
    if (isNaN(regDate.getTime())) {
      return {
        domain_age_years: null,
        registration_date: null,
        error: `Invalid registration date: ${registrationEvent.eventDate}`,
      };
    }

    const ageMs = Date.now() - regDate.getTime();
    const ageYears = Math.round((ageMs / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10;

    return {
      domain_age_years: ageYears,
      registration_date: registrationEvent.eventDate,
    };
  } catch (err) {
    const duration = Date.now() - start;
    await logCall(duration);
    return {
      domain_age_years: null,
      registration_date: null,
      error: `WHOIS lookup failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Merge WHOIS result into a partial ViabilityProfile.
 */
export function applyWhoisToProfile(
  profile: Partial<ViabilityProfile>,
  result: WhoisResult,
): Partial<ViabilityProfile> {
  return {
    ...profile,
    website: {
      domain_age_years: result.domain_age_years,
      pagespeed_performance_score:
        profile.website?.pagespeed_performance_score ?? null,
      has_about_page: profile.website?.has_about_page ?? false,
      has_pricing_page: profile.website?.has_pricing_page ?? false,
      team_size_signal: profile.website?.team_size_signal ?? "unknown",
      stated_pricing_tier: profile.website?.stated_pricing_tier ?? "unknown",
    },
    fetch_errors: result.error
      ? { ...profile.fetch_errors, whois: result.error }
      : profile.fetch_errors,
  };
}

async function logCall(durationMs: number): Promise<void> {
  try {
    await db.insert(external_call_log).values({
      id: crypto.randomUUID(),
      job: "rdap.domain_lookup",
      actor_type: "internal",
      units: JSON.stringify({ lookups: 1 }),
      estimated_cost_aud: 0,
      created_at_ms: Date.now(),
    });
  } catch {
    // Best-effort logging
  }
}
