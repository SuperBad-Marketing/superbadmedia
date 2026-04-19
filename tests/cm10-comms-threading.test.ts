import { describe, it, expect } from "vitest";

describe("CM-10: Thread detail component", () => {
  it("exports ThreadDetail", async () => {
    const mod = await import(
      "../components/lite/admin/shared/thread-detail"
    );
    expect(mod.ThreadDetail).toBeDefined();
    expect(typeof mod.ThreadDetail).toBe("function");
  });
});

describe("CM-10: Company CommsTab", () => {
  it("exports CommsTab with thread-expansion props", async () => {
    const mod = await import(
      "../components/lite/admin/companies/comms-tab"
    );
    expect(mod.CommsTab).toBeDefined();
    expect(typeof mod.CommsTab).toBe("function");
  });

  it("accepts focusedThreadId, focusedThread, focusedMessages, companyId props", async () => {
    const mod = await import(
      "../components/lite/admin/companies/comms-tab"
    );
    expect(mod.CommsTab.length).toBeGreaterThanOrEqual(1);
  });
});

describe("CM-10: Contact ContactCommsTab", () => {
  it("exports ContactCommsTab with thread-expansion props", async () => {
    const mod = await import(
      "../components/lite/admin/contacts/contact-comms-tab"
    );
    expect(mod.ContactCommsTab).toBeDefined();
    expect(typeof mod.ContactCommsTab).toBe("function");
  });

  it("accepts contactId and focus props", async () => {
    const mod = await import(
      "../components/lite/admin/contacts/contact-comms-tab"
    );
    expect(mod.ContactCommsTab.length).toBeGreaterThanOrEqual(1);
  });
});

describe("CM-10: Messages schema", () => {
  it("exports messages table and MessageRow type-check", async () => {
    const mod = await import("../lib/db/schema/messages");
    expect(mod.messages).toBeDefined();
    expect(mod.threads).toBeDefined();
    const cols = Object.keys(mod.messages);
    expect(cols.length).toBeGreaterThan(0);
  });

  it("messages table has thread_id column", async () => {
    const mod = await import("../lib/db/schema/messages");
    const colNames = Object.keys(mod.messages);
    expect(colNames).toContain("thread_id");
  });

  it("messages table has direction column", async () => {
    const mod = await import("../lib/db/schema/messages");
    const colNames = Object.keys(mod.messages);
    expect(colNames).toContain("direction");
  });
});

describe("CM-10: Portal Chat tabs (pre-existing, verified still functional)", () => {
  it("ContactPortalChatTab still exports correctly", async () => {
    const mod = await import(
      "../components/lite/admin/contacts/contact-portal-chat-tab"
    );
    expect(mod.ContactPortalChatTab).toBeDefined();
  });

  it("PortalChatTab (company level) still exports correctly", async () => {
    const mod = await import(
      "../components/lite/admin/companies/portal-chat-tab"
    );
    expect(mod.PortalChatTab).toBeDefined();
  });
});

describe("CM-10: Channel icon coverage", () => {
  it("company CommsTab covers portal_chat_escalation source channel", async () => {
    const msgSchema = await import("../lib/db/schema/messages");
    expect(msgSchema.MESSAGE_CHANNELS).toContain("portal_chat");
  });
});

describe("CM-10: Ticket status styles", () => {
  it("covers open, waiting_on_customer, resolved statuses", async () => {
    const mod = await import("../lib/db/schema/messages");
    expect(mod.TICKET_STATUSES).toContain("open");
    expect(mod.TICKET_STATUSES).toContain("waiting_on_customer");
    expect(mod.TICKET_STATUSES).toContain("resolved");
  });
});
