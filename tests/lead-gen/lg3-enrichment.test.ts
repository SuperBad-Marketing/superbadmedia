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
import type { ViabilityProfile } from "@/lib/lead-gen/types";

// ── Helpers ─────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number): Response {
  return new Response("Server Error", { status });
}

// ── enrichPageSpeed ──────────────────────────────────────────────────

describe("enrichPageSpeed", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockInsert.mockReset();
    mockInsert.mockResolvedValue(undefined);
  });

  it("returns pagespeed_performance_score on happy path", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        lighthouseResult: {
          categories: {
            performance: { score: 0.87 },
          },
        },
      }),
    );

    const result = await enrichPageSpeed("acme.com.au", "Acme Cafe");

    expect(result.website?.pagespeed_performance_score).toBe(87);
    expect(result.website?.domain_age_years).toBeNull();
    expect(result.website?.has_about_page).toBe(false);
    expect(result.website?.team_size_signal).toBe("unknown");
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} on null domain", async () => {
    const result = await enrichPageSpeed(null, "Acme Cafe");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error, does not throw", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500));

    const result = await enrichPageSpeed("acme.com.au", "Acme");
    expect(result).toHaveProperty("fetch_errors.pagespeed");
    expect(result.website).toBeUndefined();
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns fetch_errors on network error, does not throw", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await enrichPageSpeed("acme.com.au", "Acme");
    expect(result).toHaveProperty("fetch_errors.pagespeed");
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("handles missing performance score gracefully (score is null)", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ lighthouseResult: { categories: {} } }),
    );

    const result = await enrichPageSpeed("acme.com.au", "Acme");
    expect(result.website?.pagespeed_performance_score).toBeNull();
  });
});

// ── enrichDomainAge ──────────────────────────────────────────────────

describe("enrichDomainAge", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockInsert.mockReset();
    mockInsert.mockResolvedValue(undefined);
  });

  it("returns domain_age_years on happy path", async () => {
    const regDate = new Date();
    regDate.setFullYear(regDate.getFullYear() - 5);

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        events: [
          { eventAction: "registration", eventDate: regDate.toISOString() },
          { eventAction: "expiration", eventDate: "2030-01-01T00:00:00Z" },
        ],
      }),
    );

    const result = await enrichDomainAge("acme.com.au");

    expect(result.website?.domain_age_years).toBe(5);
    expect(result.website?.pagespeed_performance_score).toBeNull();
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} on null domain", async () => {
    const result = await enrichDomainAge(null);
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error, does not throw", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404));

    const result = await enrichDomainAge("acme.com.au");
    expect(result).toHaveProperty("fetch_errors.domain_age");
    expect(result.website).toBeUndefined();
  });

  it("returns fetch_errors on network error, does not throw", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Timeout"));

    const result = await enrichDomainAge("acme.com.au");
    expect(result).toHaveProperty("fetch_errors.domain_age");
  });

  it("returns domain_age_years: null when no registration event found", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ events: [{ eventAction: "expiration", eventDate: "2030-01-01T00:00:00Z" }] }),
    );

    const result = await enrichDomainAge("acme.com.au");
    expect(result.website?.domain_age_years).toBeNull();
  });
});

// ── enrichInstagram ──────────────────────────────────────────────────

describe("enrichInstagram", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockInsert.mockReset();
    mockInsert.mockResolvedValue(undefined);
  });

  it("returns instagram signals on happy path", async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5);
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 60);

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: "page-123",
            instagram_business_account: {
              id: "ig-456",
              followers_count: 2500,
              media_count: 120,
              media: {
                data: [
                  { timestamp: recentDate.toISOString() },
                  { timestamp: recentDate.toISOString() },
                  { timestamp: oldDate.toISOString() },
                ],
              },
            },
          },
        ],
      }),
    );

    const result = await enrichInstagram("acme.com.au", "Acme Cafe", "token-abc");

    expect(result.instagram?.follower_count).toBe(2500);
    expect(result.instagram?.post_count).toBe(120);
    expect(result.instagram?.posts_last_30d).toBe(2);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} when no Instagram account found", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

    const result = await enrichInstagram("acme.com.au", "Acme", "token-abc");
    expect(result).toEqual({});
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} on missing apiKey", async () => {
    const result = await enrichInstagram("acme.com.au", "Acme", "");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error, does not throw", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401));

    const result = await enrichInstagram("acme.com.au", "Acme", "bad-token");
    expect(result).toHaveProperty("fetch_errors.instagram");
    expect(result.instagram).toBeUndefined();
  });

  it("returns fetch_errors on network error, does not throw", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await enrichInstagram("acme.com.au", "Acme", "token");
    expect(result).toHaveProperty("fetch_errors.instagram");
  });

  it("returns fetch_errors on Graph API error response, does not throw", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: { message: "Invalid OAuth access token" } }),
    );

    const result = await enrichInstagram("acme.com.au", "Acme", "bad");
    expect(result).toHaveProperty("fetch_errors.instagram");
  });
});

// ── enrichYouTube ────────────────────────────────────────────────────

describe("enrichYouTube", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockInsert.mockReset();
    mockInsert.mockResolvedValue(undefined);
  });

  it("returns youtube signals on happy path (3 API calls)", async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10);

    // Call 1: search
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [{ id: { channelId: "UC-channel-123" } }],
      }),
    );
    // Call 2: channel stats
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            statistics: { subscriberCount: "8500", videoCount: "45" },
            contentDetails: { relatedPlaylists: { uploads: "UU-uploads-456" } },
          },
        ],
      }),
    );
    // Call 3: playlist items
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { contentDetails: { videoPublishedAt: recentDate.toISOString() } },
          { contentDetails: { videoPublishedAt: recentDate.toISOString() } },
        ],
      }),
    );

    const result = await enrichYouTube("Acme Cafe", "yt-api-key");

    expect(result.youtube?.subscriber_count).toBe(8500);
    expect(result.youtube?.video_count).toBe(45);
    expect(result.youtube?.uploads_last_90d).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} when no channel found", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ items: [] }));

    const result = await enrichYouTube("Acme Cafe", "yt-api-key");
    expect(result).toEqual({});
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} on missing apiKey", async () => {
    const result = await enrichYouTube("Acme", "");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error, does not throw", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403));

    const result = await enrichYouTube("Acme", "bad-key");
    expect(result).toHaveProperty("fetch_errors.youtube");
    expect(result.youtube).toBeUndefined();
  });

  it("returns fetch_errors on network error, does not throw", async () => {
    mockFetch.mockRejectedValueOnce(new Error("DNS failure"));

    const result = await enrichYouTube("Acme", "key");
    expect(result).toHaveProperty("fetch_errors.youtube");
  });
});

// ── enrichWebsiteScrape ──────────────────────────────────────────────

describe("enrichWebsiteScrape", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("detects about page and pricing page on happy path", async () => {
    const rootHtml = `<html><body><p>Welcome to Acme, a small team of professionals.</p></body></html>`;
    const aboutHtml = `<html><body><h1>About Us</h1><p>We are a boutique agency.</p></body></html>`;
    const teamHtml = `<html><body><h1>Team</h1></body></html>`;
    const pricingHtml = `<html><body><h1>Pricing</h1><p>Our competitive rates start from $500/month.</p></body></html>`;

    mockFetch
      .mockResolvedValueOnce(new Response(rootHtml, { status: 200 })) // root
      .mockResolvedValueOnce(new Response(aboutHtml, { status: 200 })) // /about
      .mockResolvedValueOnce(new Response(teamHtml, { status: 200 }))  // /team
      .mockResolvedValueOnce(new Response(pricingHtml, { status: 200 })); // /pricing

    const result = await enrichWebsiteScrape("acme.com.au");

    expect(result.website?.has_about_page).toBe(true);
    expect(result.website?.has_pricing_page).toBe(true);
    expect(result.website?.team_size_signal).toBe("small");
    expect(result.website?.stated_pricing_tier).toBe("mid");
    expect(result.website?.domain_age_years).toBeNull();
    expect(result.website?.pagespeed_performance_score).toBeNull();
  });

  it("returns {} on null domain", async () => {
    const result = await enrichWebsiteScrape(null);
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns has_about_page: false when /about returns 404", async () => {
    const rootHtml = `<html><body>Hello</body></html>`;
    mockFetch
      .mockResolvedValueOnce(new Response(rootHtml, { status: 200 })) // root
      .mockResolvedValueOnce(errorResponse(404))  // /about
      .mockResolvedValueOnce(errorResponse(404))  // /team
      .mockResolvedValueOnce(errorResponse(404)); // /pricing

    const result = await enrichWebsiteScrape("acme.com.au");

    expect(result.website?.has_about_page).toBe(false);
    expect(result.website?.has_pricing_page).toBe(false);
  });

  it("does not throw when all fetches fail", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await enrichWebsiteScrape("acme.com.au");
    expect(result.website?.has_about_page).toBe(false);
    expect(result.website?.has_pricing_page).toBe(false);
    expect(result.website?.team_size_signal).toBe("unknown");
    expect(result.website?.stated_pricing_tier).toBe("unknown");
  });

  it("detects solo team signal", async () => {
    const html = `<html><body>I'm a sole trader serving Melbourne clients.</body></html>`;
    mockFetch
      .mockResolvedValueOnce(new Response(html, { status: 200 }))
      .mockResolvedValueOnce(errorResponse(404))
      .mockResolvedValueOnce(errorResponse(404))
      .mockResolvedValueOnce(errorResponse(404));

    const result = await enrichWebsiteScrape("acme.com.au");
    expect(result.website?.team_size_signal).toBe("solo");
  });

  it("detects premium pricing signal", async () => {
    const html = `<html><body><h1>Premium luxury services for discerning clients.</h1></body></html>`;
    mockFetch
      .mockResolvedValueOnce(new Response(html, { status: 200 }))
      .mockResolvedValueOnce(errorResponse(404))
      .mockResolvedValueOnce(errorResponse(404))
      .mockResolvedValueOnce(errorResponse(404));

    const result = await enrichWebsiteScrape("acme.com.au");
    expect(result.website?.stated_pricing_tier).toBe("premium");
  });
});

// ── enrichMapsPhotos ─────────────────────────────────────────────────

describe("enrichMapsPhotos", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockInsert.mockReset();
    mockInsert.mockResolvedValue(undefined);
  });

  it("returns photo_count and last_photo_date on happy path", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        local_results: [
          {
            title: "Acme Cafe",
            photos_count: 47,
            user_reviews: [
              { rating: 5, date: "2024-11-15" },
              { rating: 4, date: "2024-10-01" },
            ],
          },
        ],
      }),
    );

    const result = await enrichMapsPhotos("Acme Cafe", "Melbourne", "serp-key");

    expect(result.maps?.photo_count).toBe(47);
    expect(result.maps?.last_photo_date).toBe("2024-11-15");
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} when no results found", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ local_results: [] }));

    const result = await enrichMapsPhotos("Acme Cafe", "Melbourne", "serp-key");
    expect(result).toEqual({});
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} on missing apiKey", async () => {
    const result = await enrichMapsPhotos("Acme", "Melbourne", "");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error, does not throw", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(429));

    const result = await enrichMapsPhotos("Acme", "Melbourne", "key");
    expect(result).toHaveProperty("fetch_errors.maps_photos");
    expect(result.maps).toBeUndefined();
  });

  it("returns fetch_errors on network error, does not throw", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Timeout"));

    const result = await enrichMapsPhotos("Acme", "Melbourne", "key");
    expect(result).toHaveProperty("fetch_errors.maps_photos");
  });

  it("returns fetch_errors on SerpAPI error field, does not throw", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "Invalid API key." }),
    );

    const result = await enrichMapsPhotos("Acme", "Melbourne", "bad-key");
    expect(result).toHaveProperty("fetch_errors.maps_photos");
  });
});

// ── mergeProfiles ────────────────────────────────────────────────────

describe("mergeProfiles", () => {
  it("merges empty array to empty object", () => {
    const result = mergeProfiles([]);
    expect(result).toEqual({});
  });

  it("merges single profile unchanged (for whole-object fields)", () => {
    const profile: Partial<ViabilityProfile> = {
      instagram: { follower_count: 1000, post_count: 50, posts_last_30d: 5 },
    };
    const result = mergeProfiles([profile]);
    expect(result.instagram).toEqual(profile.instagram);
  });

  it("later instagram profile wins over earlier", () => {
    const a: Partial<ViabilityProfile> = {
      instagram: { follower_count: 100, post_count: 10, posts_last_30d: 1 },
    };
    const b: Partial<ViabilityProfile> = {
      instagram: { follower_count: 500, post_count: 40, posts_last_30d: 8 },
    };
    const result = mergeProfiles([a, b]);
    expect(result.instagram?.follower_count).toBe(500);
  });

  it("merges website fields: non-null wins for nullable numerics", () => {
    const pagespeed: Partial<ViabilityProfile> = {
      website: {
        pagespeed_performance_score: 87,
        domain_age_years: null,
        has_about_page: false,
        has_pricing_page: false,
        team_size_signal: "unknown",
        stated_pricing_tier: "unknown",
      },
    };
    const domainAge: Partial<ViabilityProfile> = {
      website: {
        pagespeed_performance_score: null,
        domain_age_years: 5,
        has_about_page: false,
        has_pricing_page: false,
        team_size_signal: "unknown",
        stated_pricing_tier: "unknown",
      },
    };

    const result = mergeProfiles([pagespeed, domainAge]);

    expect(result.website?.pagespeed_performance_score).toBe(87);
    expect(result.website?.domain_age_years).toBe(5);
  });

  it("merges website fields: true wins over false for booleans", () => {
    const a: Partial<ViabilityProfile> = {
      website: {
        pagespeed_performance_score: null,
        domain_age_years: null,
        has_about_page: true,
        has_pricing_page: false,
        team_size_signal: "unknown",
        stated_pricing_tier: "unknown",
      },
    };
    const b: Partial<ViabilityProfile> = {
      website: {
        pagespeed_performance_score: null,
        domain_age_years: null,
        has_about_page: false,
        has_pricing_page: true,
        team_size_signal: "small",
        stated_pricing_tier: "premium",
      },
    };

    const result = mergeProfiles([a, b]);

    expect(result.website?.has_about_page).toBe(true);
    expect(result.website?.has_pricing_page).toBe(true);
    expect(result.website?.team_size_signal).toBe("small");
    expect(result.website?.stated_pricing_tier).toBe("premium");
  });

  it("merges maps: preserves category/rating/review_count from earlier; takes photo_count/last_photo_date from later", () => {
    const googleMaps: Partial<ViabilityProfile> = {
      maps: {
        category: "restaurant",
        rating: 4.5,
        review_count: 150,
        photo_count: 0,
        last_photo_date: null,
      },
    };
    const mapsPhotos: Partial<ViabilityProfile> = {
      maps: {
        photo_count: 47,
        last_photo_date: "2024-11-15",
        category: "",
        rating: null,
        review_count: 0,
      },
    };

    const result = mergeProfiles([googleMaps, mapsPhotos]);

    expect(result.maps?.category).toBe("restaurant");
    expect(result.maps?.rating).toBe(4.5);
    expect(result.maps?.review_count).toBe(150);
    expect(result.maps?.photo_count).toBe(47);
    expect(result.maps?.last_photo_date).toBe("2024-11-15");
  });

  it("aggregates fetch_errors from all profiles", () => {
    const a: Partial<ViabilityProfile> = {
      fetch_errors: { pagespeed: "timeout" },
    };
    const b: Partial<ViabilityProfile> = {
      fetch_errors: { instagram: "auth error" },
    };
    const c: Partial<ViabilityProfile> = {
      fetch_errors: { youtube: "quota exceeded" },
    };

    const result = mergeProfiles([a, b, c]);

    expect(result.fetch_errors).toEqual({
      pagespeed: "timeout",
      instagram: "auth error",
      youtube: "quota exceeded",
    });
  });

  it("handles mixed profiles: some with fetch_errors, some without", () => {
    const a: Partial<ViabilityProfile> = {
      instagram: { follower_count: 500, post_count: 30, posts_last_30d: 4 },
    };
    const b: Partial<ViabilityProfile> = {
      fetch_errors: { youtube: "not found" },
    };

    const result = mergeProfiles([a, b]);

    expect(result.instagram?.follower_count).toBe(500);
    expect(result.fetch_errors?.youtube).toBe("not found");
  });

  it("handles three website enrichers merged correctly", () => {
    const pagespeed: Partial<ViabilityProfile> = {
      website: {
        pagespeed_performance_score: 75,
        domain_age_years: null,
        has_about_page: false,
        has_pricing_page: false,
        team_size_signal: "unknown",
        stated_pricing_tier: "unknown",
      },
    };
    const domainAge: Partial<ViabilityProfile> = {
      website: {
        pagespeed_performance_score: null,
        domain_age_years: 3,
        has_about_page: false,
        has_pricing_page: false,
        team_size_signal: "unknown",
        stated_pricing_tier: "unknown",
      },
    };
    const scrape: Partial<ViabilityProfile> = {
      website: {
        pagespeed_performance_score: null,
        domain_age_years: null,
        has_about_page: true,
        has_pricing_page: true,
        team_size_signal: "small",
        stated_pricing_tier: "mid",
      },
    };

    const result = mergeProfiles([pagespeed, domainAge, scrape]);

    expect(result.website?.pagespeed_performance_score).toBe(75);
    expect(result.website?.domain_age_years).toBe(3);
    expect(result.website?.has_about_page).toBe(true);
    expect(result.website?.has_pricing_page).toBe(true);
    expect(result.website?.team_size_signal).toBe("small");
    expect(result.website?.stated_pricing_tier).toBe("mid");
  });
});
