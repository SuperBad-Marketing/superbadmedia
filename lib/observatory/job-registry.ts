/**
 * Unified job band registry — per-job cost thresholds for the Observatory's
 * anomaly detectors. Every external-call job (LLM + vendor API) is declared
 * here. A job without bands fails type-check. Adding a new job is a code
 * change, not a runtime operation.
 *
 * Spec: `docs/specs/cost-usage-observatory.md` §4.2.
 * Owner: COB-2 (Wave 21). Consumers: COB-4..COB-6 (detectors), COB-7 (band editor).
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { band_overrides } from "@/lib/db/schema/band-overrides";
import { MODELS, type ModelJobSlug, type ModelTier } from "@/lib/ai/models";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobBands {
  per_call_ceiling_aud: number;
  daily_ceiling_aud: number;
  learned_band_multiplier: number;
  rate_override: number | null;
}

export type Vendor =
  | "anthropic"
  | "stripe"
  | "resend"
  | "graph"
  | "serpapi"
  | "meta"
  | "google"
  | "hunter"
  | "rdap"
  | "openai"
  | "remotion"
  | "cloudinary"
  | "twilio"
  | "weather"
  | "other";

export interface JobRegistryEntry {
  vendor: Vendor;
  bands: JobBands;
  description: string;
  jobDisabledUntil: number | null;
}

// ---------------------------------------------------------------------------
// Tier-based band defaults for LLM jobs
// ---------------------------------------------------------------------------

const LLM_BAND_DEFAULTS: Record<ModelTier, JobBands> = {
  opus: {
    per_call_ceiling_aud: 1.5,
    daily_ceiling_aud: 75,
    learned_band_multiplier: 3,
    rate_override: null,
  },
  sonnet: {
    per_call_ceiling_aud: 0.25,
    daily_ceiling_aud: 25,
    learned_band_multiplier: 3,
    rate_override: null,
  },
  haiku: {
    per_call_ceiling_aud: 0.05,
    daily_ceiling_aud: 10,
    learned_band_multiplier: 3,
    rate_override: null,
  },
};

// Heavy-context Opus jobs that routinely ingest large prompts
const HEAVY_OPUS_OVERRIDES: Partial<Record<ModelJobSlug, Partial<JobBands>>> = {
  "cockpit-brief": { per_call_ceiling_aud: 5.0, daily_ceiling_aud: 150 },
  "observatory-diagnose-cost-anomaly": { per_call_ceiling_aud: 3.0, daily_ceiling_aud: 50 },
  "brand-dna-generate-prose-portrait": { per_call_ceiling_aud: 3.0, daily_ceiling_aud: 50 },
  "brand-dna-generate-company-blend": { per_call_ceiling_aud: 3.0, daily_ceiling_aud: 50 },
  "six-week-plan-strategy": { per_call_ceiling_aud: 5.0, daily_ceiling_aud: 100 },
  "six-week-plan-weeks": { per_call_ceiling_aud: 5.0, daily_ceiling_aud: 100 },
  "content-generate-blog-post": { per_call_ceiling_aud: 3.0, daily_ceiling_aud: 100 },
  "quote-builder-draft-from-context": { per_call_ceiling_aud: 3.0, daily_ceiling_aud: 75 },
  "intro-funnel-reflection-synthesis": { per_call_ceiling_aud: 3.0, daily_ceiling_aud: 50 },
  "observatory-draft-negative-margin-email": { per_call_ceiling_aud: 3.0, daily_ceiling_aud: 30 },
  "client-mgmt-chat-response": { per_call_ceiling_aud: 3.0, daily_ceiling_aud: 100 },
  "observatory-draft-weekly-digest": { per_call_ceiling_aud: 0.1, daily_ceiling_aud: 5 },
};

// High-volume Haiku classifiers — higher daily ceiling
const HIGH_VOLUME_HAIKU_OVERRIDES: Partial<Record<ModelJobSlug, Partial<JobBands>>> = {
  "inbox-classify-inbound-route": { daily_ceiling_aud: 25 },
  "inbox-classify-notification-priority": { daily_ceiling_aud: 25 },
  "inbox-classify-signal-noise": { daily_ceiling_aud: 25 },
  "inbox-classify-support-ticket-type": { daily_ceiling_aud: 25 },
  "content-score-keyword-rankability": { daily_ceiling_aud: 25 },
  "content-match-content-to-prospects": { daily_ceiling_aud: 25 },
  "hiring-candidate-score": { daily_ceiling_aud: 25 },
  "hiring-reply-classify": { daily_ceiling_aud: 25 },
  "drift-check-grader": { daily_ceiling_aud: 25 },
};

// ---------------------------------------------------------------------------
// LLM job entries — derived from models.ts tier mapping
// ---------------------------------------------------------------------------

function buildLlmEntries(): Record<string, JobRegistryEntry> {
  const entries: Record<string, JobRegistryEntry> = {};
  for (const [slug, tier] of Object.entries(MODELS) as [ModelJobSlug, ModelTier][]) {
    const defaults = LLM_BAND_DEFAULTS[tier];
    const heavyOverride = HEAVY_OPUS_OVERRIDES[slug];
    const volumeOverride = HIGH_VOLUME_HAIKU_OVERRIDES[slug];
    const override = heavyOverride ?? volumeOverride;

    entries[slug] = {
      vendor: "anthropic",
      bands: override ? { ...defaults, ...override } : { ...defaults },
      description: slugToDescription(slug),
      jobDisabledUntil: null,
    };
  }
  return entries;
}

function slugToDescription(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Non-LLM vendor job entries
// ---------------------------------------------------------------------------

const NON_LLM_ENTRIES: Record<string, JobRegistryEntry> = {
  // SerpAPI — paid per search
  "serpapi.google_maps": {
    vendor: "serpapi",
    bands: { per_call_ceiling_aud: 0.1, daily_ceiling_aud: 15, learned_band_multiplier: 3, rate_override: null },
    description: "SerpAPI Google Maps local results search",
    jobDisabledUntil: null,
  },
  "serpapi.google_maps_photos": {
    vendor: "serpapi",
    bands: { per_call_ceiling_aud: 0.1, daily_ceiling_aud: 15, learned_band_multiplier: 3, rate_override: null },
    description: "SerpAPI Google Maps photos search",
    jobDisabledUntil: null,
  },
  "serpapi.google_ads_transparency": {
    vendor: "serpapi",
    bands: { per_call_ceiling_aud: 0.1, daily_ceiling_aud: 15, learned_band_multiplier: 3, rate_override: null },
    description: "SerpAPI Google Ads Transparency Center search",
    jobDisabledUntil: null,
  },

  // Hunter — paid per domain search
  "hunter.domain_search": {
    vendor: "hunter",
    bands: { per_call_ceiling_aud: 0.1, daily_ceiling_aud: 10, learned_band_multiplier: 3, rate_override: null },
    description: "Hunter.io domain contact search",
    jobDisabledUntil: null,
  },

  // Apify — paid per actor run
  "apify.email_finder": {
    vendor: "other",
    bands: { per_call_ceiling_aud: 0.1, daily_ceiling_aud: 15, learned_band_multiplier: 3, rate_override: null },
    description: "Apify contact info scraper for email discovery",
    jobDisabledUntil: null,
  },

  // Meta — free API, rate-limited
  "meta.ad_library.search": {
    vendor: "meta",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Meta Ad Library search",
    jobDisabledUntil: null,
  },
  "meta.instagram_business_discovery": {
    vendor: "meta",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Meta Instagram business discovery endpoint",
    jobDisabledUntil: null,
  },

  // Google — free tier APIs
  "google.youtube.data_api": {
    vendor: "google",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "YouTube Data API channel/video lookup",
    jobDisabledUntil: null,
  },
  "google.pagespeed.run": {
    vendor: "google",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Google PageSpeed Insights run",
    jobDisabledUntil: null,
  },

  // RDAP — free
  "rdap.domain_lookup": {
    vendor: "rdap",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "RDAP domain WHOIS lookup",
    jobDisabledUntil: null,
  },

  // Website scrape — free (our own fetch)
  "website.scrape": {
    vendor: "other",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Website HTML scrape for enrichment",
    jobDisabledUntil: null,
  },

  // Hiring portfolio — free oEmbed/scrape endpoints
  "hiring-portfolio-ingest-ig": {
    vendor: "meta",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Instagram profile scrape for hiring portfolio",
    jobDisabledUntil: null,
  },
  "hiring-portfolio-ingest-vimeo": {
    vendor: "other",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Vimeo oEmbed lookup for hiring portfolio",
    jobDisabledUntil: null,
  },
  "hiring-portfolio-ingest-behance": {
    vendor: "other",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Behance OG metadata scrape for hiring portfolio",
    jobDisabledUntil: null,
  },
  "hiring-portfolio-ingest-generic": {
    vendor: "other",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Generic web OG metadata scrape for hiring portfolio",
    jobDisabledUntil: null,
  },

  // Hiring discovery — free scrape endpoints
  "hiring-discovery-behance-gallery": {
    vendor: "other",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Behance gallery scrape for hiring discovery",
    jobDisabledUntil: null,
  },
  "hiring-discovery-vimeo-rss": {
    vendor: "other",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Vimeo Staff Picks RSS feed for hiring discovery",
    jobDisabledUntil: null,
  },

  // Weather API — free tier
  "sd-melbourne-weather": {
    vendor: "weather",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Melbourne weather check for S&D eggs",
    jobDisabledUntil: null,
  },

  // Stripe — paid per API call (bundled in fees but tracked)
  "stripe-balance-read": {
    vendor: "stripe",
    bands: { per_call_ceiling_aud: 0.02, daily_ceiling_aud: 5, learned_band_multiplier: 3, rate_override: null },
    description: "Stripe balance retrieval",
    jobDisabledUntil: null,
  },
  "stripe-balance-transactions-read": {
    vendor: "stripe",
    bands: { per_call_ceiling_aud: 0.02, daily_ceiling_aud: 5, learned_band_multiplier: 3, rate_override: null },
    description: "Stripe balance transactions list",
    jobDisabledUntil: null,
  },

  // Resend — paid per email
  "resend-send": {
    vendor: "resend",
    bands: { per_call_ceiling_aud: 0.02, daily_ceiling_aud: 5, learned_band_multiplier: 3, rate_override: null },
    description: "Resend transactional email send",
    jobDisabledUntil: null,
  },
  "resend-inbound-parse": {
    vendor: "resend",
    bands: { per_call_ceiling_aud: 0.02, daily_ceiling_aud: 5, learned_band_multiplier: 3, rate_override: null },
    description: "Resend inbound email parse webhook",
    jobDisabledUntil: null,
  },

  // Microsoft Graph — free with O365 subscription
  "graph-mail-read": {
    vendor: "graph",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Microsoft Graph mail read",
    jobDisabledUntil: null,
  },
  "graph-mail-send": {
    vendor: "graph",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Microsoft Graph mail send",
    jobDisabledUntil: null,
  },
  "graph-subscription-renew": {
    vendor: "graph",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Microsoft Graph subscription renewal",
    jobDisabledUntil: null,
  },
  "graph-mail-trash": {
    vendor: "graph",
    bands: { per_call_ceiling_aud: 0, daily_ceiling_aud: 0, learned_band_multiplier: 3, rate_override: null },
    description: "Microsoft Graph mail move to trash",
    jobDisabledUntil: null,
  },
};

// ---------------------------------------------------------------------------
// The unified registry — frozen at module load
// ---------------------------------------------------------------------------

export const JOB_REGISTRY: Readonly<Record<string, JobRegistryEntry>> = Object.freeze({
  ...buildLlmEntries(),
  ...NON_LLM_ENTRIES,
});

export const REGISTERED_JOB_KEYS: readonly string[] = Object.freeze(
  Object.keys(JOB_REGISTRY),
);

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getJobEntry(job: string): JobRegistryEntry | undefined {
  return JOB_REGISTRY[job];
}

export function getJobBands(job: string): JobBands | undefined {
  return JOB_REGISTRY[job]?.bands;
}

export function isJobRegistered(job: string): boolean {
  return job in JOB_REGISTRY;
}

export function getJobVendor(job: string): Vendor | undefined {
  return JOB_REGISTRY[job]?.vendor;
}

export function getJobDisabledUntil(job: string): number | null {
  return JOB_REGISTRY[job]?.jobDisabledUntil ?? null;
}

export function getRegisteredJobsByVendor(vendor: Vendor): string[] {
  return REGISTERED_JOB_KEYS.filter((k) => JOB_REGISTRY[k]!.vendor === vendor);
}

/**
 * Returns effective bands for a job — registry defaults merged with any
 * runtime overrides from `band_overrides`. Override fields that are null
 * fall through to the registry default.
 */
export async function getEffectiveBands(job: string): Promise<JobBands | undefined> {
  const entry = JOB_REGISTRY[job];
  if (!entry) return undefined;

  const rows = await db
    .select()
    .from(band_overrides)
    .where(eq(band_overrides.job, job))
    .limit(1);

  if (rows.length === 0) return { ...entry.bands };

  const override = rows[0];
  return {
    per_call_ceiling_aud: override.per_call_ceiling_aud ?? entry.bands.per_call_ceiling_aud,
    daily_ceiling_aud: override.daily_ceiling_aud ?? entry.bands.daily_ceiling_aud,
    learned_band_multiplier: override.learned_band_multiplier ?? entry.bands.learned_band_multiplier,
    rate_override: entry.bands.rate_override,
  };
}
