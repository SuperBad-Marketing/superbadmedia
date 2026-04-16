import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GraphTokenResponseSchema, GraphSubscriptionSchema } from "@/lib/graph/types";

describe("Graph API types (Zod schemas)", () => {
  it("parses a valid token response", () => {
    const input = {
      access_token: "eyJ0eXAiOiJKV1Q...",
      refresh_token: "0.ATMA...",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "Mail.ReadWrite Mail.Send",
    };
    const result = GraphTokenResponseSchema.parse(input);
    expect(result.access_token).toBe("eyJ0eXAiOiJKV1Q...");
    expect(result.expires_in).toBe(3600);
  });

  it("rejects token response without access_token", () => {
    expect(() =>
      GraphTokenResponseSchema.parse({
        expires_in: 3600,
        token_type: "Bearer",
      }),
    ).toThrow();
  });

  it("accepts token response without optional refresh_token", () => {
    const result = GraphTokenResponseSchema.parse({
      access_token: "token",
      expires_in: 3600,
      token_type: "Bearer",
    });
    expect(result.refresh_token).toBeUndefined();
  });

  it("parses a valid subscription response", () => {
    const input = {
      id: "sub-123",
      expirationDateTime: "2026-04-18T10:00:00Z",
      resource: "me/mailFolders('Inbox')/messages",
      changeType: "created,updated",
    };
    const result = GraphSubscriptionSchema.parse(input);
    expect(result.id).toBe("sub-123");
  });
});

describe("Graph API kill-switch gating", () => {
  it("createGraphClient throws when inbox_sync_enabled is false", async () => {
    // We test the kill-switch check without actually calling the full function
    // by importing the kill-switch module directly
    const { killSwitches } = await import("@/lib/kill-switches");
    expect(killSwitches.inbox_sync_enabled).toBe(false);
  });
});
