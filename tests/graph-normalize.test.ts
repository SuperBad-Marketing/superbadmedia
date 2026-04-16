import { describe, it, expect } from "vitest";
import { normalizeGraphMessage } from "@/lib/graph/normalize";
import type { GraphMessage } from "@/lib/graph/types";

function makeGraphMessage(overrides: Partial<GraphMessage> = {}): GraphMessage {
  return {
    id: "AAMkAGI2THVSAAA=",
    internetMessageId: "<abc123@example.com>",
    subject: "Test Subject",
    bodyPreview: "Hello world",
    body: { contentType: "text", content: "Hello world" },
    from: { emailAddress: { name: "Sender", address: "sender@example.com" } },
    toRecipients: [
      { emailAddress: { name: "Andy", address: "andy@superbadmedia.com.au" } },
    ],
    ccRecipients: [],
    bccRecipients: [],
    sentDateTime: "2026-04-16T10:00:00Z",
    receivedDateTime: "2026-04-16T10:00:01Z",
    internetMessageHeaders: [
      { name: "Message-ID", value: "<abc123@example.com>" },
      { name: "In-Reply-To", value: "<prev@example.com>" },
      { name: "References", value: "<first@example.com> <prev@example.com>" },
    ],
    hasAttachments: false,
    isRead: true,
    isDraft: false,
    conversationId: "conv-123",
    ...overrides,
  };
}

describe("normalizeGraphMessage", () => {
  it("normalizes a basic inbound email", () => {
    const gm = makeGraphMessage();
    const result = normalizeGraphMessage(gm, "inbound", "andy@");

    expect(result.direction).toBe("inbound");
    expect(result.channel).toBe("email");
    expect(result.from_address).toBe("sender@example.com");
    expect(result.to_addresses).toEqual(["andy@superbadmedia.com.au"]);
    expect(result.subject).toBe("Test Subject");
    expect(result.body_text).toBe("Hello world");
    expect(result.body_html).toBeNull();
    expect(result.graph_message_id).toBe("AAMkAGI2THVSAAA=");
    expect(result.internetMessageId).toBe("<abc123@example.com>");
    expect(result.inReplyTo).toBe("<prev@example.com>");
    expect(result.referencesHeader).toBe(
      "<first@example.com> <prev@example.com>",
    );
    expect(result.has_attachments).toBe(false);
    expect(result.import_source).toBe("live");
  });

  it("strips HTML from body when contentType is html", () => {
    const gm = makeGraphMessage({
      body: {
        contentType: "html",
        content: "<p>Hello <b>world</b></p>",
      },
    });
    const result = normalizeGraphMessage(gm, "inbound", null);
    expect(result.body_text).toBe("Hello world");
    expect(result.body_html).toBe("<p>Hello <b>world</b></p>");
  });

  it("handles missing from address gracefully", () => {
    const gm = makeGraphMessage({ from: null });
    const result = normalizeGraphMessage(gm, "outbound", "andy@superbadmedia.com.au");
    expect(result.from_address).toBe("andy@superbadmedia.com.au");
  });

  it("preserves has_attachments flag", () => {
    const gm = makeGraphMessage({ hasAttachments: true });
    const result = normalizeGraphMessage(gm, "inbound", null);
    expect(result.has_attachments).toBe(true);
  });

  it("generates a unique id for each normalized message", () => {
    const gm = makeGraphMessage();
    const a = normalizeGraphMessage(gm, "inbound", null);
    const b = normalizeGraphMessage(gm, "inbound", null);
    expect(a.id).not.toBe(b.id);
  });

  it("extracts headers from internetMessageHeaders fallback", () => {
    const gm = makeGraphMessage({
      internetMessageId: null,
      internetMessageHeaders: [
        { name: "Message-ID", value: "<fallback@example.com>" },
      ],
    });
    const result = normalizeGraphMessage(gm, "inbound", null);
    expect(result.message_id_header).toBe("<fallback@example.com>");
  });
});
