import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

const mockInsert = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: mockInsert })),
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

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  mockInsert.mockReset();
  mockInsert.mockResolvedValue(undefined);
});

// ── enrichPageSpeed ─────────────────────────────────────────────────

describe("enrichPageSpeed", () => {
  it("returns pagespeed_performance_score on happy path", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        lighthouseResult: {
          categories: { performance: { score: 0.87 } },
        },
      }),
    );
    const result = await enrichPageSpeed("acme.com.au", "Acme");
    expect(result.website?.pagespeed_performance_score).toBe(87);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} gracefully on null domain", async () => {
    const result = await enrichPageSpeed(null, "Acme");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error", async () => {
    mockFetch.mockResolvedValue(errorResponse(500));
    const result = await enrichPageSpeed("acme.com.au", "Acme");
    expect(result.fetch_errors?.pagespeed).toMatch(/500/);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns fetch_errors on network error", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await enrichPageSpeed("acme.com.au", "Acme");
    expect(result.fetch_errors?.pagespeed).toMatch(/ECONNREFUSED/);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns fetch_errors on API-level error response", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: { message: "API key missing" } }),
    );
    const result = await enrichPageSpeed("acme.com.au", "Acme");
    expect(result.fetch_errors?.pagespeed).toMatch(/API key missing/);
  });

  it("handles missing performance score gracefully", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ lighthouseResult: { categories: {} } }),
    );
    const result = await enrichPageSpeed("acme.com.au", "Acme");
    expect(result.website?.pagespeed_performance_score).toBeNull();
    expect(result.fetch_errors).toBeUndefined();
  });
});

// ── enrichDomainAge ─────────────────────────────────────────────────

describe("enrichDomainAge", () => {
  it("returns domain_age_years on happy path", async () => {
    // Use 5 years + 6 months ago so Math.floor reliably returns 5.
    const fiveAndHalfYearsAgo = new Date();
    fiveAndHalfYearsAgo.setMonth(fiveAndHalfYearsAgo.getMonth() - 66);

    mockFetch.mockResolvedValue(
      jsonResponse({
        events: [
          {
            eventAction: "registration",
            eventDate: fiveAndHalfYearsAgo.toISOString(),
          },
          { eventAction: "expiration", eventDate: "2030-01-01T00:00:00Z" },
        ],
      }),
    );
    const result = await enrichDomainAge("acme.com.au");
    expect(result.website?.domain_age_years).toBe(5);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} gracefully on null domain", async () => {
    const result = await enrichDomainAge(null);
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error", async () => {
    mockFetch.mockResolvedValue(errorResponse(404));
    const result = await enrichDomainAge("acme.com.au");
    expect(result.fetch_errors?.domain_age).toMatch(/404/);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns fetch_errors on network error", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));
    const result = await enrichDomainAge("acme.com.au");
    expect(result.fetch_errors?.domain_age).toMatch(/timeout/);
  });

  it("returns domain_age_years null when no registration event", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ events: [{ eventAction: "expiration", eventDate: "2030-01-01" }] }),
    );
    const result = await enrichDomainAge("acme.com.au");
    expect(result.website?.domain_age_years).toBeNull();
    expect(result.fetch_errors).toBeUndefined();
  });
});

// ── enrichInstagram ─────────────────────────────────────────────────

describe("enrichInstagram", () => {
  it("returns instagram stats on happy path", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ instagram_business_account: { id: "IG123" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          business_discovery: { followers_count: 5200, media_count: 150 },
        }),
      );

    const result = await enrichInstagram(null, "Acme Marketing", "tok_abc");
    expect(result.instagram?.follower_count).toBe(5200);
    expect(result.instagram?.post_count).toBe(150);
    expect(result.instagram?.posts_last_30d).toBeNull();
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} gracefully on missing apiKey", async () => {
    const result = await enrichInstagram(null, "Acme", "");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on /me HTTP error", async () => {
    mockFetch.mockResolvedValue(errorResponse(401));
    const result = await enrichInstagram(null, "Acme", "tok_bad");
    expect(result.fetch_errors?.instagram).toBeDefined();
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns fetch_errors when page has no IG account", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ id: "PAGE123" }),
    );
    const result = await enrichInstagram(null, "Acme", "tok_abc");
    expect(result.fetch_errors?.instagram).toMatch(/no linked/);
  });

  it("returns fetch_errors on network error", async () => {
    mockFetch.mockRejectedValue(new Error("ETIMEDOUT"));
    const result = await enrichInstagram(null, "Acme", "tok_abc");
    expect(result.fetch_errors?.instagram).toMatch(/ETIMEDOUT/);
  });
});

// ── enrichYouTube ───────────────────────────────────────────────────

describe("enrichYouTube", () => {
  it("returns youtube stats on happy path", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: { channelId: "UCabc123" } }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              statistics: {
                subscriberCount: "12500",
                videoCount: "87",
              },
            },
          ],
        }),
      );

    const result = await enrichYouTube("Acme Marketing", "YT_API_KEY");
    expect(result.youtube?.subscriber_count).toBe(12500);
    expect(result.youtube?.video_count).toBe(87);
    expect(result.youtube?.uploads_last_90d).toBeNull();
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} gracefully on missing apiKey", async () => {
    const result = await enrichYouTube("Acme", "");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error", async () => {
    mockFetch.mockResolvedValue(errorResponse(403));
    const result = await enrichYouTube("Acme", "YT_API_KEY");
    expect(result.fetch_errors?.youtube).toBeDefined();
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns fetch_errors when no channel found", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [] }));
    const result = await enrichYouTube("Acme", "YT_API_KEY");
    expect(result.fetch_errors?.youtube).toMatch(/no channel/);
  });

  it("returns fetch_errors on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));
    const result = await enrichYouTube("Acme", "YT_API_KEY");
    expect(result.fetch_errors?.youtube).toMatch(/Network failure/);
  });
});

// ── enrichWebsiteScrape ─────────────────────────────────────────────

describe("enrichWebsiteScrape", () => {
  it("detects about and pricing pages on happy path", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/about")) {
        return Promise.resolve(
          htmlResponse(
            '<html><body><h1>About Us</h1><p>We are a small team of creatives.</p></body></html>',
          ),
        );
      }
      if (url.includes("/pricing")) {
        return Promise.resolve(
          htmlResponse(
            "<html><body><h1>Pricing</h1><p>Premium bespoke solutions for enterprise clients.</p></body></html>",
          ),
        );
      }
      return Promise.resolve(errorResponse(404));
    });

    const result = await enrichWebsiteScrape("acme.com.au");
    expect(result.website?.has_about_page).toBe(true);
    expect(result.website?.has_pricing_page).toBe(true);
    expect(result.website?.team_size_signal).toBe("small");
    expect(result.website?.stated_pricing_tier).toBe("premium");
  });

  it("returns {} gracefully on null domain", async () => {
    const result = await enrichWebsiteScrape(null);
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for pages that 404", async () => {
    mockFetch.mockResolvedValue(errorResponse(404));
    const result = await enrichWebsiteScrape("acme.com.au");
    expect(result.website?.has_about_page).toBe(false);
    expect(result.website?.has_pricing_page).toBe(false);
    expect(result.website?.team_size_signal).toBe("unknown");
    expect(result.website?.stated_pricing_tier).toBe("unknown");
  });

  it("does not throw on network errors", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await enrichWebsiteScrape("acme.com.au");
    expect(result.website?.has_about_page).toBe(false);
    expect(result.fetch_errors).toBeUndefined();
  });
});

// ── enrichMapsPhotos ────────────────────────────────────────────────

describe("enrichMapsPhotos", () => {
  it("returns photo_count and last_photo_date on happy path", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        local_results: [
          {
            title: "Acme Marketing",
            photos_count: 42,
            user_reviews: [{ date: "2024-03-15" }, { date: "2024-01-10" }],
          },
        ],
      }),
    );

    const result = await enrichMapsPhotos(
      "Acme Marketing",
      "Melbourne, Australia",
      "SERP_KEY",
    );
    expect(result.maps?.photo_count).toBe(42);
    expect(result.maps?.last_photo_date).toBe("2024-03-15");
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns {} gracefully on missing apiKey", async () => {
    const result = await enrichMapsPhotos("Acme", "Melbourne", "");
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fetch_errors on HTTP error", async () => {
    mockFetch.mockResolvedValue(errorResponse(429));
    const result = await enrichMapsPhotos("Acme", "Melbourne", "SERP_KEY");
    expect(result.fetch_errors?.maps_photos).toMatch(/429/);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returns fetch_errors on network error", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));
    const result = await enrichMapsPhotos("Acme", "Melbourne", "SERP_KEY");
    expect(result.fetch_errors?.maps_photos).toMatch(/timeout/);
  });

  it("returns fetch_errors on SerpAPI error body", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: "Invalid API key" }),
    );
    const result = await enrichMapsPhotos("Acme", "Melbourne", "SERP_KEY");
    expect(result.fetch_errors?.maps_photos).toMatch(/Invalid API key/);
  });
});

// ── mergeProfiles ───────────────────────────────────────────────────

describe("mergeProfiles", () => {
  it("merges two disjoint partial profiles", () => {
    const a: Partial<ViabilityProfile> = {
      instagram: { follower_count: 1000, post_count: 50, posts_last_30d: null },
    };
    const b: Partial<ViabilityProfile> = {
      youtube: { subscriber_count: 500, video_count: 20, uploads_last_90d: null },
    };
    const merged = mergeProfiles([a, b]);
    expect(merged.instagram?.follower_count).toBe(1000);
    expect(merged.youtube?.subscriber_count).toBe(500);
  });

  it("deep-merges website sub-object from multiple enrichers", () => {
    const pagespeedProfile: Partial<ViabilityProfile> = {
      website: {
        pagespeed_performance_score: 85,
        domain_age_years: null,
        has_about_page: false,
        has_pricing_page: false,
        team_size_signal: "unknown",
        stated_pricing_tier: "unknown",
      },
    };
    const domainAgeProfile: Partial<ViabilityProfile> = {
      website: {
        domain_age_years: 7,
        pagespeed_performance_score: null,
        has_about_page: false,
        has_pricing_page: false,
        team_size_signal: "unknown",
        stated_pricing_tier: "unknown",
      },
    };
    const scrapeProfile: Partial<ViabilityProfile> = {
      website: {
        has_about_page: true,
        has_pricing_page: true,
        team_size_signal: "small",
        stated_pricing_tier: "mid",
        domain_age_years: null,
        pagespeed_performance_score: null,
      },
    };

    const merged = mergeProfiles([pagespeedProfile, domainAgeProfile, scrapeProfile]);

    expect(merged.website?.pagespeed_performance_score).toBe(85);
    expect(merged.website?.domain_age_years).toBe(7);
    expect(merged.website?.has_about_page).toBe(true);
    expect(merged.website?.team_size_signal).toBe("small");
    expect(merged.website?.stated_pricing_tier).toBe("mid");
  });

  it("aggregates fetch_errors from all profiles", () => {
    const a: Partial<ViabilityProfile> = {
      fetch_errors: { pagespeed: "timeout" },
    };
    const b: Partial<ViabilityProfile> = {
      fetch_errors: { youtube: "403 Forbidden" },
    };
    const merged = mergeProfiles([a, b]);
    expect(merged.fetch_errors?.pagespeed).toBe("timeout");
    expect(merged.fetch_errors?.youtube).toBe("403 Forbidden");
  });

  it("handles empty profiles array", () => {
    const merged = mergeProfiles([]);
    expect(merged).toEqual({});
  });

  it("later non-null values win; null from later profile does not overwrite", () => {
    const a: Partial<ViabilityProfile> = {
      maps: {
        category: "cafes",
        rating: 4.5,
        review_count: 120,
        photo_count: 0,
        last_photo_date: null,
      },
    };
    // b simulates enrichMapsPhotos — only photo_count + last_photo_date present.
    const b: Partial<ViabilityProfile> = {
      maps: { photo_count: 35, last_photo_date: "2024-06-01" } as ViabilityProfile["maps"],
    };
    const merged = mergeProfiles([a, b]);
    // Fields from a preserved because b doesn't set them.
    expect(merged.maps?.rating).toBe(4.5);
    expect(merged.maps?.category).toBe("cafes");
    expect(merged.maps?.review_count).toBe(120);
    // New non-null values from b win.
    expect(merged.maps?.photo_count).toBe(35);
    expect(merged.maps?.last_photo_date).toBe("2024-06-01");
  });

  it("handles profiles with only fetch_errors", () => {
    const a: Partial<ViabilityProfile> = {
      fetch_errors: { pagespeed: "err" },
    };
    const merged = mergeProfiles([a]);
    expect(merged.fetch_errors?.pagespeed).toBe("err");
    expect(merged.instagram).toBeUndefined();
  });
});
