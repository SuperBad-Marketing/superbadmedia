import { describe, it, expect } from "vitest";

describe("CM-5 — Portal chat home", () => {
  describe("ChatHome component exports", () => {
    it("exports ChatHome from portal/chat-home", async () => {
      const mod = await import(
        "@/components/lite/portal/chat-home"
      );
      expect(mod.ChatHome).toBeDefined();
      expect(typeof mod.ChatHome).toBe("function");
    });
  });

  describe("lib/portal/chat exports", () => {
    it("exports getChatHistory", async () => {
      const mod = await import("@/lib/portal/chat");
      expect(mod.getChatHistory).toBeDefined();
      expect(typeof mod.getChatHistory).toBe("function");
    });

    it("exports getTodayChatCount", async () => {
      const mod = await import("@/lib/portal/chat");
      expect(mod.getTodayChatCount).toBeDefined();
      expect(typeof mod.getTodayChatCount).toBe("function");
    });

    it("exports getDailyLimit", async () => {
      const mod = await import("@/lib/portal/chat");
      expect(mod.getDailyLimit).toBeDefined();
      expect(typeof mod.getDailyLimit).toBe("function");
    });

    it("exports generateOpeningLine", async () => {
      const mod = await import("@/lib/portal/chat");
      expect(mod.generateOpeningLine).toBeDefined();
      expect(typeof mod.generateOpeningLine).toBe("function");
    });

    it("exports handleChatMessage", async () => {
      const mod = await import("@/lib/portal/chat");
      expect(mod.handleChatMessage).toBeDefined();
      expect(typeof mod.handleChatMessage).toBe("function");
    });

    it("exports assemblePortalContext", async () => {
      const mod = await import("@/lib/portal/chat");
      expect(mod.assemblePortalContext).toBeDefined();
      expect(typeof mod.assemblePortalContext).toBe("function");
    });
  });

  describe("portal chat API route", () => {
    it("route file exists with GET and POST", async () => {
      const mod = await import("@/app/api/lite/portal/chat/route");
      expect(mod.GET).toBeDefined();
      expect(mod.POST).toBeDefined();
    });
  });

  describe("portal_chat_messages schema", () => {
    it("has the expected columns", async () => {
      const { portal_chat_messages } = await import(
        "@/lib/db/schema/portal-chat-messages"
      );
      const cols = Object.keys(portal_chat_messages);
      expect(cols).toContain("id");
      expect(cols).toContain("contact_id");
      expect(cols).toContain("role");
      expect(cols).toContain("content");
      expect(cols).toContain("escalated_to_inbox");
      expect(cols).toContain("created_at_ms");
    });
  });

  describe("portal [token] page", () => {
    it("page file exists with default export", async () => {
      const mod = await import("@/app/lite/portal/[token]/page");
      expect(mod.default).toBeDefined();
    });
  });

  describe("portal [token] actions", () => {
    it("exports markTourComplete", async () => {
      const mod = await import("@/app/lite/portal/[token]/actions");
      expect(mod.markTourComplete).toBeDefined();
      expect(typeof mod.markTourComplete).toBe("function");
    });
  });

  describe("bartender model registry entries", () => {
    it("has all 3 client-mgmt jobs", async () => {
      const { MODELS } = await import("@/lib/ai/models");
      expect(MODELS["client-mgmt-bartender-opening-line"]).toBe("haiku");
      expect(MODELS["client-mgmt-chat-response"]).toBe("opus");
      expect(MODELS["client-mgmt-escalation-summary"]).toBe("haiku");
    });
  });

  describe("settings keys for portal chat", () => {
    it("has pre-retainer and retainer daily limits", async () => {
      const mod = await import("@/lib/settings");
      const keys = mod.settingsRegistry.keys;
      expect(keys).toContain("portal.chat_calls_per_day_pre_retainer");
      expect(keys).toContain("portal.chat_calls_per_day_retainer");
    });
  });
});
