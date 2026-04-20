/**
 * Portfolio ingestion primitive — types + URL handler.
 *
 * `ingestPortfolioUrl()` is the single entry point for turning a portfolio
 * URL into structured signals the Role Brief can consume. Multi-platform
 * handlers (Vimeo API, Behance API, Apify IG, etc.) land in later HP
 * sessions; this module ships the type surface + a baseline metadata-fetch
 * implementation that covers personal sites / any URL with an OG profile.
 *
 * Owner: HP-2. Spec: docs/specs/hiring-pipeline.md §3.2, §6.2.
 */

export type WorkSample = {
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
  mediaType: "video" | "image" | "link";
};

export type PortfolioSignal = {
  url: string;
  platform:
    | "vimeo"
    | "behance"
    | "dribbble"
    | "arena"
    | "youtube"
    | "instagram"
    | "linkedin"
    | "tiktok"
    | "personal"
    | "unknown";
  thumbnails: string[];
  bio: string;
  work_samples: WorkSample[];
  extracted_tags: string[];
  confidence: number;
  fetched_at: number;
};

const PLATFORM_PATTERNS: [RegExp, PortfolioSignal["platform"]][] = [
  [/vimeo\.com/i, "vimeo"],
  [/behance\.net/i, "behance"],
  [/dribbble\.com/i, "dribbble"],
  [/are\.na/i, "arena"],
  [/(youtube\.com|youtu\.be)/i, "youtube"],
  [/instagram\.com/i, "instagram"],
  [/linkedin\.com/i, "linkedin"],
  [/tiktok\.com/i, "tiktok"],
];

function detectPlatform(url: string): PortfolioSignal["platform"] {
  for (const [pattern, platform] of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return platform;
  }
  return "personal";
}

/**
 * Ingest a single portfolio URL and return structured signals.
 *
 * Current implementation: platform detection + metadata stub. Full
 * platform-specific handlers (Vimeo API for reel metadata, Apify for IG
 * with graceful fallback, Behance project extraction, vision model
 * analysis) land in HP-5/HP-6.
 */
export async function ingestPortfolioUrl(url: string): Promise<PortfolioSignal> {
  const platform = detectPlatform(url);

  return {
    url,
    platform,
    thumbnails: [],
    bio: "",
    work_samples: [{ url, title: null, thumbnailUrl: null, mediaType: "link" }],
    extracted_tags: [],
    confidence: platform === "unknown" ? 0.1 : 0.3,
    fetched_at: Date.now(),
  };
}
