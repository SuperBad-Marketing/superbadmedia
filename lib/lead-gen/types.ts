/**
 * Lead Generation — core types shared across all LG sessions.
 *
 * ViabilityProfile: structured signal payload stored as JSON on lead_candidates.
 * All fields optional — scorers and enrichment degrade gracefully on missing data.
 *
 * Owner: LG-2. Consumers: LG-3 (enrichment), LG-4 (orchestrator), LG-5 (scoring),
 * LG-6 (draft generator).
 */

export interface ViabilityProfile {
  meta_ads?: {
    active_ad_count: number;
    estimated_spend_bracket: "unknown" | "low" | "medium" | "high";
    has_active_creatives: boolean;
  };
  google_ads?: {
    active_creative_count: number;
    has_active_campaigns: boolean;
  };
  website?: {
    domain_age_years: number | null;
    pagespeed_performance_score: number | null;
    has_about_page: boolean;
    has_pricing_page: boolean;
    team_size_signal: "solo" | "small" | "medium" | "large" | "unknown";
    stated_pricing_tier: "unknown" | "budget" | "mid" | "premium";
  };
  instagram?: {
    follower_count: number;
    post_count: number;
    posts_last_30d: number | null;
  };
  youtube?: {
    subscriber_count: number;
    video_count: number;
    uploads_last_90d: number | null;
  };
  maps?: {
    category: string;
    rating: number | null;
    review_count: number;
    photo_count: number;
    last_photo_date: string | null;
  };
  /** Keyed by signal name — records per-source fetch failures. */
  fetch_errors?: Record<string, string>;
}

/**
 * Search input parameters passed to every discovery source adapter.
 * Adapters do not call settings.get() directly — the orchestrator resolves
 * settings and passes them in, keeping adapters pure and testable.
 */
export interface DiscoverySearchInput {
  /** e.g. "Melbourne, Australia" */
  locationCentre: string;
  /** Radius in km — used as a hint for sources that support geo-radius. */
  locationRadiusKm: number;
  /** Free-text category e.g. "cafes", "dental clinics". May be empty string. */
  category: string;
  /**
   * Max candidates to return per source. Actual count may be lower
   * if the API returns fewer results or dedup reduces the set.
   */
  maxResults: number;
}

/**
 * A business candidate returned by a discovery source adapter.
 * Partial ViabilityProfile fields are already populated from the same
 * API call that discovered the candidate.
 */
export interface DiscoveryCandidate {
  businessName: string;
  /** Normalised domain without protocol or trailing slash, e.g. "acme.com.au" */
  domain: string | null;
  /** Raw location string as returned by the source. */
  location: string | null;
  phone: string | null;
  /** Which source produced this candidate. */
  source: "meta_ad_library" | "google_maps" | "google_ads_transparency";
  /**
   * ViabilityProfile fields already populated by the discovery call.
   * The orchestrator merges multiple sources' partial profiles.
   */
  partialProfile: Partial<ViabilityProfile>;
}

/**
 * Aggregated result from a single source adapter call.
 * On error, candidates is [] and fetchError is set.
 */
export interface DiscoveryResult {
  source: DiscoveryCandidate["source"];
  candidates: DiscoveryCandidate[];
  /** Set on any fetch / parse failure — stored in lead_runs.error + ViabilityProfile.fetch_errors */
  fetchError?: string;
}
