/**
 * Portfolio ingestion primitive — types + multi-platform URL handlers.
 *
 * `ingestPortfolioUrl()` is the single entry point for turning a portfolio
 * URL into structured signals the Role Brief can consume.
 *
 * Platform handlers (HP-5):
 *   - Vimeo: oEmbed API (free, no key)
 *   - Behance: page fetch + OG metadata extraction
 *   - Generic web: page fetch + OG metadata extraction
 *   - Vision LLM: Sonnet vision on thumbnails → extracted_tags
 *
 * HP-6 additions: Apify IG on-demand handler with graceful fallback.
 *
 * Owner: HP-2 (types), HP-5 (handlers), HP-6 (IG Apify).
 * Spec: docs/specs/hiring-pipeline.md §3.2, §6.2, §15.
 */

import * as cheerio from "cheerio";
import { logExternalCall as centralLogExternalCall } from "@/lib/observatory";
import { invokeLlmVision } from "@/lib/ai/invoke";
import settings from "@/lib/settings";

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

export function detectPlatform(url: string): PortfolioSignal["platform"] {
  for (const [pattern, platform] of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return platform;
  }
  return "personal";
}

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 512_000;

// ---------------------------------------------------------------------------
// Instagram Apify handler (HP-6)
// ---------------------------------------------------------------------------

interface ApifyIgPost {
  displayUrl?: string;
  caption?: string;
  type?: string;
  url?: string;
}

interface ApifyIgResult {
  biography?: string;
  fullName?: string;
  profilePicUrl?: string;
  posts?: ApifyIgPost[];
  latestPosts?: ApifyIgPost[];
}

function extractIgHandle(url: string): string | null {
  const match = url.match(
    /instagram\.com\/([a-zA-Z0-9_.]+)\/?/,
  );
  return match?.[1] ?? null;
}

async function fetchInstagramSignal(
  url: string,
): Promise<Partial<PortfolioSignal>> {
  const enabled = await settings.get("hiring.discovery.ig_on_demand_enabled");
  if (!enabled) return { confidence: 0.2 };

  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) return { confidence: 0.2 };

  const handle = extractIgHandle(url);
  if (!handle) return { confidence: 0.3 };

  const start = Date.now();

  try {
    const runUrl =
      "https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items";
    const response = await fetch(`${runUrl}?token=${apiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [handle],
        resultsLimit: 12,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      await logExternalCall(
        "hiring-portfolio-ingest-ig",
        Date.now() - start,
        0.02,
      );
      return fetchOgSignal(url, "hiring-portfolio-ingest-generic");
    }

    const results = (await response.json()) as ApifyIgResult[];
    const profile = results[0];

    if (!profile) {
      await logExternalCall(
        "hiring-portfolio-ingest-ig",
        Date.now() - start,
        0.02,
      );
      return fetchOgSignal(url, "hiring-portfolio-ingest-generic");
    }

    await logExternalCall(
      "hiring-portfolio-ingest-ig",
      Date.now() - start,
      0.02,
      { posts_fetched: (profile.posts ?? profile.latestPosts ?? []).length },
    );

    const posts = profile.posts ?? profile.latestPosts ?? [];
    const thumbnails: string[] = [];
    const workSamples: WorkSample[] = [];

    for (const post of posts.slice(0, 12)) {
      if (post.displayUrl) {
        thumbnails.push(post.displayUrl);
        workSamples.push({
          url: post.url ?? url,
          title: post.caption?.slice(0, 80) ?? null,
          thumbnailUrl: post.displayUrl,
          mediaType: post.type === "Video" ? "video" : "image",
        });
      }
    }

    const bio = [profile.fullName, profile.biography]
      .filter(Boolean)
      .join(" — ");

    return {
      thumbnails: thumbnails.slice(0, 12),
      bio,
      work_samples: workSamples.slice(0, 12),
      confidence: thumbnails.length > 0 ? 0.65 : 0.4,
    };
  } catch {
    await logExternalCall(
      "hiring-portfolio-ingest-ig",
      Date.now() - start,
      0.02,
    );
    return fetchOgSignal(url, "hiring-portfolio-ingest-generic");
  }
}

// ---------------------------------------------------------------------------
// Vimeo oEmbed handler
// ---------------------------------------------------------------------------

interface VimeoOEmbedResponse {
  title?: string;
  description?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  duration?: number;
  video_id?: number;
}

async function fetchVimeoSignal(url: string): Promise<Partial<PortfolioSignal>> {
  const enabled = await settings.get("hiring.discovery.vimeo_enabled");
  if (!enabled) return { confidence: 0.2 };

  const start = Date.now();

  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      await logExternalCall("hiring-portfolio-ingest-vimeo", Date.now() - start, 0);
      return { confidence: 0.3 };
    }

    const data = (await response.json()) as VimeoOEmbedResponse;
    await logExternalCall("hiring-portfolio-ingest-vimeo", Date.now() - start, 0);

    const thumbnails: string[] = [];
    if (data.thumbnail_url) {
      thumbnails.push(data.thumbnail_url);
    }

    const workSamples: WorkSample[] = [
      {
        url,
        title: data.title ?? null,
        thumbnailUrl: data.thumbnail_url ?? null,
        mediaType: "video",
      },
    ];

    const bio = [data.author_name, data.description]
      .filter(Boolean)
      .join(" — ");

    return {
      thumbnails,
      bio,
      work_samples: workSamples,
      confidence: 0.7,
    };
  } catch {
    await logExternalCall("hiring-portfolio-ingest-vimeo", Date.now() - start, 0);
    return { confidence: 0.3 };
  }
}

// ---------------------------------------------------------------------------
// Behance OG metadata handler
// ---------------------------------------------------------------------------

async function fetchBehanceSignal(url: string): Promise<Partial<PortfolioSignal>> {
  const enabled = await settings.get("hiring.discovery.behance_enabled");
  if (!enabled) return { confidence: 0.2 };

  return fetchOgSignal(url, "hiring-portfolio-ingest-behance");
}

// ---------------------------------------------------------------------------
// Generic web OG metadata handler
// ---------------------------------------------------------------------------

async function fetchOgSignal(
  url: string,
  job: string,
): Promise<Partial<PortfolioSignal>> {
  const start = Date.now();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SuperBadBot/1.0; +https://superbadmedia.com.au)",
      },
    });

    if (!response.ok) {
      await logExternalCall(job, Date.now() - start, 0);
      return { confidence: 0.3 };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      await logExternalCall(job, Date.now() - start, 0);
      return { confidence: 0.2 };
    }

    const buffer = await response.arrayBuffer();
    const html = new TextDecoder().decode(buffer.slice(0, MAX_BODY_BYTES));
    const $ = cheerio.load(html);

    const ogTitle =
      $('meta[property="og:title"]').attr("content") ??
      $("title").text() ??
      null;
    const ogDescription =
      $('meta[property="og:description"]').attr("content") ??
      $('meta[name="description"]').attr("content") ??
      null;
    const ogImage = $('meta[property="og:image"]').attr("content") ?? null;

    const thumbnails: string[] = [];
    if (ogImage) thumbnails.push(ogImage);

    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr("content");
      if (src && !thumbnails.includes(src)) thumbnails.push(src);
    });

    const workSamples: WorkSample[] = [
      {
        url,
        title: ogTitle,
        thumbnailUrl: ogImage,
        mediaType: ogImage ? "image" : "link",
      },
    ];

    const bio = [ogTitle, ogDescription].filter(Boolean).join(" — ");

    await logExternalCall(job, Date.now() - start, 0);

    return {
      thumbnails: thumbnails.slice(0, 10),
      bio,
      work_samples: workSamples,
      confidence: thumbnails.length > 0 ? 0.6 : 0.4,
    };
  } catch {
    await logExternalCall(job, Date.now() - start, 0);
    return { confidence: 0.3 };
  }
}

// ---------------------------------------------------------------------------
// Vision LLM analysis — extract style tags from thumbnails
// ---------------------------------------------------------------------------

async function analyzePortfolioVision(
  thumbnails: string[],
  platform: PortfolioSignal["platform"],
  bio: string,
): Promise<string[]> {
  if (thumbnails.length === 0) return [];

  const imageUrls = thumbnails.slice(0, 4);
  const start = Date.now();

  try {
    const result = await invokeLlmVision({
      job: "hiring-portfolio-ingest-vision",
      prompt: [
        `Analyse these portfolio images from a ${platform} profile.`,
        bio ? `Bio/context: "${bio}"` : "",
        "",
        "Extract 5–15 style tags that describe the visual style, technique,",
        "subject matter, and production quality. Tags should be lowercase,",
        "hyphenated where multi-word (e.g. \"handheld-documentary\",",
        "\"food-photography\", \"warm-tones\", \"motion-graphics\").",
        "",
        "Return ONLY a JSON array of strings, no other text.",
        "Example: [\"food-photography\",\"warm-tones\",\"natural-light\"]",
      ]
        .filter((l) => l !== "")
        .join("\n"),
      imageUrls,
      maxTokens: 300,
    });

    try {
      const cleaned = result.text.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((t): t is string => typeof t === "string")
          .slice(0, 20);
      }
    } catch {
      // LLM returned non-JSON — extract comma-separated tags as fallback
    }

    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function ingestPortfolioUrl(
  url: string,
): Promise<PortfolioSignal> {
  const platform = detectPlatform(url);

  const base: PortfolioSignal = {
    url,
    platform,
    thumbnails: [],
    bio: "",
    work_samples: [{ url, title: null, thumbnailUrl: null, mediaType: "link" }],
    extracted_tags: [],
    confidence: platform === "unknown" ? 0.1 : 0.3,
    fetched_at: Date.now(),
  };

  let partial: Partial<PortfolioSignal> = {};

  switch (platform) {
    case "vimeo":
      partial = await fetchVimeoSignal(url);
      break;
    case "behance":
      partial = await fetchBehanceSignal(url);
      break;
    case "instagram":
      partial = await fetchInstagramSignal(url);
      break;
    case "dribbble":
    case "arena":
    case "youtube":
    case "linkedin":
    case "tiktok":
    case "personal":
      partial = await fetchOgSignal(url, "hiring-portfolio-ingest-generic");
      break;
    case "unknown":
      partial = await fetchOgSignal(url, "hiring-portfolio-ingest-generic");
      break;
    default:
      break;
  }

  const merged: PortfolioSignal = {
    ...base,
    thumbnails: partial.thumbnails ?? base.thumbnails,
    bio: partial.bio ?? base.bio,
    work_samples: partial.work_samples ?? base.work_samples,
    confidence: partial.confidence ?? base.confidence,
    fetched_at: Date.now(),
    extracted_tags: [],
  };

  if (merged.thumbnails.length > 0) {
    merged.extracted_tags = await analyzePortfolioVision(
      merged.thumbnails,
      platform,
      merged.bio,
    );
    if (merged.extracted_tags.length > 0 && merged.confidence < 0.8) {
      merged.confidence = Math.min(merged.confidence + 0.15, 0.85);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// External call logging (best-effort, delegates to observatory)
// ---------------------------------------------------------------------------

async function logExternalCall(
  job: string,
  durationMs: number,
  estimatedCostAud: number,
  units?: Record<string, number>,
): Promise<void> {
  centralLogExternalCall({
    job,
    actorType: "internal",
    units: { duration_ms: durationMs, ...units },
    estimatedCostAud,
  }).catch(() => {});
}
