/**
 * Lead Generation — shared types.
 *
 * Owner: Lead Generation spec §5 (ViabilityProfile) + §3.1 (discovery).
 * Consumers: scoring, enrichment, discovery, daily search runner.
 */

// ── Viability Profile (spec §5) ─────────────────────────────────────────

/**
 * Structured JSON payload stored at `lead_candidates.viability_profile_json`.
 * Every field is optional — scorers tolerate missing values gracefully.
 */
export interface ViabilityProfile {
  // Advertising signals
  meta_ads?: {
    active_ad_count: number;
    estimated_spend_bracket: "unknown" | "low" | "medium" | "high";
    has_active_creatives: boolean;
  };
  google_ads?: {
    active_creative_count: number;
    has_active_campaigns: boolean;
  };

  // Web signals
  website?: {
    domain_age_years: number | null;
    pagespeed_performance_score: number | null; // 0..100
    has_about_page: boolean;
    has_pricing_page: boolean;
    team_size_signal: "solo" | "small" | "medium" | "large" | "unknown";
    stated_pricing_tier: "unknown" | "budget" | "mid" | "premium";
  };

  // Social signals
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

  // Google Maps signals
  maps?: {
    category: string;
    rating: number | null;
    review_count: number;
    photo_count: number;
    last_photo_date: string | null; // ISO date
  };

  // Deep enrichment signals (post-scoring, Apify-sourced)
  facebook?: {
    page_name: string | null;
    follower_count: number | null;
    posts_last_30d: number | null;
    last_post_date: string | null;
    has_active_page: boolean;
  };
  linkedin?: {
    company_name: string | null;
    employee_count_range: string | null;
    industry: string | null;
    follower_count: number | null;
    has_active_page: boolean;
  };
  tiktok?: {
    follower_count: number | null;
    video_count: number | null;
    posts_last_30d: number | null;
    last_post_date: string | null;
    has_active_profile: boolean;
  };
  website_content?: {
    services_offered: string[];
    unique_selling_points: string[];
    target_audience_signals: string[];
    business_maturity_signals: string[];
    content_quality: "poor" | "basic" | "good" | "excellent" | "unknown";
    distilled_brief: string | null;
  };
  deep_enrichment?: {
    ran_at_ms: number;
    actors_attempted: number;
    actors_succeeded: number;
    soft_adjustment: number;
    adjustment_reasons: string[];
  };

  // Per-source fetch status
  fetch_errors?: Record<string, string>;
}

// ── Discovery types ─────────────────────────────────────────────────────

/**
 * Raw candidate discovered by a source before enrichment or scoring.
 * The three discovery sources (Meta Ad Library, Google Maps, Google Ads
 * Transparency) all produce this shape.
 */
export interface DiscoveredCandidate {
  /** Business name as returned by the source. */
  company_name: string;

  /** Website domain (nullable — some Maps-sourced candidates have none). */
  domain: string | null;

  /** Which discovery source found this candidate. */
  source: "meta_ad_library" | "google_maps" | "google_ads_transparency" | "instagram_location";

  /**
   * Partial viability profile seeded by the discovery source.
   * Enrichment pipeline (LG-3) fills the remaining fields.
   */
  partial_profile: Partial<ViabilityProfile>;

  /** Source-specific raw data for debugging / audit. */
  raw_source_data?: Record<string, unknown>;
}

/**
 * Search parameters derived from Settings → Lead Generation → Daily Search.
 */
export interface DiscoverySearchParams {
  /** Location string (e.g. "Melbourne, Australia"). */
  location: string;

  /** Search radius in km (e.g. 25). */
  radius_km: number;

  /** Centre latitude for geo-anchored search (e.g. -37.8136). */
  location_lat: number;

  /** Centre longitude for geo-anchored search (e.g. 144.9631). */
  location_lng: number;

  /** ISO 3166-1 alpha-2 country code (e.g. "AU"). */
  country_code: string;

  /** Standing brief or manual brief override text. */
  brief: string;

  /** Target number of qualified candidates (pipeline over-fetches to hit this). */
  max_candidates: number;

  /**
   * @deprecated Kept for backward compat with existing verticals data.
   * New searches don't require a category — broad sweep is automatic.
   */
  category?: string;
}

/**
 * Per-source result from a discovery run.
 */
export interface SourceResult {
  source: DiscoveredCandidate["source"];
  candidates: DiscoveredCandidate[];
  error?: string;
  duration_ms: number;
}
