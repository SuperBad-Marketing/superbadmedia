import { describe, it, expect } from "vitest";
import {
  applyYouTubeToProfile,
  type YouTubeResult,
} from "@/lib/lead-gen/enrich/youtube";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

describe("applyYouTubeToProfile", () => {
  it("merges successful YouTube data", () => {
    const result: YouTubeResult = {
      subscriber_count: 1200,
      video_count: 45,
      uploads_last_90d: 6,
      channel_id: "UCabc123",
    };
    const profile = applyYouTubeToProfile({}, result);

    expect(profile.youtube?.subscriber_count).toBe(1200);
    expect(profile.youtube?.video_count).toBe(45);
    expect(profile.youtube?.uploads_last_90d).toBe(6);
    expect(profile.fetch_errors).toBeUndefined();
  });

  it("skips youtube section when all fields null", () => {
    const result: YouTubeResult = {
      subscriber_count: null,
      video_count: null,
      uploads_last_90d: null,
      channel_id: null,
      error: "No YouTube channel found for this business.",
    };
    const profile = applyYouTubeToProfile({}, result);

    expect(profile.youtube).toBeUndefined();
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
    };
    const profile = applyYouTubeToProfile(existing, result);

    expect(profile.youtube?.subscriber_count).toBe(500);
    expect(profile.maps?.category).toBe("Gym");
  });

  it("defaults null subscriber_count to 0 when video_count exists", () => {
    const result: YouTubeResult = {
      subscriber_count: null,
      video_count: 10,
      uploads_last_90d: null,
      channel_id: "UCtest",
    };
    const profile = applyYouTubeToProfile({}, result);

    expect(profile.youtube?.subscriber_count).toBe(0);
    expect(profile.youtube?.video_count).toBe(10);
  });

  it("handles hidden subscriber count gracefully", () => {
    const result: YouTubeResult = {
      subscriber_count: null,
      video_count: 100,
      uploads_last_90d: 12,
      channel_id: "UChidden",
    };
    const profile = applyYouTubeToProfile({}, result);

    expect(profile.youtube?.subscriber_count).toBe(0);
    expect(profile.youtube?.video_count).toBe(100);
    expect(profile.youtube?.uploads_last_90d).toBe(12);
  });
});
