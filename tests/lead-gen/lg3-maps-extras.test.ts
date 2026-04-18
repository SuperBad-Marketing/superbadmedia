import { describe, it, expect } from "vitest";
import {
  parseRelativeDate,
  applyMapsExtrasToProfile,
  type MapsExtrasResult,
} from "@/lib/lead-gen/enrich/maps-extras";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

describe("parseRelativeDate", () => {
  it("parses 'N months ago'", () => {
    const result = parseRelativeDate("3 months ago");
    expect(result).toBeTruthy();
    // Should be roughly 3 months before today
    const parsed = new Date(result!);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    expect(Math.abs(parsed.getTime() - threeMonthsAgo.getTime())).toBeLessThan(
      2 * 24 * 60 * 60 * 1000, // 2 days tolerance
    );
  });

  it("parses 'a month ago'", () => {
    const result = parseRelativeDate("a month ago");
    expect(result).toBeTruthy();
  });

  it("parses 'N years ago'", () => {
    const result = parseRelativeDate("2 years ago");
    expect(result).toBeTruthy();
    const parsed = new Date(result!);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    expect(Math.abs(parsed.getTime() - twoYearsAgo.getTime())).toBeLessThan(
      2 * 24 * 60 * 60 * 1000,
    );
  });

  it("parses 'N days ago'", () => {
    const result = parseRelativeDate("5 days ago");
    expect(result).toBeTruthy();
  });

  it("parses 'N weeks ago'", () => {
    const result = parseRelativeDate("2 weeks ago");
    expect(result).toBeTruthy();
  });

  it("parses 'Month Year' format", () => {
    const result = parseRelativeDate("March 2024");
    expect(result).toBe("2024-03-01");
  });

  it("parses 'January 2025' format", () => {
    const result = parseRelativeDate("January 2025");
    expect(result).toBe("2025-01-01");
  });

  it("returns null for empty string", () => {
    expect(parseRelativeDate("")).toBeNull();
  });

  it("returns null for unrecognised format", () => {
    expect(parseRelativeDate("recently")).toBeNull();
    expect(parseRelativeDate("last summer")).toBeNull();
  });
});

describe("applyMapsExtrasToProfile", () => {
  it("updates photo count and last photo date", () => {
    const existing: Partial<ViabilityProfile> = {
      maps: {
        category: "Cafe",
        rating: 4.5,
        review_count: 100,
        photo_count: 10,
        last_photo_date: null,
      },
    };

    const result: MapsExtrasResult = {
      photo_count: 45,
      last_photo_date: "2026-03-15",
    };
    const profile = applyMapsExtrasToProfile(existing, result);

    expect(profile.maps?.photo_count).toBe(45);
    expect(profile.maps?.last_photo_date).toBe("2026-03-15");
    expect(profile.maps?.category).toBe("Cafe");
    expect(profile.maps?.rating).toBe(4.5);
    expect(profile.maps?.review_count).toBe(100);
  });

  it("creates maps section if none exists", () => {
    const result: MapsExtrasResult = {
      photo_count: 20,
      last_photo_date: "2026-01-10",
    };
    const profile = applyMapsExtrasToProfile({}, result);

    expect(profile.maps?.photo_count).toBe(20);
    expect(profile.maps?.last_photo_date).toBe("2026-01-10");
    expect(profile.maps?.category).toBe("unknown");
  });

  it("preserves discovery photo count when extras return 0", () => {
    const existing: Partial<ViabilityProfile> = {
      maps: {
        category: "Gym",
        rating: 4.2,
        review_count: 50,
        photo_count: 12,
        last_photo_date: null,
      },
    };

    const result: MapsExtrasResult = {
      photo_count: 0,
      last_photo_date: null,
      error: "SerpAPI Maps Photos error: 404",
    };
    const profile = applyMapsExtrasToProfile(existing, result);

    expect(profile.maps?.photo_count).toBe(12);
    expect(profile.fetch_errors?.maps_extras).toContain("404");
  });

  it("records error in fetch_errors", () => {
    const result: MapsExtrasResult = {
      photo_count: 0,
      last_photo_date: null,
      error: "SerpAPI credential not found.",
    };
    const profile = applyMapsExtrasToProfile({}, result);

    expect(profile.fetch_errors?.maps_extras).toBe("SerpAPI credential not found.");
  });
});
