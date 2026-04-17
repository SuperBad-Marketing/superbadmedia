/**
 * Domain age enrichment — RDAP public lookup (free, no API key required).
 * Populates website.domain_age_years.
 * Uses rdap.org as a universal RDAP gateway.
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const RDAP_BASE = "https://rdap.org/domain";

export async function enrichDomainAge(
  domain: string | null,
): Promise<Partial<ViabilityProfile>> {
  if (!domain) return {};

  const startMs = Date.now();
  const rootDomain = stripSubdomain(domain);

  let years: number | null = null;
  let fetchError: string | undefined;

  try {
    const response = await fetch(`${RDAP_BASE}/${encodeURIComponent(rootDomain)}`);
    if (!response.ok) {
      fetchError = `RDAP HTTP ${response.status} for ${rootDomain}`;
    } else {
      const data = (await response.json()) as {
        events?: { eventAction: string; eventDate: string }[];
      };
      const regEvent = data.events?.find((e) => e.eventAction === "registration");
      if (regEvent?.eventDate) {
        const regDate = new Date(regEvent.eventDate);
        const ageMs = Date.now() - regDate.getTime();
        years = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25)));
      }
    }
  } catch (err) {
    fetchError = `RDAP fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "whois:domain_lookup",
    actor_type: "internal",
    units: JSON.stringify({ domain: rootDomain, duration_ms: Date.now() - startMs }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchError) return { fetch_errors: { domain_age: fetchError } };

  return {
    website: {
      domain_age_years: years,
      pagespeed_performance_score: null,
      has_about_page: false,
      has_pricing_page: false,
      team_size_signal: "unknown",
      stated_pricing_tier: "unknown",
    },
  };
}

function stripSubdomain(domain: string): string {
  const parts = domain.split(".");
  // Keep TLD + second-level (e.g. acme.com.au → acme.com.au, sub.acme.com → acme.com)
  // Australian 2nd-level TLDs: com.au, net.au, org.au etc.
  if (parts.length > 2 && parts[parts.length - 2] !== "com" &&
      parts[parts.length - 2] !== "net" && parts[parts.length - 2] !== "org") {
    // Could be a subdomain case — keep last 2 parts
    return parts.slice(-2).join(".");
  }
  if (parts.length > 3) {
    // sub.acme.com.au → acme.com.au
    return parts.slice(-3).join(".");
  }
  return domain;
}
