import { describe, it, expect } from "vitest";
import {
  guessInstagramHandle,
  applyInstagramToProfile,
  type InstagramResult,
} from "@/lib/lead-gen/enrich/instagram";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

describe("guessInstagramHandle", () => {
  it("strips .com.au TLD", () => {
    expect(guessInstagramHandle("acmecafe.com.au")).toBe("acmecafe");
  });

  it("strips .com TLD", () => {
    expect(guessInstagramHandle("coolstudio.com")).toBe("coolstudio");
  });

  it("strips .co.uk TLD", () => {
    expect(guessInstagramHandle("britishtea.co.uk")).toBe("britishtea");
  });

  it("strips .io TLD", () => {
    expect(guessInstagramHandle("startup.io")).toBe("startup");
  });

  it("removes non-IG-compatible characters (hyphens, dots)", () => {
    expect(guessInstagramHandle("my-cool-shop.com.au")).toBe("mycoolshop");
  });

  it("lowercases the result", () => {
    expect(guessInstagramHandle("AcmeCafe.COM")).toBe("acmecafe");
  });

  it("handles subdomains by stripping dots", () => {
    expect(guessInstagramHandle("shop.example.com")).toBe("shopexample");
  });
});

describe("applyInstagramToProfile", () => {
  it("merges successful Instagram data", () => {
    const result: InstagramResult = {
      follower_count: 3200,
      post_count: 145,
      posts_last_30d: 8,
      username: "acmecafe",
    };
    const profile = applyInstagramToProfile({}, result);

    expect(profile.instagram?.follower_count).toBe(3200);
    expect(profile.instagram?.post_count).toBe(145);
    expect(profile.instagram?.posts_last_30d).toBe(8);
    expect(profile.fetch_errors).toBeUndefined();
  });

  it("skips instagram section when all fields null (no data)", () => {
    const result: InstagramResult = {
      follower_count: null,
      post_count: null,
      posts_last_30d: null,
      username: "acmecafe",
      error: "Account not found",
    };
    const profile = applyInstagramToProfile({}, result);

    expect(profile.instagram).toBeUndefined();
    expect(profile.fetch_errors?.instagram).toBe("Account not found");
  });

  it("preserves existing profile fields", () => {
    const existing: Partial<ViabilityProfile> = {
      meta_ads: {
        active_ad_count: 3,
        estimated_spend_bracket: "medium",
        has_active_creatives: true,
      },
    };

    const result: InstagramResult = {
      follower_count: 500,
      post_count: 30,
      posts_last_30d: 2,
      username: "test",
    };
    const profile = applyInstagramToProfile(existing, result);

    expect(profile.instagram?.follower_count).toBe(500);
    expect(profile.meta_ads?.active_ad_count).toBe(3);
  });

  it("defaults null follower_count to 0 when post_count is available", () => {
    const result: InstagramResult = {
      follower_count: null,
      post_count: 10,
      posts_last_30d: null,
      username: "test",
    };
    const profile = applyInstagramToProfile({}, result);

    expect(profile.instagram?.follower_count).toBe(0);
    expect(profile.instagram?.post_count).toBe(10);
  });
});
