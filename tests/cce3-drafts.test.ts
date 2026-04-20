import { describe, it, expect } from "vitest";
import {
  formatDraftPrompt,
  formatNudgePrompt,
  formatReformatPrompt,
} from "@/lib/context-engine/prompts";
import type { AssembledContext } from "@/lib/context-engine/assemble";

function makeCtx(overrides?: Partial<AssembledContext>): AssembledContext {
  return {
    contact: {
      id: "c1",
      name: "Jane Doe",
      role: "Owner",
      email: "jane@example.com",
      preferredChannel: "email",
      companyId: "co1",
    },
    company: {
      id: "co1",
      name: "Cafe Lux",
      industry: "Hospitality",
      sizeBand: "small",
      location: "Melbourne",
    },
    recentMessages: [
      {
        id: "m1",
        direction: "inbound",
        channel: "email",
        subject: "Re: Shoot",
        bodyText: "Thanks, looking forward to next week",
        sentAtMs: Date.now() - 86400_000,
      },
    ],
    activityEntries: [],
    openActionItems: [
      { description: "Send shot list", owner: "you", dueDateMs: null },
    ],
    currentDeal: {
      stage: "trial_shoot",
      valueCents: 250000,
      lastStageChangeAtMs: Date.now() - 86400_000 * 3,
      subscriptionState: null,
    },
    outstandingInvoices: [],
    brandDna: {
      signalTags: '["warm","minimal","considered"]',
      prosePortrait: "Warm, considered, slightly reserved. Values simplicity.",
    },
    conversationSummary:
      "Discussing a trial shoot for three locations. Quote sent and accepted.",
    activeStrategy: null,
    ...overrides,
  };
}

describe("CCE-3 — Draft prompt formatters", () => {
  describe("formatDraftPrompt", () => {
    it("returns system + prompt", () => {
      const ctx = makeCtx();
      const result = formatDraftPrompt(ctx);
      expect(result.system).toBeTruthy();
      expect(result.prompt).toBeTruthy();
    });

    it("includes reply instruction for contacts with messages", () => {
      const ctx = makeCtx();
      const result = formatDraftPrompt(ctx);
      expect(result.system).toContain("Reply to the message below");
    });

    it("uses cold-prospect instruction when no messages and no summary", () => {
      const ctx = makeCtx({
        recentMessages: [],
        conversationSummary: null,
      });
      const result = formatDraftPrompt(ctx);
      expect(result.system).toContain("first-touch cold outreach");
    });

    it("includes conversation summary in prompt", () => {
      const ctx = makeCtx();
      const result = formatDraftPrompt(ctx);
      expect(result.prompt).toContain("RELATIONSHIP SUMMARY");
      expect(result.prompt).toContain("trial shoot");
    });

    it("includes Brand DNA in prompt", () => {
      const ctx = makeCtx();
      const result = formatDraftPrompt(ctx);
      expect(result.prompt).toContain("BRAND DNA");
      expect(result.prompt).toContain("Warm, considered");
    });

    it("includes recent messages in prompt", () => {
      const ctx = makeCtx();
      const result = formatDraftPrompt(ctx);
      expect(result.prompt).toContain("RECENT MESSAGES");
      expect(result.prompt).toContain("FROM THEM");
    });

    it("includes action items in prompt", () => {
      const ctx = makeCtx();
      const result = formatDraftPrompt(ctx);
      expect(result.prompt).toContain("ACTION ITEMS");
      expect(result.prompt).toContain("Send shot list");
    });

    it("includes deal info in prompt", () => {
      const ctx = makeCtx();
      const result = formatDraftPrompt(ctx);
      expect(result.prompt).toContain("Deal: trial_shoot");
    });

    it("handles missing brand DNA gracefully", () => {
      const ctx = makeCtx({ brandDna: null });
      const result = formatDraftPrompt(ctx);
      expect(result.prompt).not.toContain("BRAND DNA");
    });
  });

  describe("formatNudgePrompt", () => {
    it("includes previous draft and nudge", () => {
      const ctx = makeCtx();
      const result = formatNudgePrompt(
        ctx,
        "Hi Jane, looking forward to the shoot.",
        "make it shorter",
        [],
      );
      expect(result.prompt).toContain("PREVIOUS DRAFT");
      expect(result.prompt).toContain("CURRENT NUDGE");
      expect(result.prompt).toContain("make it shorter");
    });

    it("includes nudge history when present", () => {
      const ctx = makeCtx();
      const result = formatNudgePrompt(
        ctx,
        "Hi Jane, looking forward to the shoot.",
        "mention Thursday",
        ["less formal"],
      );
      expect(result.prompt).toContain("PREVIOUS NUDGES");
      expect(result.prompt).toContain("1. less formal");
      expect(result.prompt).toContain("mention Thursday");
    });

    it("omits nudge history when empty", () => {
      const ctx = makeCtx();
      const result = formatNudgePrompt(
        ctx,
        "Draft text",
        "shorter",
        [],
      );
      expect(result.prompt).not.toContain("PREVIOUS NUDGES");
    });
  });

  describe("formatReformatPrompt", () => {
    it("instructs expansion for email target", () => {
      const result = formatReformatPrompt(
        "Quick msg: shoot confirmed for next Tue",
        "email",
      );
      expect(result.system).toContain("Expand for email");
    });

    it("instructs compression for SMS target", () => {
      const result = formatReformatPrompt(
        "Hi Jane, Just wanted to confirm the shoot is all set for Tuesday.",
        "sms",
      );
      expect(result.system).toContain("Compress for SMS");
    });

    it("includes draft text in prompt", () => {
      const result = formatReformatPrompt("Draft body here", "email");
      expect(result.prompt).toContain("Draft body here");
    });
  });
});

describe("CCE-3 — Draft module exports", () => {
  it("exports generateDraft, regenerateDraft, reformatDraft from barrel", async () => {
    const mod = await import("@/lib/context-engine");
    expect(typeof mod.generateDraft).toBe("function");
    expect(typeof mod.regenerateDraft).toBe("function");
    expect(typeof mod.reformatDraft).toBe("function");
  });

  it("exports getDraft, saveDraft, clearDraft from barrel", async () => {
    const mod = await import("@/lib/context-engine");
    expect(typeof mod.getDraft).toBe("function");
    expect(typeof mod.saveDraft).toBe("function");
    expect(typeof mod.clearDraft).toBe("function");
  });
});

describe("CCE-3 — Module boundary", () => {
  it("drafts.ts does not import from lib/private-notes/", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("../lib/context-engine/drafts.ts", import.meta.url),
      "utf-8",
    );
    expect(source).not.toContain("lib/private-notes");
  });

  it("prompts.ts does not import from lib/private-notes/", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("../lib/context-engine/prompts.ts", import.meta.url),
      "utf-8",
    );
    expect(source).not.toContain("lib/private-notes");
  });
});
