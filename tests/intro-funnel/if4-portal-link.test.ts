/**
 * IF-4 portal link + recovery form tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "portal.magic_link_ttl_hours") return 168;
      if (key === "portal.session_cookie_ttl_days") return 90;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

const mockIssueMagicLink = vi.fn().mockResolvedValue({
  url: "http://localhost:3001/lite/portal/r/test-token-abc",
  rawToken: "test-token-abc",
});

vi.mock("@/lib/portal/issue-magic-link", () => ({
  issueMagicLink: (...args: unknown[]) => mockIssueMagicLink(...args),
}));

const { generateIntroPortalLink } = await import(
  "@/lib/intro-funnel/portal-link"
);

describe("generateIntroPortalLink", () => {
  beforeEach(() => {
    mockIssueMagicLink.mockClear();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
  });

  it("issues a magic link and appends callbackUrl", async () => {
    const result = await generateIntroPortalLink({
      contactId: "c1",
      submissionId: "s1",
      introToken: "abc123",
      issuedFor: "test",
    });

    expect(mockIssueMagicLink).toHaveBeenCalledWith({
      contactId: "c1",
      submissionId: "s1",
      issuedFor: "test",
    });

    expect(result).toBe(
      "http://localhost:3001/lite/portal/r/test-token-abc?callbackUrl=%2Flite%2Fintro%2Fabc123",
    );
  });

  it("passes issuedFor through to issueMagicLink", async () => {
    await generateIntroPortalLink({
      contactId: "c2",
      submissionId: "s2",
      introToken: "def456",
      issuedFor: "shoot_booking_confirmed",
    });

    expect(mockIssueMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({ issuedFor: "shoot_booking_confirmed" }),
    );
  });
});
