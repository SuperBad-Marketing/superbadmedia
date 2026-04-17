import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

const mockInsert = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: mockInsert,
    })),
  },
}));

vi.mock("@/lib/db/schema/external-call-log", () => ({
  external_call_log: {},
}));

vi.mock("@/lib/integrations/vendors/serpapi", () => ({
  SERPAPI_API_BASE: "https://serpapi.com",
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Imports (after mocks) ───────────────────────────────────────────

import { enrichPageSpeed } from "@/lib/lead-gen/enrichment/pagespeed";
import { enrichDomainAge } from "@/lib/lead-gen/enrichment/domain-age";
import { enrichInstagram } from "@/lib/lead-gen/enrichment/instagram";
import { enrichYouTube } from "@/lib/lead-gen/enrichment/youtube";
import { enrichWebsiteScrape } from "@/lib/lead-gen/enrichment/website-scrape";
import { enrichMapsPhotos } from "@/lib/lead-gen/enrichment/maps-photos";
import { mergeProfiles } from "@/lib/lead-gen/enrichment/index";

// ── Helpers ─────────────────────────────────────────────────────────

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errRes(status = 500): Response {
  return new Response("error", { status });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue(undefined);
});

// ── PageSpeed ────────────────────────────────────────────────────────

describe("enrichPageSpeed", () => {
  it("returns website.pagespeed_performance_score on success", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonRes({
        lighthouseResult: { categories: { performance: { score: 0.85 } } },
      }),
    );
    const result = await enrichPageSpeed("acme.com", "Acme");
    expect(result.website?.pagespeed_performance_score).toBe(85);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns {} on null domain", async () => {
    const result = await enrichPageSpeed(null, "Acme");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce(errRes(429));
    const result = await enrichPageSpeed("acme.com", "Acme");
    expect(result.fetch_errors?.pagespeed).toMatch(/429/);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns fetch_errors on API error field", async () => {
    mockFetch.mockResolvedValueOnce(jsonRes({ error: { message: "quota exceeded" } }));
    const result = await enrichPageSpeed("acme.com", "Acme");
    expect(result.fetch_errors?.pagespeed).toMatch(/quota exceeded/);
  });

  it("returns fetch_errors on network failure (no throw)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await enrichPageSpeed("acme.com", "Acme");
    expect(result.fetch_errors?.pagespeed).toMatch(/ECONNREFUSED/);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("handles missing performance score gracefully", async () => {
    mockFetch.mockResolvedValueOnce(jsonRes({ lighthouseResult: {} }));
    const result = await enrichPageSpeed("acme.com", "Acme");
    expect(result.website?.pagespeed_performance_score).toBeNull();
  });
});

// ── Domain Age ────────────────────────────────────────────────────────

describe("enrichDomainAge", () => {
  const regDate = new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000).toISOString();

  it("returns website.domain_age_years on success", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonRes({
        events: [
          { eventAction: "registration", eventDate: regDate },
          { eventAction: "expiration", eventDate: "2030-01-01T00:00:00Z" },
        ],
      }),
    );
    const result = await enrichDomainAge("acme.com");
    expect(result.website?.domain_age_years).toBe(5);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns {} on null domain", async () => {
    const result = await enrichDomainAge(null);
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce(errRes(404));
    const result = await enrichDomainAge("acme.com");
    expect(result.fetch_errors?.domain_age).toMatch(/404/);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns fetch_errors on network failure (no throw)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await enrichDomainAge("acme.com");
    expect(result.fetch_errors?.domain_age).toMatch(/timeout/);
  });

  it("returns domain_age_years null when no registration event", async () => {
    mockFetch.mockResolvedValueOnce(jsonRes({ events: [] }));
    const result = await enrichDomainAge("acme.com");
    expect(result.website?.domain_age_years).toBeNull();
  });
});

// ── Instagram ────────────────────────────────────────────────────────

describe("enrichInstagram", () => {
  it("returns instagram profile on success", async () => {
    // First fetch: homepage to extract instagram handle
    mockFetch.mockResolvedValueOnce(
      new Response(
        `<html><body><a href="https://instagram.com/acmebrand">Follow us</a></body></html>`,
        { status: 200 },
      ),
    );
    // Second fetch: Graph API
    mockFetch.mockResolvedValueOnce(
      jsonRes({ followers_count: 1500, media_count: 80 }),
    );
    const result = await enrichInstagram("acme.com", "Acme", "token123");
    expect(result.instagram?.follower_count).toBe(1500);
    expect(result.instagram?.post_count).toBe(80);
    expect(result.instagram?.posts_last_30d).toBeNull();
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns {} when no instagram link found on homepage", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("<html><body>No social links</body></html>", { status: 200 }),
    );
    const result = await enrichInstagram("acme.com", "Acme", "token123");
    expect(result).toEqual({});
  });

  it("returns {} on null domain", async () => {
    const result = await enrichInstagram(null, "Acme", "token123");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns {} with empty apiKey (no throw)", async () => {
    const result = await enrichInstagram("acme.com", "Acme", "");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on Graph API error (no throw)", async () => {
    // Homepage with instagram link
    mockFetch.mockResolvedValueOnce(
      new Response(
        `<html><body><a href="https://instagram.com/acmebrand">IG</a></body></html>`,
        { status: 200 },
      ),
    );
    // Graph API error
    mockFetch.mockResolvedValueOnce(errRes(403));
    const result = await enrichInstagram("acme.com", "Acme", "token123");
    expect(result.fetch_errors?.instagram).toMatch(/403/);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns {} on network failure fetching homepage (no throw)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await enrichInstagram("acme.com", "Acme", "token123");
    expect(result).toEqual({});
  });
});

// ── YouTube ────────────────────────────────────────────────────────

describe("enrichYouTube", () => {
  it("returns youtube profile on success", async () => {
    // Search call
    mockFetch.mockResolvedValueOnce(
      jsonRes({ items: [{ id: { channelId: "UC123" } }] }),
    );
    // Channel stats call
    mockFetch.mockResolvedValueOnce(
      jsonRes({
        items: [{
          statistics: { subscriberCount: "5000", videoCount: "120" },
          contentDetails: { relatedPlaylists: { uploads: "UU123" } },
        }],
      }),
    );
    // Playlist items call (recent uploads)
    const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    mockFetch.mockResolvedValueOnce(
      jsonRes({ items: [
        { contentDetails: { videoPublishedAt: recentDate } },
        { contentDetails: { videoPublishedAt: recentDate } },
      ] }),
    );

    const result = await enrichYouTube("Acme Corp", "apikey123");
    expect(result.youtube?.subscriber_count).toBe(5000);
    expect(result.youtube?.video_count).toBe(120);
    expect(result.youtube?.uploads_last_90d).toBe(2);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns {} when no channel found (no throw)", async () => {
    mockFetch.mockResolvedValueOnce(jsonRes({ items: [] }));
    const result = await enrichYouTube("UnknownBiz", "apikey123");
    expect(result).toEqual({});
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns {} with empty businessName (no throw)", async () => {
    const result = await enrichYouTube("", "apikey123");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns {} with empty apiKey (no throw)", async () => {
    const result = await enrichYouTube("Acme Corp", "");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error (no throw)", async () => {
    mockFetch.mockResolvedValueOnce(jsonRes({ items: [{ id: { channelId: "UC123" } }] }));
    mockFetch.mockResolvedValueOnce(errRes(503));
    const result = await enrichYouTube("Acme Corp", "apikey123");
    expect(result.fetch_errors?.youtube).toMatch(/503/);
  });

  it("returns fetch_errors on network failure (no throw)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ETIMEDOUT"));
    const result = await enrichYouTube("Acme Corp", "apikey123");
    expect(result.fetch_errors?.youtube).toMatch(/ETIMEDOUT/);
  });
});

// ── Website Scrape ────────────────────────────────────────────────────

describe("enrichWebsiteScrape", () => {
  it("returns has_about_page and has_pricing_page on success", async () => {
    const html = `
      <html><body>
        <a href="/about">About Us</a>
        <a href="/pricing">Pricing</a>
      </body></html>`;
    // Four fetches: root, /about, /team, /pricing
    mockFetch.mockResolvedValueOnce(new Response(html, { status: 200 }));
    mockFetch.mockResolvedValueOnce(new Response("<html>About page</html>", { status: 200 }));
    mockFetch.mockResolvedValueOnce(new Response("", { status: 404 }));
    mockFetch.mockResolvedValueOnce(new Response("<html>Pricing page</html>", { status: 200 }));

    const result = await enrichWebsiteScrape("acme.com");
    expect(result.website?.has_about_page).toBe(true);
    expect(result.website?.has_pricing_page).toBe(true);
  });

  it("returns team_size_signal from HTML signals", async () => {
    const html = `<html><body><p>We are a small team of dedicated professionals</p></body></html>`;
    mockFetch.mockResolvedValue(new Response(html, { status: 200 }));
    const result = await enrichWebsiteScrape("acme.com");
    expect(result.website?.team_size_signal).toBe("small");
  });

  it("returns stated_pricing_tier from HTML signals", async () => {
    const html = `<html><body><p>Get started for just $99/month</p></body></html>`;
    mockFetch.mockResolvedValue(new Response(html, { status: 200 }));
    const result = await enrichWebsiteScrape("acme.com");
    expect(result.website?.stated_pricing_tier).toBe("budget");
  });

  it("returns {} on null domain (no throw)", async () => {
    const result = await enrichWebsiteScrape(null);
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns unknown signals when all fetches fail (no throw)", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await enrichWebsiteScrape("acme.com");
    expect(result.website?.team_size_signal).toBe("unknown");
    expect(result.website?.stated_pricing_tier).toBe("unknown");
    expect(result.website?.has_about_page).toBe(false);
  });

  it("does NOT call external_call_log (free fetch)", async () => {
    mockFetch.mockResolvedValue(new Response("<html></html>", { status: 200 }));
    await enrichWebsiteScrape("acme.com");
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ── Maps Photos ────────────────────────────────────────────────────

describe("enrichMapsPhotos", () => {
  it("returns maps.photo_count and maps.last_photo_date on success", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonRes({
        local_results: [{
          title: "Acme Cafe",
          photos_count: 42,
          user_reviews: [{ date: "2026-01-15" }, { date: "2025-12-01" }],
        }],
      }),
    );
    const result = await enrichMapsPhotos("Acme Cafe", "Melbourne", "key123");
    expect(result.maps?.photo_count).toBe(42);
    expect(result.maps?.last_photo_date).toBe("2026-01-15");
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite category/rating/review_count (returns empty defaults)", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonRes({ local_results: [{ photos_count: 10 }] }),
    );
    const result = await enrichMapsPhotos("Acme", "Sydney", "key123");
    expect(result.maps?.category).toBe("");
    expect(result.maps?.rating).toBeNull();
    expect(result.maps?.review_count).toBe(0);
  });

  it("returns {} on empty businessName (no throw)", async () => {
    const result = await enrichMapsPhotos("", "Melbourne", "key123");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns {} on empty apiKey (no throw)", async () => {
    const result = await enrichMapsPhotos("Acme", "Melbourne", "");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error (no throw)", async () => {
    mockFetch.mockResolvedValueOnce(errRes(403));
    const result = await enrichMapsPhotos("Acme", "Melbourne", "key123");
    expect(result.fetch_errors?.maps_photos).toMatch(/403/);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns {} when no local_results returned (no throw)", async () => {
    mockFetch.mockResolvedValueOnce(jsonRes({ local_results: [] }));
    const result = await enrichMapsPhotos("Acme", "Melbourne", "key123");
    expect(result).toEqual({});
  });

  it("returns fetch_errors on network failure (no throw)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await enrichMapsPhotos("Acme", "Melbourne", "key123");
    expect(result.fetch_errors?.maps_photos).toMatch(/timeout/);
  });
});

// ── mergeProfiles ────────────────────────────────────────────────────

describe("mergeProfiles", () => {
  it("merges two partial profiles correctly", () => {
    const p1 = {
      website: {
        domain_age_years: null,
        pagespeed_performance_score: 85,
        has_about_page: false,
        has_pricing_page: false,
        team_size_signal: "unknown" as const,
        stated_pricing_tier: "unknown" as const,
      },
    };
    const p2 = {
      website: {
        domain_age_years: 5,
        pagespeed_performance_score: null,
        has_about_page: true,
        has_pricing_page: false,
        team_size_signal: "small" as const,
        stated_pricing_tier: "unknown" as const,
      },
    };
    const merged = mergeProfiles([p1, p2]);
    // domain_age_years from p2 (meaningful), pagespeed from p1 (meaningful)
    expect(merged.website?.domain_age_years).toBe(5);
    expect(merged.website?.pagespeed_performance_score).toBe(85);
    // boolean OR
    expect(merged.website?.has_about_page).toBe(true);
    // team_size_signal from p2 (non-unknown wins)
    expect(merged.website?.team_size_signal).toBe("small");
  });

  it("aggregates fetch_errors from multiple profiles", () => {
    const p1 = { fetch_errors: { pagespeed: "timeout" } };
    const p2 = { fetch_errors: { domain_age: "404" } };
    const p3 = { instagram: { follower_count: 100, post_count: 10, posts_last_30d: null } };
    const merged = mergeProfiles([p1, p2, p3]);
    expect(merged.fetch_errors?.pagespeed).toBe("timeout");
    expect(merged.fetch_errors?.domain_age).toBe("404");
    expect(merged.instagram?.follower_count).toBe(100);
  });

  it("later meaningful value wins on conflict", () => {
    const p1 = {
      website: {
        domain_age_years: 3,
        pagespeed_performance_score: 70,
        has_about_page: false,
        has_pricing_page: false,
        team_size_signal: "small" as const,
        stated_pricing_tier: "mid" as const,
      },
    };
    const p2 = {
      website: {
        domain_age_years: 7,
        pagespeed_performance_score: 90,
        has_about_page: false,
        has_pricing_page: false,
        team_size_signal: "medium" as const,
        stated_pricing_tier: "premium" as const,
      },
    };
    const merged = mergeProfiles([p1, p2]);
    expect(merged.website?.domain_age_years).toBe(7);
    expect(merged.website?.pagespeed_performance_score).toBe(90);
    expect(merged.website?.team_size_signal).toBe("medium");
    expect(merged.website?.stated_pricing_tier).toBe("premium");
  });

  it("maps-photos merges into existing maps from google-maps without overwriting category/rating", () => {
    const googleMapsProfile = {
      maps: {
        category: "Cafe",
        rating: 4.5,
        review_count: 120,
        photo_count: 0,
        last_photo_date: null,
      },
    };
    const mapsPhotosProfile = {
      maps: {
        category: "",
        rating: null,
        review_count: 0,
        photo_count: 38,
        last_photo_date: "2026-01-10",
      },
    };
    const merged = mergeProfiles([googleMapsProfile, mapsPhotosProfile]);
    // category/rating/review_count from google-maps (meaningful)
    expect(merged.maps?.category).toBe("Cafe");
    expect(merged.maps?.rating).toBe(4.5);
    expect(merged.maps?.review_count).toBe(120);
    // photo data from maps-photos (meaningful)
    expect(merged.maps?.photo_count).toBe(38);
    expect(merged.maps?.last_photo_date).toBe("2026-01-10");
  });

  it("returns empty ViabilityProfile for empty input", () => {
    const merged = mergeProfiles([]);
    expect(merged).toEqual({});
  });

  it("returns {} when all inputs are empty partials", () => {
    const merged = mergeProfiles([{}, {}, {}]);
    expect(merged).toEqual({});
  });
});
