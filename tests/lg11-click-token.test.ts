import { describe, it, expect, beforeAll } from "vitest";
import {
  createClickToken,
  verifyClickToken,
  wrapOutreachLink,
} from "@/lib/lead-gen/click-token";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-for-click-tokens";
  process.env.NEXT_PUBLIC_APP_URL = "https://superbadmedia.com.au";
});

describe("click-token", () => {
  it("creates and verifies a valid token", () => {
    const token = createClickToken({
      send_id: "send-123",
      url: "https://example.com",
    });

    const result = verifyClickToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.send_id).toBe("send-123");
      expect(result.payload.url).toBe("https://example.com");
    }
  });

  it("rejects a tampered token", () => {
    const token = createClickToken({
      send_id: "send-123",
      url: "https://example.com",
    });

    const tampered = token.slice(0, -1) + "X";
    const result = verifyClickToken(tampered);
    expect(result.valid).toBe(false);
  });

  it("rejects malformed token", () => {
    expect(verifyClickToken("not-a-token").valid).toBe(false);
    expect(verifyClickToken("a.b.c").valid).toBe(false);
    expect(verifyClickToken("").valid).toBe(false);
  });

  it("wraps outreach links with full URL", () => {
    const wrapped = wrapOutreachLink("send-456", "https://target.com/page");
    expect(wrapped).toContain("/api/outreach/click?t=");
    expect(wrapped).toContain("superbadmedia.com.au");

    // Verify the embedded token
    const urlObj = new URL(wrapped);
    const tokenParam = urlObj.searchParams.get("t");
    expect(tokenParam).toBeTruthy();

    const result = verifyClickToken(tokenParam!);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.send_id).toBe("send-456");
      expect(result.payload.url).toBe("https://target.com/page");
    }
  });
});
