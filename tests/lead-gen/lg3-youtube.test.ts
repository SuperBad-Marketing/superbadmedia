import { describe, it, expect } from "vitest";
import {
  applyYouTubeToProfile,
  type YouTubeResult,
} from "@/lib/lead-gen/enrich/youtube";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

describe("applyYouTubeToProfile", () => {
  it("merges manual YouTube data into main profile", () => {
    const result: YouTubeResult = {
      subscriber_count: 1200,
      video_count: 45,
      uploads_last_90d: 6,
      channel_id: "UCabc123",
      channel_title: "Test Channel",
      match_source: "manual",
    };
    const profile = applyYouTubeToProfile({}, result);

    expect(profile.youtube?.subscriber_count).toBe(1200);
    expect(profile.youtube?.video_count).toBe(45);
    expect(profile.youtube?.uploads_last_90d).toBe(6);
    expect(profile.unverified_signals).toBeUndefined();
  });

  it("merges scraped YouTube data into main profile", () => {
    const result: YouTubeResult = {
      subscriber_count: 500,
      video_count: 22,
      uploads_last_90d: 3,
      channel_id: "UCxyz",
      channel_title: "Scraped Channel",
      match_source: "scraped",
    };
    const profile = applyYouTubeToProfile({}, result);

    expect(profile.youtube?.subscriber_count).toBe(500);
    expect(profile.unverified_signals).toBeUndefined();
  });

  it("diverts searched YouTube data to unverified_signals", () => {
    const result: YouTubeResult = {
      subscriber_count: 1200,
      video_count: 45,
      uploads_last_90d: 6,
      channel_id: "UCabc123",
      channel_title: "Some Random Channel",
      match_source: "searched",
    };
    const profile = applyYouTubeToProfile({}, result);

    expect(profile.youtube).toBeUndefined();
    expect(profile.unverified_signals?.youtube?.channel_title).toBe("Some Random Channel");
    expect(profile.unverified_signals?.youtube?.video_count).toBe(45);
    expect(profile.unverified_signals?.youtube?.channel_url).toContain("UCabc123");
  });

  it("skips youtube section when all fields null", () => {
    const result: YouTubeResult = {
      subscriber_count: null,
      video_count: null,
      uploads_last_90d: null,
      channel_id: null,
      channel_title: null,
      match_source: "searched",
      error: "No YouTube channel found for this business.",
    };
    const profile = applyYouTubeToProfile({}, result);

    expect(profile.youtube).toBeUndefined();
    expect(profile.unverified_signals).toBeUndefined();
    expect(profile.fetch_errors?.youtube).toContain("No YouTube channel");
  });

  it("preserves existing profile fields", () => {
    const existing: Partial<ViabilityProfile> = {
      maps: {
        category: "Gym",
        rating: 4.7,
        review_count: 200,
        photo_count: 30,
        last_photo_date: null,
      },
    };

    const result: YouTubeResult = {
      subscriber_count: 500,
      video_count: 22,
      uploads_last_90d: 3,
      channel_id: "UCxyz",
      channel_title: "Gym Channel",
      match_source: "manual",
    };
    const profile = applyYouTubeToProfile(existing, result);

    expect(profile.youtube?.subscriber_count).toBe(500);
    expect(profile.maps?.category).toBe("Gym");
  });

  it("defaults null subscriber_count to 0 when video_count exists (manual)", () => {
    const result: YouTubeResult = {
      subscriber_count: null,
      video_count: 10,
      uploads_last_90d: null,
      channel_id: "UCtest",
      channel_title: null,
      match_source: "manual",
    };
    const profile = applyYouTubeToProfile({}, result);

    expect(profile.youtube?.subscriber_count).toBe(0);
    expect(profile.youtube?.video_count).toBe(10);
  });

  it("defaults null subscriber_count to 0 in unverified when searched", () => {
    const result: YouTubeResult = {
      subscriber_count: null,
      video_count: 100,
      uploads_last_90d: 12,
      channel_id: "UChidden",
      channel_title: "Hidden Subs Channel",
      match_source: "searched",
    };
    const profile = applyYouTubeToProfile({}, result);

    expect(profile.youtube).toBeUndefined();
    expect(profile.unverified_signals?.youtube?.subscriber_count).toBe(0);
    expect(profile.unverified_signals?.youtube?.video_count).toBe(100);
  });
});
