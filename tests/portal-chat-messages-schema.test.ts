import { describe, it, expect } from "vitest";
import {
  portal_chat_messages,
  PORTAL_CHAT_ROLES,
  type PortalChatMessageRow,
  type PortalChatMessageInsert,
} from "@/lib/db/schema/portal-chat-messages";
import { getTableName, getTableColumns } from "drizzle-orm";

describe("portal_chat_messages schema", () => {
  it("has the correct table name", () => {
    expect(getTableName(portal_chat_messages)).toBe("portal_chat_messages");
  });

  it("defines all required columns", () => {
    const cols = getTableColumns(portal_chat_messages);
    const names = Object.keys(cols);
    expect(names).toContain("id");
    expect(names).toContain("contact_id");
    expect(names).toContain("role");
    expect(names).toContain("content");
    expect(names).toContain("escalated_to_inbox");
    expect(names).toContain("tool_action");
    expect(names).toContain("created_at_ms");
    expect(names).toHaveLength(7);
  });

  it("exports the role enum", () => {
    expect(PORTAL_CHAT_ROLES).toEqual(["client", "assistant"]);
  });

  it("infers correct Row type shape", () => {
    const row: PortalChatMessageRow = {
      id: 1,
      contact_id: "c-001",
      role: "client",
      content: "hello",
      escalated_to_inbox: false,
      tool_action: null,
      created_at_ms: Date.now(),
    };
    expect(row.id).toBe(1);
  });

  it("infers correct Insert type with defaults", () => {
    const insert: PortalChatMessageInsert = {
      contact_id: "c-001",
      role: "assistant",
      content: "hi there",
      created_at_ms: Date.now(),
    };
    expect(insert.escalated_to_inbox).toBeUndefined();
  });
});
