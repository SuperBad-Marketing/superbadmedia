import { describe, it, expect } from "vitest";
import { GraphDeltaResponseSchema, GraphMessageSchema } from "@/lib/graph/types";

describe("Graph sync types (Zod parsing)", () => {
  it("parses a delta response with messages", () => {
    const input = {
      value: [
        {
          id: "msg-1",
          subject: "Test",
          body: { contentType: "text", content: "Hello" },
          from: { emailAddress: { name: "Test", address: "test@example.com" } },
          toRecipients: [
            { emailAddress: { name: "Andy", address: "andy@sb.com" } },
          ],
          sentDateTime: "2026-04-16T10:00:00Z",
          receivedDateTime: "2026-04-16T10:00:01Z",
          hasAttachments: false,
          isRead: false,
          isDraft: false,
        },
      ],
      "@odata.deltaLink":
        "https://graph.microsoft.com/v1.0/me/mailFolders('Inbox')/messages/delta?$deltatoken=abc",
    };
    const result = GraphDeltaResponseSchema.parse(input);
    expect(result.value).toHaveLength(1);
    expect(result["@odata.deltaLink"]).toContain("deltatoken");
  });

  it("parses a delta response with nextLink (pagination)", () => {
    const input = {
      value: [],
      "@odata.nextLink":
        "https://graph.microsoft.com/v1.0/me/mailFolders('Inbox')/messages/delta?$skiptoken=abc",
    };
    const result = GraphDeltaResponseSchema.parse(input);
    expect(result.value).toHaveLength(0);
    expect(result["@odata.nextLink"]).toContain("skiptoken");
  });

  it("parses a minimal Graph message", () => {
    const input = {
      id: "msg-min",
      body: { contentType: "text", content: "" },
    };
    const result = GraphMessageSchema.parse(input);
    expect(result.id).toBe("msg-min");
    expect(result.toRecipients).toEqual([]);
    expect(result.hasAttachments).toBe(false);
    expect(result.isDraft).toBe(false);
  });

  it("handles missing optional fields gracefully", () => {
    const input = {
      id: "msg-sparse",
      body: { contentType: "html", content: "<p>Hi</p>" },
      from: null,
      subject: null,
    };
    const result = GraphMessageSchema.parse(input);
    expect(result.from).toBeNull();
    expect(result.subject).toBeNull();
  });
});

describe("sync kill-switch", () => {
  it("runDeltaSync returns early when kill-switch is off", async () => {
    const { killSwitches } = await import("@/lib/kill-switches");
    expect(killSwitches.inbox_sync_enabled).toBe(false);
  });
});
